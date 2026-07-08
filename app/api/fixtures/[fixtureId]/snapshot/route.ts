import { NextRequest, NextResponse } from 'next/server';
import { getScoreSnapshot } from '@/lib/txline/scores';

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
    const asOfParam = request.nextUrl.searchParams.get('asOf');
    const asOf = asOfParam !== null ? Number(asOfParam) : undefined;

    if (asOfParam !== null && !Number.isFinite(asOf)) {
      return NextResponse.json({ error: 'asOf must be a valid integer timestamp' }, { status: 400 });
    }

    const snapshot = await getScoreSnapshot(fixtureIdNum, asOf);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[api/fixtures/snapshot] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch score snapshot for this fixture.' },
      { status: 502 }
    );
  }
}
