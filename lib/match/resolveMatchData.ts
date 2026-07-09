import { getScoreSnapshot, getScoreHistorical, type ScoreSnapshot } from '@/lib/txline/scores';
import { getOddsSnapshot } from '@/lib/txline/odds';
import { TxLineDataParser } from '@/lib/txline/parser';
import {
  pickLatestScore,
  deriveMatchStatus,
  parseScorePayload,
} from '@/lib/txline/normalizeScore';
import {
  formatMatchEndLabel,
  formatMatchMinute,
  isSoccerLive,
  resolveEndLabel,
  scoreFromSnapshot,
} from '@/lib/txline/gameState';
import {
  getMatchData,
  upsertFixture,
  upsertMatchData,
  type StoredMatchDataRow,
} from '@/lib/db/fixtureStore';
import { isDatabaseEnabled } from '@/lib/db/pool';
import type { BoardFixture, FixtureStatus } from '@/app/api/fixtures/board/route';

export interface ResolvedMatchData {
  fixtureId: number;
  status: FixtureStatus;
  latest: ScoreSnapshot | null;
  history: ScoreSnapshot[];
  odds: ReturnType<typeof TxLineDataParser.parseOddsPayloads> | null;
  source: 'database' | 'txline' | 'merged';
}

function isCompleteArchive(row: StoredMatchDataRow | null): boolean {
  if (!row) return false;
  if (row.status !== 'finished') return false;
  if (row.score_home == null && row.score_away == null) return false;
  return Boolean(row.latest_snapshot) && row.score_history.length > 0;
}

function shouldRefreshFromTxline(
  row: StoredMatchDataRow | null,
  startTimeMs: number,
  force: boolean
): boolean {
  if (force) return true;
  if (!row) return true;

  const ageMs = Date.now() - new Date(row.synced_at).getTime();
  if (row.status === 'live') return ageMs > 10_000;
  if (row.status === 'upcoming' && startTimeMs <= Date.now()) return true;
  if (row.status === 'finished') return !isCompleteArchive(row);
  return ageMs > 300_000;
}

async function fetchFromTxline(
  fixtureId: number,
  startTimeMs: number
): Promise<{ latest: ScoreSnapshot | null; history: ScoreSnapshot[] }> {
  const now = Date.now();
  const isPast = startTimeMs < now - 2 * 60 * 60 * 1000;

  let snapshot: ScoreSnapshot[] = [];
  let history: ScoreSnapshot[] = [];

  try {
    snapshot = await getScoreSnapshot(fixtureId);
  } catch {
    snapshot = [];
  }

  const snapLatest = pickLatestScore(snapshot);
  const hasScore =
    typeof snapLatest?.scoreSoccer?.Participant1?.Total?.Goals === 'number' ||
    typeof snapLatest?.scoreSoccer?.Participant2?.Total?.Goals === 'number';

  if (isPast || snapshot.length === 0 || !hasScore) {
    try {
      history = await getScoreHistorical(fixtureId);
    } catch {
      history = [];
    }
  }

  if (history.length === 0 && snapshot.length > 0) {
    history = snapshot;
  } else if (history.length > 0 && snapshot.length > 0) {
    const seen = new Set(history.map((e) => e.seq));
    for (const row of snapshot) {
      if (!seen.has(row.seq)) history.push(row);
    }
    history.sort((a, b) => a.seq - b.seq);
  }

  const latest = pickLatestScore(history.length > 0 ? history : snapshot);
  return { latest, history: history.length > 0 ? history : snapshot };
}

