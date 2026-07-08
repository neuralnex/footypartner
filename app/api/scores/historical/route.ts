import { NextRequest, NextResponse } from 'next/server';
import { getScoreHistorical } from '@/lib/txline/scores';

export async function GET(request: NextRequest) {
  const fixtureIdParam = request.nextUrl.searchParams.get('fixtureId');

  if (!fixtureIdParam) {
    return NextResponse.json({ error: 'fixtureId query parameter is required' }, { status: 400 });
  }

  const fixtureIdNum = Number(fixtureIdParam);
  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const history = await getScoreHistorical(fixtureIdNum);
    return NextResponse.json(history);
  } catch (err) {
    console.error('[api/scores/historical] failed:', err);
    return NextResponse.json({ error: 'Failed to fetch score history.' }, { status: 502 });
  }
}
