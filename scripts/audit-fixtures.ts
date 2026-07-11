/**
 * Audit board + match-data for WC fixtures from June 11 – July 9 2026.
 * Run: npx tsx scripts/audit-fixtures.ts
 */
import {
  BOARD_TIMEZONE,
  getEpochDay,
  WC_2026_START_EPOCH_DAY,
} from '../lib/txline/dates';

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:3000';
const END_EPOCH_DAY = getEpochDay(new Date('2026-07-09T12:00:00Z'));

interface BoardFixture {
  FixtureId: number;
  homeTeam: string;
  awayTeam: string;
  status: string;
  gameState: string;
  gameStateLabel: string;
  minute: string;
  resultLabel: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  isPulse: boolean;
  StartTime: number;
}

interface MatchData {
  status: string;
  source?: string;
  homeTeam?: string;
  awayTeam?: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  latest?: { gameState?: string; action?: string };
  history?: Array<{ gameState?: string; action?: string; seq?: number }>;
  isLive?: boolean;
}

function formatDay(epochDay: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BOARD_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(epochDay * 86400000));
}

async function getJson<T>(path: string): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`);
  const data = (await res.json()) as T;
  return { ok: res.ok, status: res.status, data };
}

function issuesForFixture(board: BoardFixture, md: MatchData | null): string[] {
  const issues: string[] = [];
  if (board.homeTeam === 'Home' || board.awayTeam === 'Away') issues.push('placeholder team name');
  if (md?.homeTeam === 'Home' || md?.awayTeam === 'Away') issues.push('match-data placeholder teams');

  if (board.status === 'finished') {
    if (board.scoreHome == null || board.scoreAway == null) issues.push('finished but no board score');
    if (!board.minute && !board.gameStateLabel) issues.push('finished but no minute/label');
    if (md && md.status !== 'finished' && md.status !== 'unavailable') {
      issues.push(`board=finished but match-data=${md.status}`);
    }
    if (md && (md.scoreHome == null && md.scoreAway == null) && md.status === 'finished') {
      issues.push('match-data finished without score');
    }
    const endOk = ['FT', 'AET', 'Pens'].includes(board.minute) || Boolean(board.resultLabel);
    if (!endOk && board.gameState !== 'F' && board.gameState !== 'FET' && board.gameState !== 'FPE') {
      issues.push(`finished missing end label (minute=${board.minute}, state=${board.gameState})`);
    }
  }

  if (board.status === 'upcoming' && board.scoreHome != null) {
    issues.push('upcoming but has score on board');
  }

  if (md?.history && md.history.length > 0 && !md.latest?.gameState) {
    issues.push('history present but latest missing gameState');
  }

  return issues;
}

async function main() {
  console.log(`Auditing ${BASE}`);
  console.log(`Range: epochDay ${WC_2026_START_EPOCH_DAY} (${formatDay(WC_2026_START_EPOCH_DAY)}) → ${END_EPOCH_DAY} (${formatDay(END_EPOCH_DAY)})\n`);

  const daySummaries: Array<{
    day: number;
    label: string;
    count: number;
    finished: number;
    upcoming: number;
    unavailable: number;
    live: number;
    withScore: number;
    aet: number;
    pens: number;
    issues: number;
  }> = [];

  const allIssues: Array<{ day: number; fixtureId: number; match: string; problems: string[] }> = [];
  let totalFixtures = 0;
  let totalChecked = 0;

  for (let day = WC_2026_START_EPOCH_DAY; day <= END_EPOCH_DAY; day++) {
    const label = formatDay(day);
    const { ok, status, data } = await getJson<BoardFixture[]>(`/api/fixtures/board?epochDay=${day}`);

    if (!ok || !Array.isArray(data)) {
      console.log(`✗ ${label} (day ${day}): board HTTP ${status}`);
      daySummaries.push({ day, label, count: 0, finished: 0, upcoming: 0, unavailable: 0, live: 0, withScore: 0, aet: 0, pens: 0, issues: 1 });
      continue;
    }

    const visible = data.filter((f) => f.status !== 'unavailable');
    const unavailable = data.length - visible.length;
    const finished = visible.filter((f) => f.status === 'finished');
    const upcoming = visible.filter((f) => f.status === 'upcoming');
    const live = visible.filter((f) => f.status === 'live');
    const withScore = visible.filter((f) => f.scoreHome != null && f.scoreAway != null);
    const aet = visible.filter((f) => f.minute === 'AET' || f.gameState === 'FET');
    const pens = visible.filter((f) => f.minute === 'Pens' || f.gameState === 'FPE');

    let dayIssues = 0;

    const toCheck = [
      ...visible.filter((f) => f.status === 'finished'),
      ...visible.filter((f) => f.status === 'live'),
      ...visible.filter((f) => f.status === 'upcoming').slice(0, 2),
    ];

    for (const f of toCheck) {
      const enc = encodeURIComponent;
      const mdRes = await getJson<MatchData>(
        `/api/fixtures/${f.FixtureId}/match-data?home=${enc(f.homeTeam)}&away=${enc(f.awayTeam)}&epochDay=${day}`
      );
      const problems = issuesForFixture(f, mdRes.ok ? mdRes.data : null);
      if (!mdRes.ok) problems.push(`match-data HTTP ${mdRes.status}`);
      if (problems.length) {
        dayIssues++;
        allIssues.push({
          day,
          fixtureId: f.FixtureId,
          match: `${f.homeTeam} vs ${f.awayTeam}`,
          problems,
        });
      }
      totalChecked++;
    }

    totalFixtures += visible.length;

    daySummaries.push({
      day,
      label,
      count: data.length,
      finished: finished.length,
      upcoming: upcoming.length,
      unavailable,
      live: live.length,
      withScore: withScore.length,
      aet: aet.length,
      pens: pens.length,
      issues: dayIssues,
    });

    const flag = dayIssues ? '⚠' : visible.length ? '✓' : '·';
    console.log(
      `${flag} ${label.padEnd(18)} | ${String(visible.length).padStart(2)} fx | ` +
        `fin ${finished.length} up ${upcoming.length} live ${live.length} | ` +
        `scored ${withScore.length} AET ${aet.length} Pens ${pens.length}` +
        (dayIssues ? ` | ${dayIssues} issue(s)` : '')
    );
  }

  console.log('\n=== Totals ===');
  console.log(`Days scanned: ${daySummaries.length}`);
  console.log(`Fixtures on board: ${totalFixtures}`);
  console.log(`Match-data checked: ${totalChecked}`);
  console.log(`Days with issues: ${daySummaries.filter((d) => d.issues > 0).length}`);
  console.log(`Fixtures with issues: ${allIssues.length}`);

  if (allIssues.length) {
    console.log('\n=== Issues (first 30) ===');
    for (const row of allIssues.slice(0, 30)) {
      console.log(`  day ${row.day} #${row.fixtureId} ${row.match}: ${row.problems.join('; ')}`);
    }
    if (allIssues.length > 30) console.log(`  ... and ${allIssues.length - 30} more`);
  }

  // Sample rendered data for a few representative fixtures
  console.log('\n=== Sample match-data payloads ===');
  const samples = [
    ...daySummaries.filter((d) => d.aet > 0).slice(0, 1),
    ...daySummaries.filter((d) => d.pens > 0).slice(0, 1),
    ...daySummaries.filter((d) => d.finished > 0 && d.aet === 0).slice(0, 1),
    ...daySummaries.filter((d) => d.unavailable > 0).slice(0, 1),
  ];

  const seenDays = new Set<number>();
  for (const s of samples) {
    if (seenDays.has(s.day)) continue;
    seenDays.add(s.day);
    const { data: board } = await getJson<BoardFixture[]>(`/api/fixtures/board?epochDay=${s.day}`);
    const pick =
      board.find((f) => f.minute === 'AET' || f.gameState === 'FET') ??
      board.find((f) => f.minute === 'Pens' || f.gameState === 'FPE') ??
      board.find((f) => f.status === 'finished' && f.scoreHome != null) ??
      board.find((f) => f.status === 'unavailable');
    if (!pick) continue;

    const md = await getJson<MatchData>(
      `/api/fixtures/${pick.FixtureId}/match-data?home=${encodeURIComponent(pick.homeTeam)}&away=${encodeURIComponent(pick.awayTeam)}&epochDay=${s.day}`
    );
    const phases = [...new Set((md.data.history ?? []).map((h) => h.gameState).filter(Boolean))];
    console.log(`\n${pick.homeTeam} vs ${pick.awayTeam} (#${pick.FixtureId})`);
    console.log(`  board: status=${pick.status} score=${pick.scoreHome}-${pick.scoreAway} minute=${pick.minute} state=${pick.gameState} label=${pick.gameStateLabel}`);
    console.log(`  match-data: status=${md.data.status} source=${md.data.source} score=${md.data.scoreHome}-${md.data.scoreAway}`);
    console.log(`  latest gameState=${md.data.latest?.gameState} history=${md.data.history?.length} phases=[${phases.join(', ')}]`);
  }

  process.exit(allIssues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
