import type { ScoreSnapshot } from './scores';

const LIVE_STATES = new Set([
  'H1',
  'HT',
  'H2',
  'WET',
  'ET1',
  'HTET',
  'ET2',
  'WPE',
  'PE',
  'I',
  'LIVE',
  'IN_PLAY',
]);

const FINISHED_STATES = new Set([
  'F',
  'FET',
  'FPE',
  'END',
  'A',
  'C',
  'TXCC',
  'TXCS',
  'P',
  'WO',
]);

const PREMATCH_STATES = new Set(['NS', 'PRE_MATCH', 'PREMATCH']);

const STATE_LABELS: Record<string, string> = {
  NS: 'Not started',
  H1: '1st half',
  HT: 'Half time',
  H2: '2nd half',
  F: 'Full time',
  END: 'Full time',
  WET: 'Waiting for ET',
  ET1: 'ET 1st half',
  HTET: 'ET half time',
  ET2: 'ET 2nd half',
  FET: 'After extra time',
  WPE: 'Waiting for pens',
  PE: 'Penalties',
  FPE: 'After penalties',
  I: 'Interrupted',
  A: 'Abandoned',
  C: 'Cancelled',
  P: 'Postponed',
  TXCC: 'Coverage cancelled',
  TXCS: 'Coverage suspended',
};

export function isSoccerLive(gameState?: string | null): boolean {
  if (!gameState) return false;
  const normalized = gameState.toUpperCase();
  if (FINISHED_STATES.has(normalized)) return false;
  if (PREMATCH_STATES.has(normalized)) return false;
  return LIVE_STATES.has(normalized);
}

export function isSoccerFinished(gameState?: string | null): boolean {
  if (!gameState) return false;
  return FINISHED_STATES.has(gameState.toUpperCase());
}

export function formatGameState(gameState?: string | null): string {
  if (!gameState) return '—';
  return STATE_LABELS[gameState.toUpperCase()] ?? gameState;
}

export function wentToExtraTime(
  score?: ScoreSnapshot | null,
  history?: ScoreSnapshot[]
): boolean {
  const p1 = score?.scoreSoccer?.Participant1;
  const p2 = score?.scoreSoccer?.Participant2;
  const etGoals =
    (p1?.ET1?.Goals ?? 0) +
    (p1?.ET2?.Goals ?? 0) +
    (p2?.ET1?.Goals ?? 0) +
    (p2?.ET2?.Goals ?? 0);
  if (etGoals > 0) return true;

  const etStates = new Set(['ET1', 'ET2', 'HTET', 'WET', 'FET']);
  if (history?.some((row) => etStates.has(String(row.gameState ?? '').toUpperCase()))) {
    return true;
  }

  const maxMinute = Math.max(0, ...(history ?? []).map((row) => row.dataSoccer?.Minutes ?? 0));
  return maxMinute > 95;
}

export function hadPenaltyShootout(score?: ScoreSnapshot | null, history?: ScoreSnapshot[]): boolean {
  const p1 = score?.scoreSoccer?.Participant1;
  const p2 = score?.scoreSoccer?.Participant2;
  if ((p1?.PE?.Goals ?? 0) > 0 || (p2?.PE?.Goals ?? 0) > 0) return true;
  return history?.some((row) => String(row.gameState ?? '').toUpperCase() === 'PE') ?? false;
}

export function resolveEndLabel(
  score?: ScoreSnapshot | null,
  history?: ScoreSnapshot[]
): 'FT' | 'AET' | 'Pens' {
  if (hadPenaltyShootout(score, history)) return 'Pens';
  if (wentToExtraTime(score, history)) return 'AET';
  return 'FT';
}

