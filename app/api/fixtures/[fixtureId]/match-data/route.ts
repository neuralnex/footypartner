import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { getEpochDay } from '@/lib/txline/dates';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const homeParam = searchParams.get('home');
  const awayParam = searchParams.get('away');
  const forceRefresh = searchParams.get('refresh') === 'true';

  let startTimeMs = 0;
  let competition = 'World Cup';
  let homeTeam = homeParam ?? 'Home';
  let awayTeam = awayParam ?? 'Away';
  let participant1IsHome = true;

  const fixture = await getFixtureById(fixtureIdNum);
  if (fixture) {
    startTimeMs = fixture.StartTime;
    competition = fixture.Competition;
    participant1IsHome = fixture.Participant1IsHome;
    if (!homeParam || !awayParam) {
      homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
      awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
    }
  }

  try {
    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs,
      competition,
      homeTeam,
      awayTeam,
      participant1IsHome,
      epochDay: startTimeMs ? getEpochDay(new Date(startTimeMs)) : undefined,
      forceRefresh,
      fetchOdds: true,
    });

    return NextResponse.json({
      fixtureId: fixtureIdNum,
      homeTeam,
      awayTeam,
      status: resolved.status,
      source: resolved.source,
      latest: resolved.latest,
      history: resolved.history,
      odds: resolved.odds,
    });
  } catch (err) {
    console.error('[api/fixtures/match-data]', err);
    return NextResponse.json({ error: 'Failed to load match data.' }, { status: 502 });
  }
}
