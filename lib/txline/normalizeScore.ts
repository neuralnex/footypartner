import type { ScoreSnapshot, SoccerData, SoccerScore, SoccerTotalScore } from './scores';
import { isSoccerFinished, isSoccerLive } from './gameState';

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

function inferGameState(raw: RawScoreEvent): string {
  const explicit = String(raw.gameState ?? raw.GameState ?? '').trim();
  const action = String(raw.action ?? raw.Action ?? '').toLowerCase();

  if (action === 'game_finalised' || action === 'match_ended') return 'F';
  if (explicit && explicit.toLowerCase() !== 'scheduled') return explicit.toUpperCase();

  const clock = asRecord(raw.Clock);
  const statusId = raw.StatusId ?? raw.statusId;
  if (statusId === 4 || statusId === 5) return 'F';
  if (clock?.Running === false && typeof clock.Seconds === 'number' && clock.Seconds >= 5400) {
    return 'F';
  }
  if (clock?.Running === true) {
    const seconds = typeof clock.Seconds === 'number' ? clock.Seconds : 0;
    const minutes = Math.floor(seconds / 60);
    if (minutes <= 45) return 'H1';
    if (minutes <= 90) return 'H2';
    return 'ET2';
  }

  return explicit ? explicit.toUpperCase() : 'NS';
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

export function pickLatestScore(events: ScoreSnapshot[]): ScoreSnapshot | null {
  if (events.length === 0) return null;

  for (let i = events.length - 1; i >= 0; i--) {
    const row = events[i];
    const action = row.action?.toLowerCase();
    if (action === 'game_finalised' || action === 'match_ended') return row;
  }

  for (let i = events.length - 1; i >= 0; i--) {
    const row = events[i];
    const home = row.scoreSoccer?.Participant1?.Total?.Goals;
    const away = row.scoreSoccer?.Participant2?.Total?.Goals;
    if (typeof home === 'number' || typeof away === 'number') return row;
  }

  return events[events.length - 1];
}

export function deriveMatchStatus(
  latest: ScoreSnapshot | null,
  startTimeMs: number,
  history: ScoreSnapshot[] = []
): 'upcoming' | 'live' | 'finished' | 'unavailable' {
  const now = Date.now();
  if (!latest) {
    if (startTimeMs > now) return 'upcoming';
    if (startTimeMs < now - 3 * 60 * 60 * 1000 && history.length === 0) return 'unavailable';
    return 'finished';
  }
  if (isSoccerLive(latest.gameState)) return 'live';
  if (isSoccerFinished(latest.gameState)) return 'finished';
  if (latest.action?.toLowerCase() === 'game_finalised') return 'finished';
  return startTimeMs > now ? 'upcoming' : 'finished';
}
