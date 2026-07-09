import { LOAD_CONFIG } from './loadConfig';

interface Window {
  count: number;
  resetAt: number;
}

declare global {

  var __fpRateWindows: Map<string, Window> | undefined;

  var __fpActiveStreams: Map<string, number> | undefined;
}

const windows = globalThis.__fpRateWindows ?? new Map<string, Window>();
const activeStreams = globalThis.__fpActiveStreams ?? new Map<string, number>();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__fpRateWindows = windows;
  globalThis.__fpActiveStreams = activeStreams;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(bucketKey: string, limit: number): RateLimitResult {
  const windowMs = LOAD_CONFIG.rateLimit.windowMs;
  const now = Date.now();
  const entry = windows.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    windows.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  entry.count += 1;
  return { ok: true, remaining: limit - entry.count };
}

export function acquireStreamSlot(clientKey: string): RateLimitResult {
  const max = LOAD_CONFIG.rateLimit.maxConcurrentStreamsPerIp;
  const current = activeStreams.get(clientKey) ?? 0;
  if (current >= max) {
    return { ok: false, retryAfterSec: 30 };
  }
  activeStreams.set(clientKey, current + 1);
  return { ok: true, remaining: max - current - 1 };
}

export function releaseStreamSlot(clientKey: string): void {
  const current = activeStreams.get(clientKey) ?? 0;
  if (current <= 1) activeStreams.delete(clientKey);
  else activeStreams.set(clientKey, current - 1);
}
