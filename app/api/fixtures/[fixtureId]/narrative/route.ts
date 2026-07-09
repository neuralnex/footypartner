
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload, NormalizedMatchState } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootyPartnerNarrativeEngine } from '@/lib/ai/narrativeEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') ?? 'Home';
  const awayTeam = searchParams.get('away') ?? 'Away';

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  try {
    const normalized: NormalizedMatchState = await withFreshSession(async (headers) => {
      const oddsResponse = await axios.get<RawOddsPayload[]>(
        `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
        { headers }
      );
      return TxLineDataParser.parseLiveOdds(oddsResponse.data);
    });

    const narrativeEngine = new FootyPartnerNarrativeEngine();
    const narrative = await narrativeEngine.generateNarrative(normalized, homeTeam, awayTeam);

    return NextResponse.json({ state: normalized, narrative });
  } catch (err) {
    console.error('[api/fixtures/narrative] failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate narrative for this fixture.' },
      { status: 502 }
    );
  }
}
