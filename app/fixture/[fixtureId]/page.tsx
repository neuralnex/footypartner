import FixtureDashboard from './FixtureDashboard';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { isSoccerLive } from '@/lib/txline/gameState';
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

  let homeTeam = home;
  let awayTeam = away;
  let startTimeMs = 0;
  let competition = 'World Cup';
  let participant1IsHome = true;

  const fixture = await getFixtureById(fixtureIdNum);
  if (fixture) {
    startTimeMs = fixture.StartTime;
    competition = fixture.Competition;
    participant1IsHome = fixture.Participant1IsHome;
    if (!homeTeam || !awayTeam) {
      if (fixture.Participant1IsHome) {
        homeTeam = fixture.Participant1;
        awayTeam = fixture.Participant2;
      } else {
        homeTeam = fixture.Participant2;
        awayTeam = fixture.Participant1;
      }
    }
  }

  let isPulse = false;
  try {
    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs,
      competition,
      homeTeam: homeTeam ?? 'Home',
      awayTeam: awayTeam ?? 'Away',
      participant1IsHome,
      epochDay: startTimeMs ? getEpochDay(new Date(startTimeMs)) : undefined,
    });
    isPulse = isSoccerLive(resolved.latest?.gameState) || resolved.status === 'live';
  } catch {
    isPulse = false;
  }

  return (
    <FixtureDashboard
      fixtureId={fixtureId}
      homeTeam={homeTeam ?? 'Home'}
      awayTeam={awayTeam ?? 'Away'}
      isPulse={isPulse}
    />
  );
}
