import { NextRequest, NextResponse } from 'next/server';
import { getFixtureById } from '@/lib/txline/fixtures';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { getEpochDay } from '@/lib/txline/dates';
import { inferMatchIsLive, scoreFromSnapshot } from '@/lib/txline/gameState';
import { isInMatchWindow } from '@/lib/match/resolveMatchData';

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
  const streamOnly = searchParams.get('streamOnly') === 'true';

  let startTimeMs = 0;
  let competition = 'World Cup';
  let homeTeam = homeParam ?? '';
  let awayTeam = awayParam ?? '';
  let participant1IsHome = true;

  const epochDayParam = searchParams.get('epochDay');
  const epochDayHint = epochDayParam ? Number(epochDayParam) : undefined;

  const fixture = await getFixtureById(fixtureIdNum, {
    epochDay: Number.isFinite(epochDayHint) ? epochDayHint : undefined,
  });
  if (!fixture) {
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  }

  startTimeMs = fixture.StartTime;
  competition = fixture.Competition;
  participant1IsHome = fixture.Participant1IsHome;
  homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
  awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
  if (homeParam) homeTeam = homeParam;
  if (awayParam) awayTeam = awayParam;

  try {
    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs,
      competition,
      homeTeam,
      awayTeam,
      participant1IsHome,
      epochDay: startTimeMs ? getEpochDay(new Date(startTimeMs)) : undefined,
      forceRefresh: forceRefresh || isInMatchWindow(startTimeMs),
      streamOnly,
      fetchOdds: !streamOnly,
    });

    const score = scoreFromSnapshot(resolved.latest ?? undefined);

    return NextResponse.json({
      fixtureId: fixtureIdNum,
      homeTeam,
      awayTeam,
      startTimeMs,
      status: resolved.status,
      scoreHome: score?.home ?? null,
      scoreAway: score?.away ?? null,
      isLive:
        resolved.status === 'live' ||
        inferMatchIsLive(resolved.latest, resolved.history, Boolean(resolved.odds?.isLive)),
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
