import { getScoreSnapshot, getScoreHistorical, getScoreUpdates, type ScoreSnapshot } from '@/lib/txline/scores';
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
  inferMatchIsLive,
  resolveEffectiveGameState,
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
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';
import type { BoardFixture, FixtureStatus } from '@/app/api/fixtures/board/route';

export interface ResolvedMatchData {
  fixtureId: number;
  status: FixtureStatus;
  latest: ScoreSnapshot | null;
  history: ScoreSnapshot[];
  odds: ReturnType<typeof TxLineDataParser.parseOddsPayloads> | null;
  source: 'database' | 'txline' | 'merged';
}

/** Kickoff −30m through +4h — always read TxLINE, not DB. */
export function isInMatchWindow(startTimeMs: number, now = Date.now()): boolean {
  if (startTimeMs <= 0) return false;
  return startTimeMs - 30 * 60_000 <= now && now <= startTimeMs + 4 * 60 * 60_000;
}

function isCompleteArchive(row: StoredMatchDataRow | null): boolean {
  if (!row) return false;
  if (row.status === 'unavailable') return false;
  if (row.status !== 'finished') return false;
  if (row.score_home == null && row.score_away == null) return false;
  if (!row.latest_snapshot || row.score_history.length < 3) return false;
  const finalised = row.score_history.some((h) => {
    const action = h.action?.toLowerCase();
    return action === 'game_finalised' || action === 'match_ended';
  });
  return finalised || row.score_history.length >= 20;
}

function shouldRefreshFromTxline(
  row: StoredMatchDataRow | null,
  startTimeMs: number,
  force: boolean
): boolean {
  if (force) return true;
  if (isInMatchWindow(startTimeMs)) return true;
  if (!row) return true;

  const ageMs = Date.now() - new Date(row.synced_at).getTime();
  if (row.status === 'live') return true;
  if (row.status === 'upcoming' && startTimeMs <= Date.now()) return true;
  if (row.status === 'finished') return !isCompleteArchive(row);
  return ageMs > 300_000;
}

