import type { FixtureSnapshot } from '@/lib/txline/fixtures';
import type { ScoreSnapshot } from '@/lib/txline/scores';
import type { NormalizedMatchState } from '@/lib/txline/parser';
import { scoreFromSnapshot } from '@/lib/txline/gameState';
import { getEpochDay } from '@/lib/txline/dates';
import { ensureDatabase, getPool } from './pool';

export interface StoredFixtureRow {
  fixture_id: string;
  competition: string;
  start_time: string;
  home_team: string;
  away_team: string;
  participant1_is_home: boolean;
  epoch_day: number | null;
}

export interface StoredMatchDataRow {
  fixture_id: string;
  status: string;
  game_state: string | null;
  score_home: number | null;
  score_away: number | null;
  latest_snapshot: ScoreSnapshot | null;
  score_history: ScoreSnapshot[];
  odds_data: NormalizedMatchState | null;
  synced_at: string;
}

export interface FixtureUpsertInput {
  fixtureId: number;
  competition: string;
  startTime: number;
  homeTeam: string;
  awayTeam: string;
  participant1IsHome: boolean;
  epochDay?: number;
}

export interface MatchDataUpsertInput {
  fixtureId: number;
  status: 'upcoming' | 'live' | 'finished' | 'unavailable';
  latest: ScoreSnapshot | null;
  history: ScoreSnapshot[];
  odds?: NormalizedMatchState | null;
}

export async function upsertFixture(input: FixtureUpsertInput): Promise<void> {
  if (!(await ensureDatabase())) return;
  const pool = getPool();
  if (!pool) return;

  await pool.query(
    `INSERT INTO fixtures (fixture_id, competition, start_time, home_team, away_team, participant1_is_home, epoch_day, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (fixture_id) DO UPDATE SET
       competition = EXCLUDED.competition,
       start_time = EXCLUDED.start_time,
       home_team = EXCLUDED.home_team,
       away_team = EXCLUDED.away_team,
       participant1_is_home = EXCLUDED.participant1_is_home,
       epoch_day = COALESCE(EXCLUDED.epoch_day, fixtures.epoch_day),
       updated_at = NOW()`,
    [
      input.fixtureId,
      input.competition,
      input.startTime,
      input.homeTeam,
      input.awayTeam,
      input.participant1IsHome,
      input.epochDay ?? null,
    ]
  );
}

export async function upsertFixtureFromSnapshot(fixture: FixtureSnapshot, epochDay?: number): Promise<void> {
  const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
  const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
  const day = epochDay ?? getEpochDay(new Date(fixture.StartTime));

  await upsertFixture({
    fixtureId: fixture.FixtureId,
    competition: fixture.Competition,
    startTime: fixture.StartTime,
    homeTeam: home,
    awayTeam: away,
    participant1IsHome: fixture.Participant1IsHome,
    epochDay: day,
  });
}

export async function upsertMatchData(input: MatchDataUpsertInput): Promise<void> {
  if (!(await ensureDatabase())) return;
  const pool = getPool();
  if (!pool) return;

  const score = scoreFromSnapshot(input.latest ?? undefined);
  const history = input.history.length > 0 ? input.history : input.latest ? [input.latest] : [];

  await pool.query(
    `INSERT INTO fixture_match_data (
       fixture_id, status, game_state, score_home, score_away,
       latest_snapshot, score_history, odds_data, synced_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
     ON CONFLICT (fixture_id) DO UPDATE SET
       status = EXCLUDED.status,
       game_state = EXCLUDED.game_state,
       score_home = EXCLUDED.score_home,
       score_away = EXCLUDED.score_away,
       latest_snapshot = EXCLUDED.latest_snapshot,
       score_history = CASE
         WHEN jsonb_array_length(EXCLUDED.score_history) >= jsonb_array_length(fixture_match_data.score_history)
         THEN EXCLUDED.score_history
         ELSE fixture_match_data.score_history
       END,
       odds_data = COALESCE(EXCLUDED.odds_data, fixture_match_data.odds_data),
       synced_at = NOW()`,
    [
      input.fixtureId,
      input.status,
      input.latest?.gameState ?? null,
      input.latest ? score.home : null,
      input.latest ? score.away : null,
      input.latest ? JSON.stringify(input.latest) : null,
      JSON.stringify(history),
      input.odds ? JSON.stringify(input.odds) : null,
    ]
  );
}

export async function getMatchData(fixtureId: number): Promise<StoredMatchDataRow | null> {
  if (!(await ensureDatabase())) return null;
  const pool = getPool();
  if (!pool) return null;

  const result = await pool.query(
    `SELECT fixture_id, status, game_state, score_home, score_away,
            latest_snapshot, score_history, odds_data, synced_at
     FROM fixture_match_data
     WHERE fixture_id = $1`,
    [fixtureId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    fixture_id: String(row.fixture_id),
    status: row.status,
    game_state: row.game_state,
    score_home: row.score_home,
    score_away: row.score_away,
    latest_snapshot: row.latest_snapshot as ScoreSnapshot | null,
    score_history: (row.score_history ?? []) as ScoreSnapshot[],
    odds_data: row.odds_data as NormalizedMatchState | null,
    synced_at: row.synced_at,
  };
}

export async function getBoardRowsForEpochDay(epochDay: number): Promise<
  Array<StoredFixtureRow & { match: StoredMatchDataRow | null }>
> {
  if (!(await ensureDatabase())) return [];
  const pool = getPool();
  if (!pool) return [];

  const result = await pool.query(
    `SELECT f.fixture_id, f.competition, f.start_time, f.home_team, f.away_team,
            f.participant1_is_home, f.epoch_day,
            m.status, m.game_state, m.score_home, m.score_away,
            m.latest_snapshot, m.score_history, m.odds_data, m.synced_at
     FROM fixtures f
     LEFT JOIN fixture_match_data m ON m.fixture_id = f.fixture_id
     WHERE f.epoch_day = $1
     ORDER BY f.start_time ASC`,
    [epochDay]
  );

  return result.rows.map((row) => ({
    fixture_id: String(row.fixture_id),
    competition: row.competition,
    start_time: String(row.start_time),
    home_team: row.home_team,
    away_team: row.away_team,
    participant1_is_home: row.participant1_is_home,
    epoch_day: row.epoch_day,
    match: row.status
      ? {
          fixture_id: String(row.fixture_id),
          status: row.status,
          game_state: row.game_state,
          score_home: row.score_home,
          score_away: row.score_away,
          latest_snapshot: row.latest_snapshot as ScoreSnapshot | null,
          score_history: (row.score_history ?? []) as ScoreSnapshot[],
          odds_data: row.odds_data as NormalizedMatchState | null,
          synced_at: row.synced_at,
        }
      : null,
  }));
}
