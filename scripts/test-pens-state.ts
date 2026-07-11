import { getMatchData } from '../lib/db/fixtureStore';
import { pickLatestScore } from '../lib/txline/normalizeScore';
import {
  resolveEffectiveGameState,
  resolveEndLabel,
  scoreFromSnapshot,
} from '../lib/txline/gameState';

async function main() {
  const row = await getMatchData(18202783);
  if (!row) {
    console.error('No DB row for 18202783');
    process.exit(1);
  }
  const hist = row.score_history;
  const latest = pickLatestScore(hist);
  console.log('Switzerland vs Colombia #18202783');
  console.log('  phase:', resolveEffectiveGameState(latest, hist));
  console.log('  end:', resolveEndLabel(latest, hist));
  console.log('  score:', scoreFromSnapshot(latest));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
