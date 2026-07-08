// app/api/fixtures/[fixtureId]/scores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getScoreUpdates } from '@/lib/txline/scores';

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
    const scores = await getScoreUpdates(fixtureIdNum);
    return NextResponse.json(scores);
  } catch (err) {
    console.error('[api/fixtures/scores] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch score updates for this fixture.' },
      { status: 502 }
    );
  }
}
