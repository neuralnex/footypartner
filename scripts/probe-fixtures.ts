import { getWorldCupFixturesForDay } from '../lib/txline/fixtures';
import { getScoreSnapshot, getScoreHistorical, getScoreUpdates } from '../lib/txline/scores';
import { getOddsSnapshot } from '../lib/txline/odds';
import { WC_2026_START_EPOCH_DAY, getEpochDay } from '../lib/txline/dates';
import { pickLatestScore } from '../lib/txline/normalizeScore';
import { resolveEffectiveGameState, resolveEndLabel } from '../lib/txline/gameState';

const END = getEpochDay(new Date('2026-07-09T12:00:00Z'));

async function probeFixture(id: number, label: string) {
  const [snap, hist, updates, odds] = await Promise.all([
    getScoreSnapshot(id).catch(() => []),
    getScoreHistorical(id).catch(() => []),
    getScoreUpdates(id).catch(() => []),
    getOddsSnapshot(id).catch(() => []),
  ]);
  const history = hist.length > 0 ? hist : updates.length > 0 ? updates : snap;
  const latest = pickLatestScore(history);
  const phases = [...new Set(history.map((h) => h.gameState).filter(Boolean))];
  const end = latest ? resolveEndLabel(latest, history) : null;
  const phase = latest ? resolveEffectiveGameState(latest, history) : null;
  console.log(`\n${label} #${id}`);
  console.log(`  snap=${snap.length} hist=${hist.length} updates=${updates.length} odds=${odds?.length ?? 0}`);
  console.log(`  phase=${phase} end=${end} latest=${latest?.gameState} action=${latest?.action}`);
  console.log(`  phases=[${phases.join(', ')}]`);
  if (latest?.scoreSoccer) {
    const h = latest.scoreSoccer.Participant1.Total?.Goals;
    const a = latest.scoreSoccer.Participant2.Total?.Goals;
    const peH = latest.scoreSoccer.Participant1.PE?.Goals;
    const peA = latest.scoreSoccer.Participant2.PE?.Goals;
    console.log(`  score=${h}-${a} pens=${peH ?? '?'}-${peA ?? '?'}`);
  }
}

async function main() {
  const targets: Array<{ id: number; label: string }> = [];
  const unavailable: number[] = [];

  for (let day = WC_2026_START_EPOCH_DAY; day <= END; day++) {
    const fixtures = await getWorldCupFixturesForDay(day);
    for (const f of fixtures) {
      const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
      const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
      const label = `${home} vs ${away}`;
      if (/switzerland/i.test(label) && /colombia/i.test(label)) {
        targets.push({ id: f.FixtureId, label });
      }
      const hist = await getScoreHistorical(f.FixtureId).catch(() => []);
      const snap = await getScoreSnapshot(f.FixtureId).catch(() => []);
      if (hist.length === 0 && snap.length === 0 && f.StartTime < Date.now() - 3 * 3600_000) {
        unavailable.push(f.FixtureId);
      }
    }
  }

  console.log('Switzerland/Colombia:', targets);
  console.log('Unavailable count:', unavailable.length, unavailable.slice(0, 10));

  for (const t of targets) await probeFixture(t.id, t.label);

  // Probe a few unavailable
  for (const id of unavailable.slice(0, 3)) {
    await probeFixture(id, 'unavailable-sample');
  }

  // Find any FPE in tournament
  console.log('\n=== Scanning for FPE/Pens fixtures ===');
  for (let day = WC_2026_START_EPOCH_DAY; day <= END; day++) {
    const fixtures = await getWorldCupFixturesForDay(day);
    for (const f of fixtures) {
      const hist = await getScoreHistorical(f.FixtureId).catch(() => []);
      if (hist.some((h) => ['FPE', 'PE', 'WPE', 'FET', 'ET2', 'ET1'].includes(h.gameState))) {
        const home = f.Participant1IsHome ? f.Participant1 : f.Participant2;
        const away = f.Participant1IsHome ? f.Participant2 : f.Participant1;
        const latest = pickLatestScore(hist);
        console.log(
          `#${f.FixtureId} ${home} vs ${away} end=${resolveEndLabel(latest!, hist)} phase=${resolveEffectiveGameState(latest!, hist)}`
        );
      }
    }
  }
}

main().catch(console.error);
