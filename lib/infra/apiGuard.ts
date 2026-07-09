import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp } from './clientIp';
import { checkRateLimit, type RateLimitResult } from './rateLimit';
import { LOAD_CONFIG } from './loadConfig';

export type ApiBucket = 'default' | 'board' | 'stream' | 'chat';

const LIMITS: Record<ApiBucket, number> = {
  default: LOAD_CONFIG.rateLimit.apiDefault,
  board: LOAD_CONFIG.rateLimit.board,
  stream: LOAD_CONFIG.rateLimit.streamConnect,
  chat: LOAD_CONFIG.rateLimit.chat,
};

export function guardRequest(
  request: NextRequest,
  bucket: ApiBucket = 'default'
): RateLimitResult {
  const ip = getClientIp(request);
  return checkRateLimit(`${bucket}:${ip}`, LIMITS[bucket]);
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again.' },
    {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfterSec) },
    }
  );
}
