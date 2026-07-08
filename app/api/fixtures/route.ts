// app/api/fixtures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getFixtureSnapshot } from '@/lib/txline/fixtures';

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
    return NextResponse.json(fixtures);
  } catch (err) {
    console.error('[api/fixtures] failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures for the selected day.' },
      { status: 502 }
    );
  }
}
