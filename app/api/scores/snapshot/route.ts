import { NextRequest, NextResponse } from 'next/server';
import { getScoreSnapshot } from '@/lib/txline/scores';

export async function GET(request: NextRequest) {
  const fixtureIdParam = request.nextUrl.searchParams.get('fixtureId');
  const asOfParam = request.nextUrl.searchParams.get('asOf');

  if (!fixtureIdParam) {
    return NextResponse.json({ error: 'fixtureId query parameter is required' }, { status: 400 });
  }

  const fixtureIdNum = Number(fixtureIdParam);
  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  const asOf = asOfParam !== null ? Number(asOfParam) : undefined;
  if (asOfParam !== null && !Number.isFinite(asOf)) {
    return NextResponse.json({ error: 'asOf must be a valid integer timestamp' }, { status: 400 });
  }

  try {
    const snapshot = await getScoreSnapshot(fixtureIdNum, asOf);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[api/scores/snapshot] failed:', err);
    return NextResponse.json({ error: 'Failed to fetch score snapshot.' }, { status: 502 });
  }
}
