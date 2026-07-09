import { NextRequest, NextResponse } from 'next/server';
import { FootyPartnerChatEngine, type ChatMessage } from '@/lib/ai/chatEngine';
import { getScoreSnapshot } from '@/lib/txline/scores';
import { describeScoreEvent } from '@/lib/txline/gameState';
import { getOddsSnapshot, getOddsUpdates } from '@/lib/txline/odds';
import { TxLineDataParser } from '@/lib/txline/parser';
import { guardRequest, rateLimitResponse } from '@/lib/infra/apiGuard';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const rate = guardRequest(request, 'chat');
  if (!rate.ok) return rateLimitResponse(rate);

  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);

  if (!Number.isFinite(fixtureIdNum)) {
    return NextResponse.json({ error: 'fixtureId must be numeric' }, { status: 400 });
  }

  let body: {
    messages?: ChatMessage[];
    homeTeam?: string;
    awayTeam?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const homeTeam = body.homeTeam ?? 'Home';
  const awayTeam = body.awayTeam ?? 'Away';

  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
  }

  try {
    const snapshot = await getScoreSnapshot(fixtureIdNum);
    const latestScore =
      Array.isArray(snapshot) && snapshot.length > 0 ? snapshot[snapshot.length - 1] : null;

    let odds = null;
    try {
      const payloads = await getOddsSnapshot(fixtureIdNum);
      if (payloads?.length) {
        odds = TxLineDataParser.parseOddsPayloads(payloads);
      }
    } catch {
      try {
        const payloads = await getOddsUpdates(fixtureIdNum);
        if (payloads?.length) {
          odds = TxLineDataParser.parseOddsPayloads(payloads);
        }
      } catch {

      }
    }

    const recentEvents = Array.isArray(snapshot)
      ? snapshot
          .slice(-8)
          .map((s) => describeScoreEvent(s))
          .filter(Boolean)
      : [];

    const engine = new FootyPartnerChatEngine();
    const reply = await engine.reply(messages, {
      fixtureId: fixtureIdNum,
      homeTeam,
      awayTeam,
      latestScore,
      odds,
      recentEvents,
    });

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[api/chat]', err);
    return NextResponse.json(
      { error: 'Chat failed. Check GEMINI_API_KEY and TxLINE session.' },
      { status: 502 }
    );
  }
}
