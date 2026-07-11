import { NextRequest, NextResponse } from 'next/server';
import { getFixtureSnapshot } from '@/lib/txline/fixtures';
import { getScoreSnapshot } from '@/lib/txline/scores';
import { inferMatchIsLive, scoreFromSnapshot } from '@/lib/txline/gameState';

export const dynamic = 'force-dynamic';

const MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const epochDay = searchParams.get('epochDay');

  if (!epochDay) {
    return NextResponse.json({ error: 'epochDay query parameter required' }, { status: 400 });
  }

  const epochDayNum = Number(epochDay);
  if (!Number.isFinite(epochDayNum)) {
    return NextResponse.json({ error: 'epochDay must be a valid integer' }, { status: 400 });
  }

  try {
    const fixtures = await getFixtureSnapshot({ startEpochDay: epochDayNum });
    const now = Date.now();

    const candidates = fixtures.filter((f) => {
      const started = f.StartTime <= now;
      const inWindow = now - f.StartTime < MATCH_WINDOW_MS;
      const worldCup = /world cup/i.test(String(f.Competition || ''));
      return worldCup && started && inWindow;
    });

    const liveFixtures = await Promise.all(
      candidates.map(async (fixture) => {
        try {
          const scores = await getScoreSnapshot(fixture.FixtureId);
          const latest =
            Array.isArray(scores) && scores.length > 0 ? scores[scores.length - 1] : null;
          const live = inferMatchIsLive(latest, Array.isArray(scores) ? scores : []);
          if (!live) return null;

          const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
          const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
          const score = scoreFromSnapshot(latest);

          return {
            ...fixture,
            homeTeam: home,
            awayTeam: away,
            gameState: latest?.gameState ?? '',
            minute: latest?.dataSoccer?.Minutes ?? null,
            scoreHome: score?.home ?? null,
            scoreAway: score?.away ?? null,
          };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json(liveFixtures.filter(Boolean));
  } catch (err) {
    console.error('[api/fixtures/live]', err);
    return NextResponse.json({ error: 'Failed to fetch live fixtures.' }, { status: 502 });
  }
}
