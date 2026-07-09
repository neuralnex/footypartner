import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/infra/clientIp';
import { checkRateLimit } from '@/lib/infra/rateLimit';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';

function hasDedicatedGuard(pathname: string): boolean {
  if (pathname === '/api/fixtures/board') return true;
  if (/^\/api\/fixtures\/[^/]+\/stream$/.test(pathname)) return true;
  if (/^\/api\/fixtures\/[^/]+\/chat$/.test(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/') || pathname === '/api/health') {
    return NextResponse.next();
  }
  if (hasDedicatedGuard(pathname)) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const result = checkRateLimit(`default:${ip}`, LOAD_CONFIG.rateLimit.apiDefault);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down and try again.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
