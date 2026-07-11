import FixtureDashboard from './FixtureDashboard';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { inferMatchIsLive } from '@/lib/txline/gameState';
import { getEpochDay } from '@/lib/txline/dates';

export default async function FixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ fixtureId: string }>;
  searchParams: Promise<{ home?: string; away?: string }>;
}) {
  const { fixtureId } = await params;
  const { home, away } = await searchParams;
  const fixtureIdNum = Number(fixtureId);

  const fixture = await getFixtureById(fixtureIdNum);
  if (!fixture) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-[var(--muted)]">Fixture not found.</p>
        <a href="/" className="mt-4 inline-block text-sm text-[var(--gold)]">
          ← Back to matches
        </a>
      </div>
    );
  }

  const startTimeMs = fixture.StartTime;
  const competition = fixture.Competition;
  const participant1IsHome = fixture.Participant1IsHome;
  const homeTeam = home ?? (fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2);
  const awayTeam = away ?? (fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1);

  let isPulse = false;
  try {
    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs,
      competition,
      homeTeam,
      awayTeam,
      participant1IsHome,
      epochDay: getEpochDay(new Date(startTimeMs)),
    });
    isPulse =
      resolved.status === 'live' ||
      inferMatchIsLive(resolved.latest, resolved.history, Boolean(resolved.odds?.isLive));
  } catch {
    isPulse = false;
  }

  return (
    <FixtureDashboard
      fixtureId={fixtureId}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      startTimeMs={startTimeMs}
      isPulse={isPulse}
    />
  );
}
