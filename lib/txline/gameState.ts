import type { ScoreSnapshot } from './scores';

export const GAME_PHASE_ORDER: Record<string, number> = {
  NS: 1,
  H1: 2,
  HT: 3,
  H2: 4,
  F: 5,
  WET: 6,
  ET1: 7,
  HTET: 8,
  ET2: 9,
  FET: 10,
  WPE: 11,
  PE: 12,
  FPE: 13,
  I: 14,
  A: 15,
  C: 16,
  TXCC: 17,
  TXCS: 18,
  P: 19,
};

export const STATUS_ID_TO_PHASE: Record<number, string> = {
  1: 'NS',
  2: 'H1',
  3: 'HT',
  4: 'H2',
  5: 'F',
  6: 'WET',
  7: 'ET1',
  8: 'HTET',
  9: 'ET2',
  10: 'FET',
  11: 'WPE',
  12: 'PE',
  13: 'FPE',
  14: 'I',
  15: 'A',
  16: 'C',
  17: 'TXCC',
  18: 'TXCS',
  19: 'P',
};

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
]);

const FINISHED_STATES = new Set(['F', 'FET', 'FPE', 'END', 'A', 'C', 'TXCC', 'TXCS', 'P', 'WO']);

const EXTRA_TIME_STATES = new Set(['WET', 'ET1', 'HTET', 'ET2', 'FET']);

const PENALTY_STATES = new Set(['WPE', 'PE', 'FPE']);

const PREMATCH_STATES = new Set(['NS', 'PRE_MATCH', 'PREMATCH', 'SCHEDULED']);

const STATE_LABELS: Record<string, string> = {
  NS: 'Not started',
  H1: '1st half',
  HT: 'Half time',
  H2: '2nd half',
  F: 'Full time',
  END: 'Full time',
  WET: 'Waiting for extra time',
  ET1: 'Extra time — 1st half',
  HTET: 'Extra time — half time',
  ET2: 'Extra time — 2nd half',
  FET: 'After extra time',
  WPE: 'Waiting for penalties',
  PE: 'Penalty shootout',
  FPE: 'After penalties',
  I: 'Interrupted',
  A: 'Abandoned',
  C: 'Cancelled',
  P: 'Postponed',
  TXCC: 'Coverage cancelled',
  TXCS: 'Coverage suspended',
};

const END_SHORT_LABELS: Record<string, 'FT' | 'AET' | 'Pens'> = {
  F: 'FT',
  FET: 'AET',
  FPE: 'Pens',
};

export function normalizePhase(gameState?: string | null): string {
  const raw = String(gameState ?? '').trim().toUpperCase();
  if (!raw || raw === 'SCHEDULED' || raw === 'PRE_MATCH' || raw === 'PREMATCH') return 'NS';
  return raw;
}

export function phaseFromStatusId(statusId: unknown): string | null {
  if (typeof statusId !== 'number' || !Number.isFinite(statusId)) return null;
  return STATUS_ID_TO_PHASE[statusId] ?? null;
}

export function isSoccerLive(gameState?: string | null): boolean {
  return LIVE_STATES.has(normalizePhase(gameState));
}

export function isSoccerFinished(gameState?: string | null): boolean {
  return FINISHED_STATES.has(normalizePhase(gameState));
}

export function isMatchFinalised(history: ScoreSnapshot[]): boolean {
  return history.some((row) => {
    const action = row.action?.toLowerCase();
    return action === 'game_finalised' || action === 'match_ended';
  });
}

export function resolveEffectiveGameState(
  latest?: ScoreSnapshot | null,
  history: ScoreSnapshot[] = []
): string {
  const finalised =
    isMatchFinalised(history) || latest?.action?.toLowerCase() === 'game_finalised';

  const rows = [...history];
  if (latest && !rows.some((row) => row.seq === latest.seq)) {
    rows.push(latest);
  }

  if (finalised) {
    if (snapshotHadPenalties(latest) || rows.some((row) => snapshotHadPenalties(row))) {
      return 'FPE';
    }
    if (
      phaseWentToExtraTime('F', rows) ||
      snapshotWentToExtraTime(latest) ||
      rows.some((row) => snapshotWentToExtraTime(row))
    ) {
      return 'FET';
    }
    for (const terminal of ['FPE', 'FET', 'F']) {
      if (rows.some((row) => normalizePhase(row.gameState) === terminal)) {
        return terminal;
      }
    }
    return 'F';
  }

  if (!finalised) {
    if (snapshotHadPenalties(latest)) return 'PE';
  }

  for (let i = rows.length - 1; i >= 0; i--) {
    const phase = normalizePhase(rows[i].gameState);
    if (!phase || phase === 'NS') continue;
    if (phase === 'F') continue;
    return phase;
  }

  const latestPhase = normalizePhase(latest?.gameState);
  if (latestPhase && latestPhase !== 'F') return latestPhase;
  return 'NS';
}

export function inferMatchIsLive(
  latest?: ScoreSnapshot | null,
  history: ScoreSnapshot[] = [],
  inRunning = false
): boolean {
  if (inRunning) return true;
  if (isMatchFinalised(history)) return false;
  if (latest?.action?.toLowerCase() === 'game_finalised') return false;

  const phase = resolveEffectiveGameState(latest, history);
  if (PREMATCH_STATES.has(phase)) return false;
  if (isSoccerFinished(phase)) return false;
  return isSoccerLive(phase);
}

