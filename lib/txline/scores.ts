import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { apiBaseUrl } from '@/lib/txline/config';

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
  PlayerId?: number;
  Minutes?: number;
  Type?: string;
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
  Color?: string;
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
  const queryParams = new URLSearchParams();
  if (asOf !== undefined) {
    queryParams.set('asOf', String(asOf));
  }

  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/snapshot/${fixtureId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await axios.get<ScoreSnapshot[]>(url, { headers });
    return response.data;
  });
}

export async function getScoreUpdates(fixtureId: number) {
  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/updates/${fixtureId}`;
    const response = await axios.get<ScoreSnapshot[]>(url, { headers });
    // TxLINE may return SSE-style text (data: {...}\n event: ...).
    if (typeof response.data === 'string') {
      const text: string = response.data;
      const matches = Array.from(text.matchAll(/^data:\s*(\{[\s\S]*?\})(?:\r?\n|$)/gm)).map(m=>m[1]);
      if (matches.length > 0) {
        return matches.map((t) => {
          try { return JSON.parse(t); } catch { return { _raw: t }; }
        });
      }
      try { return JSON.parse(text); } catch { return [ { _raw: text } ]; }
    }
    return response.data;
  });
}

export async function getScoreHistorical(fixtureId: number) {
  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/scores/historical/${fixtureId}`;
    const response = await axios.get<ScoreSnapshot[]>(url, { headers });
    if (typeof response.data === 'string') {
      const text: string = response.data;
      const matches = Array.from(text.matchAll(/^data:\s*(\{[\s\S]*?\})(?:\r?\n|$)/gm)).map(m=>m[1]);
      if (matches.length > 0) {
        return matches.map((t) => {
          try { return JSON.parse(t); } catch { return { _raw: t }; }
        });
      }
      try { return JSON.parse(text); } catch { return [ { _raw: text } ]; }
    }
    return response.data;
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
    const response = await axios.get<ScoreSnapshot[]>(url, { headers });
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
    const response = await axios.get<any>(url, { headers });
    return response.data;
  });
}

/**
 * Extract current score totals for both teams
 */
export function getCurrentScore(score?: ScoreSnapshot) {
  if (!score?.scoreSoccer) return { home: 0, away: 0 };
  const home = score.scoreSoccer.Participant1.Total?.Goals ?? 0;
  const away = score.scoreSoccer.Participant2.Total?.Goals ?? 0;
  return { home, away };
}

/**
 * Extract aggregate stats for both teams
 */
export function getMatchStats(score?: ScoreSnapshot) {
  if (!score?.stats) return null;
  return {
    possession: score.possession ?? 0,
    possessionType: score.possessionType,
    stats: score.stats,
  };
}

/**
 * Extract team lineups and formation
 */
export function getTeamLineups(score?: ScoreSnapshot) {
  if (!score?.lineups) return { home: [], away: [] };
  
  return {
    home: score.lineups
      .filter((team) => team.lineups?.some((p) => p.starter))
      .flatMap((team) => team.lineups?.filter((p) => p.starter) ?? []) ?? [],
    away: score.lineups
      .filter((team) => team.lineups?.some((p) => !p.starter))
      .flatMap((team) => team.lineups?.filter((p) => !p.starter) ?? []) ?? [],
  };
}

/**
 * Format stats for display
 */
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
