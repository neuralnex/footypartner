import type { ScoreSnapshot, SoccerData, SoccerScore, SoccerTotalScore } from './scores';
import {
  inferMatchIsLive,
  isSoccerFinished,
  isMatchFinalised,
  normalizePhase,
  phaseFromStatusId,
  resolveEffectiveGameState,
} from './gameState';

type RawScoreEvent = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function mapSoccerTotal(raw: unknown): SoccerTotalScore | undefined {
  const row = asRecord(raw);
  if (!row) return undefined;
  const mapPhase = (phase: unknown): SoccerScore | undefined => {
    const p = asRecord(phase);
    if (!p) return undefined;
    return {
      Goals: typeof p.Goals === 'number' ? p.Goals : 0,
      YellowCards: typeof p.YellowCards === 'number' ? p.YellowCards : 0,
      RedCards: typeof p.RedCards === 'number' ? p.RedCards : 0,
      Corners: typeof p.Corners === 'number' ? p.Corners : 0,
    };
  };
  return {
    H1: mapPhase(row.H1),
    HT: mapPhase(row.HT),
    H2: mapPhase(row.H2),
    ET1: mapPhase(row.ET1),
    ET2: mapPhase(row.ET2),
    PE: mapPhase(row.PE),
    ETTotal: mapPhase(row.ETTotal),
    Total: mapPhase(row.Total),
  };
}

function terminalPhaseFromScore(raw: RawScoreEvent): string | null {
  const score = asRecord(raw.scoreSoccer) ?? asRecord(raw.Score);
  if (!score) return null;

  const p1 = asRecord(score.Participant1);
  const p2 = asRecord(score.Participant2);
  const pe1 = asRecord(p1?.PE)?.Goals;
  const pe2 = asRecord(p2?.PE)?.Goals;
  if (
    (typeof pe1 === 'number' && pe1 > 0) ||
    (typeof pe2 === 'number' && pe2 > 0)
  ) {
    return 'FPE';
  }

  const hasEt = [p1?.ET1, p1?.ET2, p1?.ETTotal, p2?.ET1, p2?.ET2, p2?.ETTotal].some(Boolean);
  if (hasEt) return 'FET';

  return null;
}

function inferGameState(raw: RawScoreEvent): string {
  const action = String(raw.action ?? raw.Action ?? '').toLowerCase();

  const fromStatus = phaseFromStatusId(raw.StatusId ?? raw.statusId);
  if (fromStatus) return fromStatus;

  // TxLINE uses PascalCase GameState for the authoritative phase (e.g. PE during shootouts).
  const pascal = normalizePhase(String(raw.GameState ?? ''));
  const camel = normalizePhase(String(raw.gameState ?? ''));
  const explicit = pascal !== 'NS' ? pascal : camel;
  if (explicit && explicit !== 'NS') return explicit;

  if (action === 'game_finalised' || action === 'match_ended') {
    return terminalPhaseFromScore(raw) ?? 'F';
  }

  return 'NS';
}

function mapDataSoccer(raw: RawScoreEvent): SoccerData | undefined {
  const data = asRecord(raw.dataSoccer ?? raw.Data);
  if (!data) return undefined;

  const clock = asRecord(raw.Clock);
  const minutes =
    typeof data.Minutes === 'number'
      ? data.Minutes
      : typeof clock?.Seconds === 'number'
        ? Math.floor(clock.Seconds / 60)
        : undefined;

  const action = String(raw.action ?? raw.Action ?? data.Action ?? '');

  return {
    Action: action,
    Goal: Boolean(data.Goal),
    Penalty: Boolean(data.Penalty),
    Corner: Boolean(data.Corner) || action === 'corner',
    RedCard: Boolean(data.RedCard) || action === 'red_card',
    YellowCard: Boolean(data.YellowCard) || action === 'yellow_card',
    PlayerId: typeof data.PlayerId === 'number' ? data.PlayerId : undefined,
    Minutes: minutes,
    Type: typeof data.Type === 'string' ? data.Type : undefined,
    VAR: Boolean(data.VAR),
    Color: typeof data.Color === 'string' ? data.Color : undefined,
    GoalType: data.GoalType,
  };
}

export function normalizeScoreEvent(raw: RawScoreEvent): ScoreSnapshot {
  const scoreRaw = asRecord(raw.scoreSoccer) ?? asRecord(raw.Score);
  const scoreSoccer = scoreRaw
    ? {
        Participant1: mapSoccerTotal(scoreRaw.Participant1) ?? {},
        Participant2: mapSoccerTotal(scoreRaw.Participant2) ?? {},
      }
    : undefined;

  const statsRaw = raw.stats ?? raw.Stats;
  const stats =
    statsRaw && typeof statsRaw === 'object' && !Array.isArray(statsRaw)
      ? (statsRaw as Record<string, number>)
      : undefined;

  const lineups = (raw.lineups ?? raw.Lineups) as ScoreSnapshot['lineups'];

  return {
    fixtureId: Number(raw.fixtureId ?? raw.FixtureId ?? 0),
    gameState: inferGameState(raw),
    startTime: Number(raw.startTime ?? raw.StartTime ?? 0),
    isTeam: Boolean(raw.isTeam ?? raw.IsTeam ?? true),
    fixtureGroupId: Number(raw.fixtureGroupId ?? raw.FixtureGroupId ?? 0),
    competitionId: Number(raw.competitionId ?? raw.CompetitionId ?? 0),
    countryId: Number(raw.countryId ?? raw.CountryId ?? 0),
    sportId: Number(raw.sportId ?? raw.SportId ?? 1),
    participant1IsHome: Boolean(raw.participant1IsHome ?? raw.Participant1IsHome ?? true),
    participant2Id: Number(raw.participant2Id ?? raw.Participant2Id ?? 0),
    participant1Id: Number(raw.participant1Id ?? raw.Participant1Id ?? 0),
    action: String(raw.action ?? raw.Action ?? ''),
    id: Number(raw.id ?? raw.Id ?? 0),
    ts: Number(raw.ts ?? raw.Ts ?? 0),
    connectionId: Number(raw.connectionId ?? raw.ConnectionId ?? 0),
    seq: Number(raw.seq ?? raw.Seq ?? 0),
    scoreSoccer,
    dataSoccer: mapDataSoccer(raw),
    stats,
    lineups,
    possession: typeof raw.possession === 'number' ? raw.possession : typeof raw.Possession === 'number' ? raw.Possession : undefined,
    possessionType:
      typeof raw.possessionType === 'string'
        ? raw.possessionType
        : typeof raw.PossessionType === 'string'
          ? raw.PossessionType
          : undefined,
  };
}