export function formatMatchEndLabel(
  score?: ScoreSnapshot | null,
  history?: ScoreSnapshot[]
): string {
  const state = score?.gameState?.toUpperCase();
  if (state === 'FPE') return 'After penalties';
  if (state === 'FET') return 'After extra time';
  if (isSoccerFinished(state) || score?.action?.toLowerCase() === 'game_finalised') {
    const label = resolveEndLabel(score, history);
    if (label === 'Pens') return 'After penalties';
    if (label === 'AET') return 'After extra time';
    return 'Full time';
  }
  return formatGameState(state);
}

export function formatMatchMinute(
  score?: ScoreSnapshot | null,
  history?: ScoreSnapshot[]
): string {
  if (!score) return "0'";
  const state = score.gameState?.toUpperCase();
  const minutes = score.dataSoccer?.Minutes;

  if (typeof minutes === 'number' && minutes >= 0) {
    if (isSoccerLive(state)) return `${minutes}'`;
    if (!isSoccerFinished(state) && score.action?.toLowerCase() !== 'game_finalised') {
      return `${minutes}'`;
    }
  }

  if (state === 'HT' || state === 'HTET') return 'HT';
  if (state === 'PE') return 'Pens';
  if (isSoccerFinished(state) || score.action?.toLowerCase() === 'game_finalised') {
    return resolveEndLabel(score, history);
  }
  if (PREMATCH_STATES.has(state ?? '')) return '—';
  if (typeof minutes === 'number' && minutes >= 0) return `${minutes}'`;
  return '—';
}

export function describeScoreEvent(score: ScoreSnapshot): string {
  const data = score.dataSoccer;
  const action = score.action?.toLowerCase() ?? '';

  if (data?.Goal || action === 'goal') {
    const type = data?.GoalType ? ` (${String(data.GoalType)})` : '';
    return `Goal${type}`;
  }
  if (data?.RedCard || action === 'red_card') return 'Red card';
  if (data?.YellowCard || action === 'yellow_card') return 'Yellow card';
  if (data?.Corner || action === 'corner') return 'Corner';
  if (data?.Penalty || action === 'penalty') return 'Penalty';
  if (data?.VAR || action === 'var') return 'VAR check';
  if (action === 'game_finalised' || action === 'match_ended') return 'Full time';
  if (action === 'kickoff') return 'Kick off';
  if (action === 'lineups') return 'Lineups confirmed';
  if (data?.Action) return data.Action;
  if (data?.Type) return data.Type;
  if (action && !['possession', 'safe_possession', 'attack_possession', 'danger_possession', 'clock_adjustment', 'status'].includes(action)) {
    return action.replace(/_/g, ' ');
  }
  return '';
}

import type { PlayerLineupData } from './scores';

export function extractLineups(score?: ScoreSnapshot | null): {
  home: PlayerLineupData[];
  away: PlayerLineupData[];
} {
  const empty = { home: [] as PlayerLineupData[], away: [] as PlayerLineupData[] };
  if (!score?.lineups || score.lineups.length === 0) return empty;

  const [first, second] = score.lineups;
  if (score.participant1IsHome) {
    return {
      home: first?.lineups ?? [],
      away: second?.lineups ?? [],
    };
  }
  return {
    home: second?.lineups ?? [],
    away: first?.lineups ?? [],
  };
}

export function scoreFromSnapshot(score?: ScoreSnapshot | null) {
  if (!score?.scoreSoccer) {
    return { home: 0, away: 0, homeYellows: 0, awayYellows: 0, homeReds: 0, awayReds: 0, homeCorners: 0, awayCorners: 0 };
  }
  const p1 = score.scoreSoccer.Participant1.Total;
  const p2 = score.scoreSoccer.Participant2.Total;
  return {
    home: p1?.Goals ?? 0,
    away: p2?.Goals ?? 0,
    homeYellows: p1?.YellowCards ?? 0,
    awayYellows: p2?.YellowCards ?? 0,
    homeReds: p1?.RedCards ?? 0,
    awayReds: p2?.RedCards ?? 0,
    homeCorners: p1?.Corners ?? 0,
    awayCorners: p2?.Corners ?? 0,
  };
}
