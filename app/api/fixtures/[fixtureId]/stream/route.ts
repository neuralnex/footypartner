import { NextRequest } from 'next/server';
import { getLiveHub } from '@/lib/txline/liveHub';
import { guardRequest, rateLimitResponse } from '@/lib/infra/apiGuard';
import { getClientIp } from '@/lib/infra/clientIp';
import { acquireStreamSlot, releaseStreamSlot } from '@/lib/infra/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const rate = guardRequest(request, 'stream');
  if (!rate.ok) return rateLimitResponse(rate);

  const clientIp = getClientIp(request);
  const slot = acquireStreamSlot(clientIp);
  if (!slot.ok) return rateLimitResponse(slot);

  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') ?? undefined;
  const awayTeam = searchParams.get('away') ?? undefined;
  const startTimeMs = Number(searchParams.get('startTime') ?? '0') || undefined;

  if (!Number.isFinite(fixtureIdNum)) {
    releaseStreamSlot(clientIp);
    return new Response('fixtureId must be numeric', { status: 400 });
  }

  const hub = getLiveHub(fixtureIdNum, { homeTeam, awayTeam, startTimeMs });
  if (!hub) {
    releaseStreamSlot(clientIp);
    return new Response('Live capacity reached. Try again shortly.', { status: 503 });
  }

  if (!hub.canAcceptSubscriber()) {
    releaseStreamSlot(clientIp);
    return new Response('This match feed is at capacity.', { status: 503 });
  }

  const encoder = new TextEncoder();
  const subscriberId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      hub.subscribe(subscriberId, send);

      request.signal.addEventListener('abort', () => {
        hub.unsubscribe(subscriberId);
        releaseStreamSlot(clientIp);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
