import { Pool } from 'pg';

declare global {
  var __fpPgPool: Pool | undefined;
  var __fpPgReady: Promise<boolean> | undefined;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS fixtures (
  fixture_id BIGINT PRIMARY KEY,
  competition TEXT NOT NULL DEFAULT '',
  start_time BIGINT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  participant1_is_home BOOLEAN NOT NULL DEFAULT TRUE,
  epoch_day INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fixture_match_data (
  fixture_id BIGINT PRIMARY KEY REFERENCES fixtures(fixture_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unknown',
  game_state TEXT,
  score_home INTEGER,
  score_away INTEGER,
  latest_snapshot JSONB,
  score_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  odds_data JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fixtures_epoch_day_idx ON fixtures(epoch_day);
CREATE INDEX IF NOT EXISTS fixtures_start_time_idx ON fixtures(start_time);
CREATE INDEX IF NOT EXISTS fixture_match_data_status_idx ON fixture_match_data(status);
`;

export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  if (!globalThis.__fpPgPool) {
    globalThis.__fpPgPool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    });
  }

  return globalThis.__fpPgPool;
}

export async function ensureDatabase(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;

  if (!globalThis.__fpPgReady) {
    globalThis.__fpPgReady = pool
      .query(SCHEMA_SQL)
      .then(() => true)
      .catch((err) => {
        console.error('[db] unavailable:', err instanceof Error ? err.message : err);
        return false;
      });
  }

  return globalThis.__fpPgReady;
}
