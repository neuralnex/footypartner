import { NextRequest, NextResponse } from 'next/server';
import { FootyPartnerChatEngine, type ChatMessage } from '@/lib/ai/chatEngine';
import { describeScoreEvent } from '@/lib/txline/gameState';
import { resolveMatchData } from '@/lib/match/resolveMatchData';
import { getFixtureById } from '@/lib/txline/fixtures';
import { getEpochDay } from '@/lib/txline/dates';
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
  let homeTeam = body.homeTeam ?? '';
  let awayTeam = body.awayTeam ?? '';

  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
  }

  try {
    const fixture = await getFixtureById(fixtureIdNum);
    if (!fixture) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }

    const startTimeMs = fixture.StartTime;
    homeTeam = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
    awayTeam = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;

    const resolved = await resolveMatchData(fixtureIdNum, {
      startTimeMs,
      competition: fixture?.Competition ?? 'World Cup',
      homeTeam,
      awayTeam,
      participant1IsHome: fixture?.Participant1IsHome ?? true,
      epochDay: startTimeMs ? getEpochDay(new Date(startTimeMs)) : undefined,
      fetchOdds: true,
    });

    const recentEvents = resolved.history
      .slice(-12)
      .map((s) => describeScoreEvent(s))
      .filter(Boolean);

    const engine = new FootyPartnerChatEngine();
    const reply = await engine.reply(messages, {
      fixtureId: fixtureIdNum,
      homeTeam,
      awayTeam,
      latestScore: resolved.latest,
      odds: resolved.odds,
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
