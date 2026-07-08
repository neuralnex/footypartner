import { NextRequest, NextResponse } from 'next/server';
import { getScoreStatValidation } from '@/lib/txline/scores';

export async function GET(request: NextRequest) {
  const fixtureIdParam = request.nextUrl.searchParams.get('fixtureId');
  const seqParam = request.nextUrl.searchParams.get('seq');
  const statKeyParam = request.nextUrl.searchParams.get('statKey');
  const statKey2Param = request.nextUrl.searchParams.get('statKey2');
  const statKeys = request.nextUrl.searchParams.get('statKeys');

  if (!fixtureIdParam || !seqParam) {
    return NextResponse.json(
      { error: 'fixtureId and seq query parameters are required' },
      { status: 400 }
    );
  }

  const fixtureIdNum = Number(fixtureIdParam);
  const seqNum = Number(seqParam);
  const statKeyNum = statKeyParam !== null ? Number(statKeyParam) : undefined;
  const statKey2Num = statKey2Param !== null ? Number(statKey2Param) : undefined;

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }
  if (!Number.isFinite(seqNum)) {
    return NextResponse.json({ error: 'seq must be numeric' }, { status: 400 });
  }
  if (statKeyParam !== null && !Number.isFinite(statKeyNum)) {
    return NextResponse.json({ error: 'statKey must be numeric' }, { status: 400 });
  }
  if (statKey2Param !== null && !Number.isFinite(statKey2Num)) {
    return NextResponse.json({ error: 'statKey2 must be numeric' }, { status: 400 });
  }

  try {
    const validation = await getScoreStatValidation({
      fixtureId: fixtureIdNum,
      seq: seqNum,
      statKey: statKeyNum,
      statKey2: statKey2Num,
      statKeys: statKeys ?? undefined,
    });
    return NextResponse.json(validation);
  } catch (err) {
    console.error('[api/scores/stat-validation] failed:', err);
    return NextResponse.json({ error: 'Failed to validate score stat.' }, { status: 502 });
  }
}
