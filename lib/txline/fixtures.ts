import { withFreshSession } from '@/lib/txline/singleton';
import { apiBaseUrl } from '@/lib/txline/config';
import { fixtureStartsOnEpochDay, getEpochDay, getTxlineEpochDaysForUserDay, resolveUserTimeZone } from '@/lib/txline/dates';
import { txlineCache } from '@/lib/infra/ttlCache';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';
import { txlineHttp } from '@/lib/txline/http';
import { getStoredFixture } from '@/lib/db/fixtureStore';

export interface FixtureSnapshot {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

export interface FixtureSnapshotQuery {
  startEpochDay?: number;
  competitionId?: number;
}

export async function getFixtureSnapshot(query: FixtureSnapshotQuery = {}) {
  const key = `fixtures:snapshot:${query.startEpochDay ?? 'all'}:${query.competitionId ?? 'all'}`;
  return txlineCache.getOrSet(key, LOAD_CONFIG.cache.fixtureSnapshot, () =>
    fetchFixtureSnapshot(query)
  );
}

async function fetchFixtureSnapshot(query: FixtureSnapshotQuery = {}) {
  const queryParams = new URLSearchParams();
  if (query.startEpochDay !== undefined) {
    queryParams.set('startEpochDay', String(query.startEpochDay));
  }
  if (query.competitionId !== undefined) {
    queryParams.set('competitionId', String(query.competitionId));
  }

  return withFreshSession(async (headers) => {
    const url = `${apiBaseUrl}/fixtures/snapshot${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await txlineHttp.get<FixtureSnapshot[]>(url, { headers });
    return response.data;
  });
}

function storedRowToFixtureSnapshot(row: {
  fixture_id: string;
  competition: string;
  start_time: string;
  home_team: string;
  away_team: string;
  participant1_is_home: boolean;
}): FixtureSnapshot {
  const homeId = row.participant1_is_home ? 1 : 2;
  const awayId = row.participant1_is_home ? 2 : 1;
  return {
    Ts: Date.now(),
    StartTime: Number(row.start_time),
    Competition: row.competition,
    CompetitionId: 0,
    FixtureGroupId: 0,
    Participant1Id: homeId,
    Participant1: row.participant1_is_home ? row.home_team : row.away_team,
    Participant2Id: awayId,
    Participant2: row.participant1_is_home ? row.away_team : row.home_team,
    FixtureId: Number(row.fixture_id),
    Participant1IsHome: row.participant1_is_home,
  };
}

export async function getFixtureById(fixtureId: number, opts?: { epochDay?: number }) {
  const fixtures = await getFixtureSnapshot();
  const fromSnapshot = fixtures.find((fixture) => fixture.FixtureId === fixtureId);
  if (fromSnapshot) return fromSnapshot;

  if (opts?.epochDay != null) {
    const dayFixtures = await getWorldCupFixturesForDay(opts.epochDay);
    const fromDay = dayFixtures.find((fixture) => fixture.FixtureId === fixtureId);
    if (fromDay) return fromDay;
  }

  const stored = await getStoredFixture(fixtureId);
  if (stored) {
    if (stored.epoch_day != null) {
      const dayFixtures = await getWorldCupFixturesForDay(stored.epoch_day);
      const fromDay = dayFixtures.find((fixture) => fixture.FixtureId === fixtureId);
      if (fromDay) return fromDay;
    }
    return storedRowToFixtureSnapshot(stored);
  }

  return null;
}

function dedupeFixtures(fixtures: FixtureSnapshot[]): FixtureSnapshot[] {
  const byId = new Map<number, FixtureSnapshot>();
  for (const fixture of fixtures) {
    const existing = byId.get(fixture.FixtureId);
    if (!existing || fixture.Ts > existing.Ts) {
      byId.set(fixture.FixtureId, fixture);
    }
  }
  return [...byId.values()];
}

export async function getFixtureUpdatesForDay(userEpochDay: number): Promise<FixtureSnapshot[]> {
  const today = getEpochDay(new Date());
  const ttl =
    userEpochDay < today ? LOAD_CONFIG.cache.fixturesDayPast : LOAD_CONFIG.cache.fixturesDay;
  const key = `fixtures:day-updates:${userEpochDay}`;
  return txlineCache.getOrSet(key, ttl, () => fetchFixtureUpdatesForUserDay(userEpochDay));
}

async function fetchFixtureUpdatesForUserDay(userEpochDay: number): Promise<FixtureSnapshot[]> {
  const txlineDays = getTxlineEpochDaysForUserDay(userEpochDay);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  const batches = await withFreshSession(async (headers) =>
    Promise.all(
      txlineDays.flatMap((epochDay) =>
        hours.map((hour) =>
          txlineHttp
            .get<FixtureSnapshot[]>(`${apiBaseUrl}/fixtures/updates/${epochDay}/${hour}`, {
              headers,
            })
            .then((response) => response.data)
            .catch(() => [] as FixtureSnapshot[])
        )
      )
    )
  );

  return dedupeFixtures(batches.flat());
}

export async function getWorldCupFixturesForDay(
  userEpochDay: number,
  userTimeZone?: string
): Promise<FixtureSnapshot[]> {
  const tz = resolveUserTimeZone(userTimeZone);
  const txlineDays = getTxlineEpochDaysForUserDay(userEpochDay);
  const snapshotBatches = await Promise.all(
    txlineDays.map((day) => getFixtureSnapshot({ startEpochDay: day }))
  );
  const historicalFixtures = await getFixtureUpdatesForDay(userEpochDay);

  const merged = dedupeFixtures([...snapshotBatches.flat(), ...historicalFixtures]);

  return merged
    .filter(
      (fixture) =>
        /world cup/i.test(String(fixture.Competition || '')) &&
        fixtureStartsOnEpochDay(fixture.StartTime, userEpochDay, tz)
    )
    .sort((a, b) => a.StartTime - b.StartTime);
}
