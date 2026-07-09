
import { NextResponse } from 'next/server';
import { liveHubStats } from '@/lib/txline/liveHub';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'footypartner-server',
    liveHub: liveHubStats(),
  });
}
