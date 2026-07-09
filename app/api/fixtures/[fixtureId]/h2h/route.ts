import { NextRequest } from 'next/server';
import { getScoreHistorical, type ScoreSnapshot } from '@/lib/txline/scores';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return new Response('fixtureId must be numeric', { status: 400 });
  }

  try {
    const historicalScores = await getScoreHistorical(fixtureIdNum);

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    historicalScores.forEach((score: ScoreSnapshot) => {
      if (score.scoreSoccer) {
        const homeGoals = score.scoreSoccer.Participant1.Total?.Goals ?? 0;
        const awayGoals = score.scoreSoccer.Participant2.Total?.Goals ?? 0;

        if (homeGoals > awayGoals) homeWins++;
        else if (awayGoals > homeGoals) awayWins++;
        else draws++;
      }
    });

    return Response.json({
      homeWins,
      awayWins,
      draws,
      totalMatches: homeWins + awayWins + draws,
      matches: historicalScores.length,
    });
  } catch (err) {
    console.error('[h2h] error:', err);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch historical data',
        message: String(err),
      }),
      { status: 502 }
    );
  }
}
