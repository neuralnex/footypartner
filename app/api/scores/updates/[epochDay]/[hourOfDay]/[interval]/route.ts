import { NextRequest, NextResponse } from 'next/server';
import { getScoreUpdatesInterval } from '@/lib/txline/scores';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ epochDay: string; hourOfDay: string; interval: string }> }
) {
  const { epochDay, hourOfDay, interval } = await params;
  const fixtureIdParam = request.nextUrl.searchParams.get('fixtureId');

  const epochDayNum = Number(epochDay);
  const hourOfDayNum = Number(hourOfDay);
  const intervalNum = Number(interval);
  const fixtureIdNum = fixtureIdParam ? Number(fixtureIdParam) : undefined;

  if (!Number.isFinite(epochDayNum)) {
    return NextResponse.json({ error: 'epochDay must be numeric' }, { status: 400 });
  }
  if (!Number.isFinite(hourOfDayNum) || hourOfDayNum < 0 || hourOfDayNum > 23) {
    return NextResponse.json({ error: 'hourOfDay must be an integer between 0 and 23' }, { status: 400 });
  }
  if (!Number.isFinite(intervalNum) || intervalNum < 0 || intervalNum > 11) {
    return NextResponse.json({ error: 'interval must be an integer between 0 and 11' }, { status: 400 });
  }
  if (fixtureIdParam !== null && fixtureIdNum !== undefined && !Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const updates = await getScoreUpdatesInterval(epochDayNum, hourOfDayNum, intervalNum, fixtureIdNum);
    return NextResponse.json(updates);
  } catch (err) {
    console.error('[api/scores/updates/interval] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch interval score updates.' },
      { status: 502 }
    );
  }
}
