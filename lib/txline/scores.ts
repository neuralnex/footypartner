import { withFreshSession } from '@/lib/txline/singleton';
import { apiBaseUrl } from '@/lib/txline/config';
import { txlineCache } from '@/lib/infra/ttlCache';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';
import { txlineHttp } from '@/lib/txline/http';
import { parseScorePayload } from '@/lib/txline/normalizeScore';

export interface SoccerScore {
  Goals: number;
  YellowCards: number;
  RedCards: number;
  Corners: number;
}

export interface SoccerData {
  Action: string;
  Goal?: boolean;
  Penalty?: boolean;
  Corner?: boolean;
  PlayerId?: number;
  Minutes?: number;
  Type?: string;
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
  Color?: string;
  GoalType?: unknown;
}

export interface PlayerData {
  id: string;
  normativeId: number;
  country: string;
  team: string;
  dateOfBirth: string;
  gender: string;
  preferredName: string;
  updateDateMillis: number;
}

export interface PlayerLineupData {
  fixturePlayerId: number;
  statusId: number;
  positionId: number;
  unitId: number;
  rosterNumber: string;
  starter: boolean;
  starred: boolean;
  player: PlayerData;
}

export interface LineupData {
  id: string;
  normativeId: number;
  preferredName: string;
  gender: string;
  updateDateMillis: number;
  lineups?: PlayerLineupData[];
}

export interface SoccerTotalScore {
  H1?: SoccerScore;
  HT?: SoccerScore;
  H2?: SoccerScore;
  ET1?: SoccerScore;
  ET2?: SoccerScore;
  PE?: SoccerScore;
  ETTotal?: SoccerScore;
  Total?: SoccerScore;
}

export interface ScoreSnapshot {
  fixtureId: number;
  gameState: string;
  startTime: number;
  isTeam: boolean;
  fixtureGroupId: number;
  competitionId: number;
  countryId: number;
  sportId: number;
  participant1IsHome: boolean;
  participant2Id: number;
  participant1Id: number;
  action: string;
  id: number;
  ts: number;
  connectionId: number;
  seq: number;
  scoreSoccer?: {
    Participant1: SoccerTotalScore;
    Participant2: SoccerTotalScore;
  };
  dataSoccer?: SoccerData;
  stats?: Record<string, number>;
  lineups?: LineupData[];
  possession?: number;
  possessionType?: string;
}

export async function getScoreSnapshot(fixtureId: number, asOf?: number) {
  const key = `scores:snapshot:${fixtureId}:${asOf ?? 'live'}`;
  const ttl = asOf ? LOAD_CONFIG.cache.scoreHistorical : LOAD_CONFIG.cache.scoreSnapshot;
  return txlineCache.getOrSet(key, ttl, () => fetchScoreSnapshot(fixtureId, asOf));
}

async function fetchScoreSnapshot(fixtureId: number, asOf?: number) {
  const queryParams = new URLSearchParams();
  if (asOf !== undefined) {
    queryParams.set('asOf', String(asOf));
  }

  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/snapshot/${fixtureId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await txlineHttp.get<unknown>(url, { headers });
    return parseScorePayload(response.data);
  });
}

export async function getScoreUpdates(fixtureId: number) {
  const key = `scores:updates:${fixtureId}`;
  return txlineCache.getOrSet(key, LOAD_CONFIG.cache.scoreUpdates, () =>
    fetchScoreUpdates(fixtureId)
  );
}

async function fetchScoreUpdates(fixtureId: number) {
  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/updates/${fixtureId}`;
    const response = await txlineHttp.get<unknown>(url, { headers });
    return parseScorePayload(response.data);
  });
}

export async function getScoreHistorical(fixtureId: number) {
  const key = `scores:historical:${fixtureId}`;
  return txlineCache.getOrSet(key, LOAD_CONFIG.cache.scoreHistorical, () =>
    fetchScoreHistorical(fixtureId)
  );
}

async function fetchScoreHistorical(fixtureId: number) {
  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/historical/${fixtureId}`;
    const response = await txlineHttp.get<unknown>(url, { headers });
    return parseScorePayload(response.data);
  });
}

export async function getScoreUpdatesInterval(
  epochDay: number,
  hourOfDay: number,
  interval: number,
  fixtureId?: number
) {
  return withFreshSession(async (headers) => {
    const queryParams = new URLSearchParams();
    if (fixtureId !== undefined) queryParams.set('fixtureId', String(fixtureId));
    const url = `${apiBaseUrl}/scores/updates/${epochDay}/${hourOfDay}/${interval}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    const response = await txlineHttp.get<ScoreSnapshot[]>(url, { headers });
    return response.data;
  });
}

export interface ScoreStatValidationOptions {
  fixtureId: number;
  seq: number;
  statKey?: number;
  statKey2?: number;
  statKeys?: string;
}

export async function getScoreStatValidation(options: ScoreStatValidationOptions) {
  return withFreshSession(async (headers) => {
    const queryParams = new URLSearchParams();
    queryParams.set('fixtureId', String(options.fixtureId));
    queryParams.set('seq', String(options.seq));
    if (options.statKey !== undefined) queryParams.set('statKey', String(options.statKey));
    if (options.statKey2 !== undefined) queryParams.set('statKey2', String(options.statKey2));
    if (options.statKeys !== undefined) queryParams.set('statKeys', options.statKeys);
    const url = `${apiBaseUrl}/scores/stat-validation${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    const response = await txlineHttp.get<any>(url, { headers });
    return response.data;
  });
}

export function getCurrentScore(score?: ScoreSnapshot) {
  if (!score?.scoreSoccer) return { home: 0, away: 0 };
  const home = score.scoreSoccer.Participant1.Total?.Goals ?? 0;
  const away = score.scoreSoccer.Participant2.Total?.Goals ?? 0;
  return { home, away };
}

export function getMatchStats(score?: ScoreSnapshot) {
  if (!score?.stats) return null;
  return {
    possession: score.possession ?? 0,
    possessionType: score.possessionType,
    stats: score.stats,
  };
}

export function getTeamLineups(score?: ScoreSnapshot) {
  if (!score?.lineups || score.lineups.length === 0) return { home: [], away: [] };

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

export function formatStats(stats: Record<string, number>) {
  const keyMap: Record<string, string> = {
    shots: 'Shots',
    shotsOnTarget: 'Shots on Target',
    passes: 'Passes',
    passAccuracy: 'Pass Accuracy',
    tackles: 'Tackles',
    interceptions: 'Interceptions',
    fouls: 'Fouls',
    offsides: 'Offsides',
  };

  return Object.entries(stats)
    .map(([key, value]) => ({
      label: keyMap[key] || key,
      value,
    }))
    .filter((s) => s.value > 0);
}