export function phaseWentToExtraTime(phase: string, history: ScoreSnapshot[] = []): boolean {
  if (EXTRA_TIME_STATES.has(normalizePhase(phase))) return true;
  return history.some((row) => EXTRA_TIME_STATES.has(normalizePhase(row.gameState)));
}

export function phaseHadPenalties(phase: string, history: ScoreSnapshot[] = []): boolean {
  if (PENALTY_STATES.has(normalizePhase(phase))) return true;
  if (history.some((row) => PENALTY_STATES.has(normalizePhase(row.gameState)))) return true;
  return history.some((row) => snapshotHadPenalties(row));
}

export function snapshotHadPenalties(score?: ScoreSnapshot | null): boolean {
  if (!score?.scoreSoccer) return false;
  const pe1 = score.scoreSoccer.Participant1?.PE?.Goals;
  const pe2 = score.scoreSoccer.Participant2?.PE?.Goals;
  return (
    (typeof pe1 === 'number' && pe1 > 0) ||
    (typeof pe2 === 'number' && pe2 > 0)
  );
}

export function snapshotWentToExtraTime(score?: ScoreSnapshot | null): boolean {
  if (!score?.scoreSoccer) return false;
  const p1 = score.scoreSoccer.Participant1;
  const p2 = score.scoreSoccer.Participant2;
  return Boolean(p1?.ET1 || p1?.ET2 || p1?.ETTotal || p2?.ET1 || p2?.ET2 || p2?.ETTotal);
}

export function resolveEndLabel(
  latest?: ScoreSnapshot | null,
  history: ScoreSnapshot[] = []
): 'FT' | 'AET' | 'Pens' | null {
  const phase = resolveEffectiveGameState(latest, history);
  return END_SHORT_LABELS[phase] ?? null;
}

export function formatGameState(gameState?: string | null): string {
  const phase = normalizePhase(gameState);
  if (phase === 'NS' && !gameState) return '';
  return STATE_LABELS[phase] ?? phase;
}

export function formatMatchEndLabel(
  latest?: ScoreSnapshot | null,
  history: ScoreSnapshot[] = []
): string {
  const phase = resolveEffectiveGameState(latest, history);
  return STATE_LABELS[phase] ?? '';
}

export function formatMatchMinute(
  latest?: ScoreSnapshot | null,
  history: ScoreSnapshot[] = []
): string {
  if (!latest) return '';

  const phase = resolveEffectiveGameState(latest, history);
  const minutes = latest.dataSoccer?.Minutes;

  if (isSoccerLive(phase)) {
    if (typeof minutes === 'number' && minutes >= 0) return `${minutes}'`;
    if (phase === 'HT' || phase === 'HTET') return 'HT';
    if (phase === 'PE') return 'Pens';
    return formatGameState(phase);
  }

  if (phase === 'HT' || phase === 'HTET') return 'HT';
  if (phase === 'PE' || phase === 'WPE') return 'Pens';
  if (phase === 'WET') return 'ET soon';

  const end = resolveEndLabel(latest, history);
  if (end) return end;

  if (PREMATCH_STATES.has(phase)) return '';
  if (typeof minutes === 'number' && minutes >= 0) return `${minutes}'`;
  return formatGameState(phase);
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
  if (
    action &&
    ![
      'possession',
      'safe_possession',
      'attack_possession',
      'danger_possession',
      'clock_adjustment',
      'status',
    ].includes(action)
  ) {
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

export function hasScoreData(score?: ScoreSnapshot | null): boolean {
  if (!score?.scoreSoccer) return false;
  const p1 = score.scoreSoccer.Participant1?.Total?.Goals;
  const p2 = score.scoreSoccer.Participant2?.Total?.Goals;
  const pe1 = score.scoreSoccer.Participant1?.PE?.Goals;
  const pe2 = score.scoreSoccer.Participant2?.PE?.Goals;
  return (
    typeof p1 === 'number' ||
    typeof p2 === 'number' ||
    typeof pe1 === 'number' ||
    typeof pe2 === 'number'
  );
}

export interface MatchScoreline {
  home: number;
  away: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  homeCorners: number;
  awayCorners: number;
}

export function scoreFromSnapshot(score?: ScoreSnapshot | null): MatchScoreline | null {
  if (!hasScoreData(score)) return null;
  const p1 = score!.scoreSoccer!.Participant1;
  const p2 = score!.scoreSoccer!.Participant2;
  const pens =
    (typeof p1.PE?.Goals === 'number' && p1.PE.Goals > 0) ||
    (typeof p2.PE?.Goals === 'number' && p2.PE.Goals > 0);

  const homeGoals = pens ? (p1.PE?.Goals ?? 0) : (p1.Total?.Goals ?? 0);
  const awayGoals = pens ? (p2.PE?.Goals ?? 0) : (p2.Total?.Goals ?? 0);
  const homeStats = pens ? p1.PE : p1.Total;
  const awayStats = pens ? p2.PE : p2.Total;

  return {
    home: homeGoals,
    away: awayGoals,
    homeYellows: homeStats?.YellowCards ?? p1.Total?.YellowCards ?? 0,
    awayYellows: awayStats?.YellowCards ?? p2.Total?.YellowCards ?? 0,
    homeReds: homeStats?.RedCards ?? p1.Total?.RedCards ?? 0,
    awayReds: awayStats?.RedCards ?? p2.Total?.RedCards ?? 0,
    homeCorners: homeStats?.Corners ?? p1.Total?.Corners ?? 0,
    awayCorners: awayStats?.Corners ?? p2.Total?.Corners ?? 0,
  };
}