export async function resolveMatchData(
  fixtureId: number,
  opts: {
    startTimeMs?: number;
    competition?: string;
    homeTeam?: string;
    awayTeam?: string;
    participant1IsHome?: boolean;
    epochDay?: number;
    forceRefresh?: boolean;
    fetchOdds?: boolean;
  } = {}
): Promise<ResolvedMatchData> {
  const startTimeMs = opts.startTimeMs ?? 0;
  let stored: StoredMatchDataRow | null = null;

  if (isDatabaseEnabled()) {
    stored = await getMatchData(fixtureId);
  }

  const needsTxline = shouldRefreshFromTxline(stored, startTimeMs, Boolean(opts.forceRefresh));
  let latest = stored?.latest_snapshot ?? null;
  let history = stored?.score_history ?? [];
  let source: ResolvedMatchData['source'] = stored ? 'database' : 'txline';

  if (needsTxline) {
    const fetched = await fetchFromTxline(fixtureId, startTimeMs);
    if (fetched.latest) {
      latest = fetched.latest;
      history = fetched.history;
      source = stored ? 'merged' : 'txline';
    }
  }

  const status = deriveMatchStatus(latest, startTimeMs, history) as FixtureStatus;

  let odds: ResolvedMatchData['odds'] = stored?.odds_data ?? null;
  if (opts.fetchOdds && (needsTxline || !odds)) {
    try {
      const payloads = await getOddsSnapshot(fixtureId);
      if (payloads?.length) {
        odds = TxLineDataParser.parseOddsPayloads(payloads);
      }
    } catch {
      odds = stored?.odds_data ?? null;
    }
  }

  if (isDatabaseEnabled() && opts.homeTeam && opts.awayTeam) {
    await upsertFixture({
      fixtureId,
      competition: opts.competition ?? 'World Cup',
      startTime: startTimeMs,
      homeTeam: opts.homeTeam,
      awayTeam: opts.awayTeam,
      participant1IsHome: opts.participant1IsHome ?? true,
      epochDay: opts.epochDay,
    });
  }

  if (isDatabaseEnabled() && latest && (needsTxline || !stored)) {
    await upsertMatchData({
      fixtureId,
      status,
      latest,
      history,
      odds,
    });
  }

  return { fixtureId, status, latest, history, odds, source };
}

export function boardFixtureFromResolved(
  fixture: {
    FixtureId: number;
    Competition: string;
    StartTime: number;
    homeTeam: string;
    awayTeam: string;
  },
  resolved: ResolvedMatchData
): BoardFixture {
  const latest = resolved.latest;
  const history = resolved.history;
  const live = latest ? isSoccerLive(latest.gameState) : resolved.status === 'live';
  const score = scoreFromSnapshot(latest ?? undefined);

  return {
    FixtureId: fixture.FixtureId,
    Competition: fixture.Competition,
    StartTime: fixture.StartTime,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    status: resolved.status,
    gameState: latest?.gameState ?? 'NS',
    gameStateLabel: latest
      ? formatMatchEndLabel(latest, history)
      : resolved.status === 'unavailable'
        ? 'No coverage'
        : '—',
    minute:
      resolved.status === 'unavailable'
        ? '—'
        : resolved.status === 'finished' && latest
          ? resolveEndLabel(latest, history)
          : formatMatchMinute(latest, history),
    resultLabel: resolved.status === 'finished' && latest ? resolveEndLabel(latest, history) : null,
    scoreHome: latest ? score.home : null,
    scoreAway: latest ? score.away : null,
    isPulse: live,
  };
}

export function storedRowToBoardFixture(row: {
  fixture_id: string;
  competition: string;
  start_time: string;
  home_team: string;
  away_team: string;
  match: StoredMatchDataRow | null;
}): BoardFixture | null {
  if (!row.match?.latest_snapshot) return null;

  const latest = row.match.latest_snapshot;
  const live = isSoccerLive(latest.gameState);

  return {
    FixtureId: Number(row.fixture_id),
    Competition: row.competition,
    StartTime: Number(row.start_time),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status: row.match.status as FixtureStatus,
    gameState: latest.gameState,
    gameStateLabel: formatMatchEndLabel(latest, row.match.score_history),
    minute: formatMatchMinute(latest, row.match.score_history),
    resultLabel:
      row.match.status === 'finished' ? resolveEndLabel(latest, row.match.score_history) : null,
    scoreHome: row.match.score_home,
    scoreAway: row.match.score_away,
    isPulse: live,
  };
}

export { parseScorePayload };