async function fetchFromTxline(
  fixtureId: number,
  startTimeMs: number
): Promise<{ latest: ScoreSnapshot | null; history: ScoreSnapshot[] }> {
  const now = Date.now();
  const isPast = startTimeMs > 0 && startTimeMs < now - 30 * 60_000;

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
    typeof snapLatest?.scoreSoccer?.Participant2?.Total?.Goals === 'number' ||
    typeof snapLatest?.scoreSoccer?.Participant1?.PE?.Goals === 'number' ||
    typeof snapLatest?.scoreSoccer?.Participant2?.PE?.Goals === 'number';

  if (isPast || snapshot.length === 0 || !hasScore) {
    try {
      history = await getScoreHistorical(fixtureId);
    } catch {
      history = [];
    }
  }

  if (history.length === 0) {
    try {
      const updates = await getScoreUpdates(fixtureId);
      if (updates.length > 0) history = updates;
    } catch {
      // no updates
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

function mergeTxlineWithStored(
  fetched: { latest: ScoreSnapshot | null; history: ScoreSnapshot[] },
  stored: StoredMatchDataRow | null
): { latest: ScoreSnapshot | null; history: ScoreSnapshot[]; source: ResolvedMatchData['source'] } {
  if (fetched.latest || fetched.history.length > 0) {
    return {
      latest: fetched.latest ?? stored?.latest_snapshot ?? null,
      history: fetched.history.length > 0 ? fetched.history : (stored?.score_history ?? []),
      source: stored ? 'merged' : 'txline',
    };
  }
  if (stored?.latest_snapshot) {
    return {
      latest: stored.latest_snapshot,
      history: stored.score_history ?? [],
      source: 'database',
    };
  }
  return { latest: null, history: [], source: 'txline' };
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
    /** Skip DB reads — caller will hydrate from SSE hub (live viewing). */
    streamOnly?: boolean;
  } = {}
): Promise<ResolvedMatchData> {
  const startTimeMs = opts.startTimeMs ?? 0;
  const liveWindow = isInMatchWindow(startTimeMs);
  let stored: StoredMatchDataRow | null = null;

  if (isDatabaseEnabled() && !opts.streamOnly && !liveWindow) {
    stored = await getMatchData(fixtureId);
  }

  const useArchive =
    !liveWindow &&
    !opts.forceRefresh &&
    !opts.streamOnly &&
    stored &&
    isCompleteArchive(stored);

  let latest: ScoreSnapshot | null = null;
  let history: ScoreSnapshot[] = [];
  let source: ResolvedMatchData['source'] = 'txline';

  if (useArchive) {
    latest = stored!.latest_snapshot;
    history = stored!.score_history ?? [];
    source = 'database';
  } else {
    const needsTxline = shouldRefreshFromTxline(stored, startTimeMs, Boolean(opts.forceRefresh));
    if (needsTxline || liveWindow || opts.streamOnly) {
      const fetched = await fetchFromTxline(fixtureId, startTimeMs);
      const merged = mergeTxlineWithStored(fetched, stored);
      latest = merged.latest;
      history = merged.history;
      source = merged.source;
    } else if (stored) {
      latest = stored.latest_snapshot;
      history = stored.score_history ?? [];
      source = 'database';
    }
  }

  let odds: ResolvedMatchData['odds'] = null;
  if (opts.fetchOdds) {
    try {
      const payloads = await getOddsSnapshot(fixtureId);
      if (payloads?.length) {
        odds = TxLineDataParser.parseOddsPayloads(payloads);
      }
    } catch {
      odds = stored?.odds_data ?? null;
    }
  } else if (stored?.odds_data && source === 'database') {
    odds = stored.odds_data;
  }

  const status = deriveMatchStatus(
    latest,
    startTimeMs,
    history,
    Boolean(odds?.isLive)
  ) as FixtureStatus;

  if (
    LOAD_CONFIG.archiveToDb &&
    isDatabaseEnabled() &&
    opts.homeTeam &&
    opts.awayTeam
  ) {
    await upsertFixture({
      fixtureId,
      competition: opts.competition ?? 'World Cup',
      startTime: startTimeMs,
      homeTeam: opts.homeTeam,
      awayTeam: opts.awayTeam,
      participant1IsHome: opts.participant1IsHome ?? true,
      epochDay: opts.epochDay,
    });

    const finalised = history.some(
      (h) =>
        h.action?.toLowerCase() === 'game_finalised' ||
        h.action?.toLowerCase() === 'match_ended'
    );
    const row = latest ?? pickLatestScore(history);
    if (row && (finalised || status === 'finished')) {
      await upsertMatchData({
        fixtureId,
        status,
        latest: row,
        history: history.length > 0 ? history : [row],
        odds,
      });
    }
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
  const live =
    resolved.status === 'live' ||
    inferMatchIsLive(latest ?? undefined, history, Boolean(resolved.odds?.isLive));
  const phase = resolveEffectiveGameState(latest ?? undefined, history);
  const score = scoreFromSnapshot(latest ?? undefined);
  const endLabel = resolveEndLabel(latest ?? undefined, history);

  return {
    FixtureId: fixture.FixtureId,
    Competition: fixture.Competition,
    StartTime: fixture.StartTime,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    status: resolved.status,
    gameState: phase,
    gameStateLabel: latest
      ? formatMatchEndLabel(latest, history)
      : resolved.status === 'unavailable'
        ? 'No coverage'
        : '',
    minute:
      resolved.status === 'unavailable'
        ? ''
        : resolved.status === 'finished' && endLabel
          ? endLabel
          : formatMatchMinute(latest, history),
    resultLabel: resolved.status === 'finished' ? endLabel : null,
    scoreHome: score?.home ?? null,
    scoreAway: score?.away ?? null,
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
  const phase = resolveEffectiveGameState(latest, row.match.score_history);
  const live = inferMatchIsLive(latest, row.match.score_history);
  const endLabel = resolveEndLabel(latest, row.match.score_history);

  return {
    FixtureId: Number(row.fixture_id),
    Competition: row.competition,
    StartTime: Number(row.start_time),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status: row.match.status as FixtureStatus,
    gameState: phase,
    gameStateLabel: formatMatchEndLabel(latest, row.match.score_history),
    minute: formatMatchMinute(latest, row.match.score_history),
    resultLabel: row.match.status === 'finished' ? endLabel : null,
    scoreHome: row.match.score_home,
    scoreAway: row.match.score_away,
    isPulse: live,
  };
}

export { parseScorePayload };
