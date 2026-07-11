
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const LOAD_CONFIG = {

  cache: {
    scoreSnapshot: envInt('CACHE_SCORE_SNAPSHOT_MS', 5_000),
    scoreUpdates: envInt('CACHE_SCORE_UPDATES_MS', 5_000),
    scoreHistorical: envInt('CACHE_SCORE_HISTORICAL_MS', 3_600_000),
    oddsSnapshot: envInt('CACHE_ODDS_SNAPSHOT_MS', 30_000),
    oddsUpdates: envInt('CACHE_ODDS_UPDATES_MS', 30_000),
    fixturesDay: envInt('CACHE_FIXTURES_DAY_MS', 300_000),
    fixturesDayPast: envInt('CACHE_FIXTURES_DAY_PAST_MS', 3_600_000),
    fixtureSnapshot: envInt('CACHE_FIXTURE_SNAPSHOT_MS', 120_000),
    boardLive: envInt('CACHE_BOARD_LIVE_MS', 15_000),
    boardDefault: envInt('CACHE_BOARD_DEFAULT_MS', 30_000),
    boardArchive: envInt('CACHE_BOARD_ARCHIVE_MS', 300_000),
  },

  rateLimit: {
    windowMs: envInt('RATE_LIMIT_WINDOW_MS', 60_000),
    apiDefault: envInt('RATE_LIMIT_API_PER_MIN', 120),
    board: envInt('RATE_LIMIT_BOARD_PER_MIN', 40),
    streamConnect: envInt('RATE_LIMIT_STREAM_CONNECT_PER_MIN', 20),
    chat: envInt('RATE_LIMIT_CHAT_PER_MIN', 15),
    maxConcurrentStreamsPerIp: envInt('RATE_LIMIT_MAX_STREAMS_PER_IP', 3),
  },

  hub: {
    maxChannels: envInt('HUB_MAX_CHANNELS', 32),
    maxSubscribersPerChannel: envInt('HUB_MAX_SUBSCRIBERS', 200),
    idleShutdownMs: envInt('HUB_IDLE_SHUTDOWN_MS', 90_000),
    scoresPollMs: envInt('HUB_SCORES_POLL_MS', 15_000),
    oddsPollMs: envInt('HUB_ODDS_POLL_MS', 30_000),
  },

  boardConcurrency: envInt('BOARD_SCORE_FETCH_CONCURRENCY', 4),

  cacheMaxEntries: envInt('CACHE_MAX_ENTRIES', 2_000),

  /** When false (default), live data flows TxLINE → SSE only; DB is not written on every tick. */
  archiveToDb: process.env.ARCHIVE_TO_DB === 'true',
} as const;
