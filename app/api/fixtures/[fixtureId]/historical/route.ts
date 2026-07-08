import { NextRequest, NextResponse } from 'next/server';
import { getScoreHistorical } from '@/lib/txline/scores';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const historical = await getScoreHistorical(fixtureIdNum);
    return NextResponse.json(historical);
  } catch (err) {
    console.error('[api/fixtures/historical] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch historical score updates for this fixture.' },
      { status: 502 }
    );
  }
}
