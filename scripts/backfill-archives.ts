import { WC_2026_START_EPOCH_DAY, WC_2026_DURATION_DAYS } from '../lib/txline/dates';
import { getWorldCupFixturesForDay } from '../lib/txline/fixtures';
import { resolveMatchData } from '../lib/match/resolveMatchData';
import { ensureDatabase } from '../lib/db/pool';
import { mapWithConcurrency } from '../lib/infra/concurrency';

async function main() {
  const dbOk = await ensureDatabase();
  console.log('database:', dbOk ? 'ready' : 'disabled');

  let total = 0;
  let filled = 0;
  let unavailable = 0;
  let empty = 0;
  let failed = 0;

  for (let day = WC_2026_START_EPOCH_DAY; day < WC_2026_START_EPOCH_DAY + WC_2026_DURATION_DAYS; day++) {
    const fixtures = await getWorldCupFixturesForDay(day);
    const past = fixtures.filter((f) => f.StartTime < Date.now() - 30 * 60_000);

    await mapWithConcurrency(past, 3, async (fixture) => {
      total++;
      const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
      const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;

      try {
        const resolved = await resolveMatchData(fixture.FixtureId, {
          startTimeMs: fixture.StartTime,
          competition: fixture.Competition,
          homeTeam: home,
          awayTeam: away,
          participant1IsHome: fixture.Participant1IsHome,
          epochDay: day,
          forceRefresh: true,
          fetchOdds: false,
        });

        if (resolved.status === 'unavailable') unavailable++;
        else if (resolved.latest || resolved.history.length > 0) filled++;
        else empty++;
      } catch (err) {
        failed++;
        console.error(`fixture ${fixture.FixtureId} failed:`, err);
      }
    });

    console.log(`epoch day ${day}: processed ${past.length} past fixtures`);
  }

  console.log(JSON.stringify({ total, filled, unavailable, empty, failed }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