export function parseScorePayload(data: unknown): ScoreSnapshot[] {
  if (!data) return [];

  if (typeof data === 'string') {
    const matches = Array.from(data.matchAll(/^data:\s*(\{[\s\S]*?\})(?:\r?\n|$)/gm)).map((m) => m[1]);
    if (matches.length > 0) {
      return matches
        .map((chunk) => {
          try {
            return normalizeScoreEvent(JSON.parse(chunk) as RawScoreEvent);
          } catch {
            return null;
          }
        })
        .filter((row): row is ScoreSnapshot => row !== null);
    }
    try {
      const parsed = JSON.parse(data);
      return parseScorePayload(parsed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(data)) {
    return data
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        if ('_raw' in row) return null;
        return normalizeScoreEvent(row as RawScoreEvent);
      })
      .filter((row): row is ScoreSnapshot => row !== null);
  }

  if (typeof data === 'object') {
    return [normalizeScoreEvent(data as RawScoreEvent)];
  }

  return [];
}

const NOISE_ACTIONS = new Set([
  'disconnected',
  'connected',
  'coverage_update',
  'comment',
  'heartbeat',
]);

export function pickLatestScore(events: ScoreSnapshot[]): ScoreSnapshot | null {
  if (events.length === 0) return null;

  for (let i = events.length - 1; i >= 0; i--) {
    const row = events[i];
    const action = row.action?.toLowerCase();
    if (action === 'game_finalised' || action === 'match_ended') return row;
  }

  for (let i = events.length - 1; i >= 0; i--) {
    const row = events[i];
    const action = row.action?.toLowerCase() ?? '';
    if (NOISE_ACTIONS.has(action)) continue;

    const home = row.scoreSoccer?.Participant1?.Total?.Goals;
    const away = row.scoreSoccer?.Participant2?.Total?.Goals;
    const peHome = row.scoreSoccer?.Participant1?.PE?.Goals;
    const peAway = row.scoreSoccer?.Participant2?.PE?.Goals;
    if (typeof home === 'number' || typeof away === 'number') return row;
    if (typeof peHome === 'number' || typeof peAway === 'number') return row;
  }

  for (let i = events.length - 1; i >= 0; i--) {
    const row = events[i];
    if (!NOISE_ACTIONS.has(row.action?.toLowerCase() ?? '')) return row;
  }

  return events[events.length - 1];
}

export function hasMatchFeed(
  latest: ScoreSnapshot | null,
  history: ScoreSnapshot[] = []
): boolean {
  if (history.length > 0) return true;
  if (!latest) return false;
  const action = latest.action?.toLowerCase() ?? '';
  if (action && !NOISE_ACTIONS.has(action)) return true;
  const home = latest.scoreSoccer?.Participant1?.Total?.Goals;
  const away = latest.scoreSoccer?.Participant2?.Total?.Goals;
  const peHome = latest.scoreSoccer?.Participant1?.PE?.Goals;
  const peAway = latest.scoreSoccer?.Participant2?.PE?.Goals;
  return (
    typeof home === 'number' ||
    typeof away === 'number' ||
    typeof peHome === 'number' ||
    typeof peAway === 'number'
  );
}

export function deriveMatchStatus(
  latest: ScoreSnapshot | null,
  startTimeMs: number,
  history: ScoreSnapshot[] = [],
  inRunning = false
): 'upcoming' | 'live' | 'finished' | 'unavailable' {
  const now = Date.now();

  if (!latest && history.length === 0) {
    if (startTimeMs > now) return 'upcoming';
    if (startTimeMs > 0 && startTimeMs < now - 3 * 60 * 60 * 1000) return 'unavailable';
    return 'upcoming';
  }

  if (!hasMatchFeed(latest, history)) {
    if (startTimeMs > now) return 'upcoming';
    if (startTimeMs > 0 && startTimeMs < now - 3 * 60 * 60 * 1000) return 'unavailable';
    return 'upcoming';
  }

  if (inferMatchIsLive(latest, history, inRunning)) return 'live';
  if (latest?.action?.toLowerCase() === 'game_finalised' || isMatchFinalised(history)) {
    return 'finished';
  }

  const phase = resolveEffectiveGameState(latest, history);
  if (isSoccerFinished(phase)) return 'finished';
  if (startTimeMs > now) return 'upcoming';
  if (!latest && history.length === 0 && startTimeMs > 0 && startTimeMs < now - 3 * 60 * 60 * 1000) {
    return 'unavailable';
  }
  return 'finished';
}
