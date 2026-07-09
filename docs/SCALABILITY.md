# Scalability

FootyPartner has no login. Every visitor shares one TxLINE subscription and one Solana wallet on the server. That's fine for a demo, but it means **our server is the bottleneck** — not per-user quotas on TxLINE.

We added three layers of protection: caching, fan-out, and rate limiting.

---

## The problem we were solving

Without guards, this is what happens when traffic spikes:

1. **Homepage** — each user polls `/api/fixtures/board` every 30s. Each board build fires 24+ TxLINE calls for historical fixtures plus one score snapshot per match.
2. **Live match** — each user opens their own SSE connection to TxLINE `scores/stream` and `odds/stream`. Fifty viewers = fifty upstream connections.
3. **Chat** — each message hits Gemini + TxLINE. Expensive and easy to abuse.

One viral moment and you'd hit TxLINE rate limits, exhaust file descriptors, or melt the Gemini budget.

---

## Layer 1: Cache and coalesce

`lib/infra/ttlCache.ts` is an in-memory TTL cache with **singleflight** — if ten requests ask for the same score snapshot at once, only one TxLINE call runs.

| Data | Default TTL | Rationale |
|------|-------------|-----------|
| Live score snapshot | 5s | Fresh enough for the board; cheap to cache |
| Odds snapshot / updates | 30s | Matches devnet sampling anyway |
| Historical scores | 1 hour | Finished matches don't change |
| Fixture day batches | 5 min (past: 1 hour) | Group-stage days are static |
| Full board response | 15–300s | Depends on live vs archive |

TxLINE REST calls use a shared axios instance with HTTP keep-alive (`lib/txline/http.ts`) so we're not opening a new TCP connection per request.

The board route also caps parallel score fetches at 4 (`BOARD_SCORE_FETCH_CONCURRENCY`) so a 6-match day doesn't fire six simultaneous TxLINE calls.

**Tradeoff:** cache is per-process. Works on a single Node instance. Multiple replicas would serve stale or duplicated data without Redis.

---

## Layer 2: Live hub (bandwidth)

`lib/txline/liveHub.ts` is the biggest win for live matches.

Instead of:

```
User A ──► TxLINE scores/stream
User B ──► TxLINE scores/stream
User C ──► TxLINE scores/stream
```

We do:

```
User A ──┐
User B ──┼──► LiveHub (fixture 123) ──► one TxLINE scores/stream
User C ──┘                              one TxLINE odds/stream
```

One upstream connection per fixture. Events are broadcast to every subscriber. New joiners get a replay of the current score and odds state.

The hub shuts down 90 seconds after the last viewer leaves to free resources.

**Caps (configurable via env):**

| Setting | Default | Meaning |
|---------|---------|---------|
| `HUB_MAX_CHANNELS` | 32 | Max fixtures with active upstream at once |
| `HUB_MAX_SUBSCRIBERS` | 200 | Max browsers per fixture |
| `HUB_IDLE_SHUTDOWN_MS` | 90000 | Tear down idle hubs |

Narrative generation is also shared — one Gemini call per state change serves all viewers on that fixture.

---

## Layer 3: Rate limiting

`middleware.ts` applies a default limit of **120 requests/min per IP** on `/api/*`.

Routes with heavier work have dedicated buckets:

| Route | Limit | Why |
|-------|-------|-----|
| `/api/fixtures/board` | 40/min | Expensive even with cache |
| `/api/fixtures/*/stream` | 20 connects/min | SSE is long-lived |
| `/api/fixtures/*/chat` | 15/min | Gemini costs money |
| Concurrent streams per IP | 3 | Stops one client opening dozens of tabs |

Over-limit requests get `429` with `Retry-After`. The homepage backs off when it sees a 429 and adds jitter to its refresh interval so a crowd doesn't sync up and hammer the server in waves.

---

## Client-side behaviour

The homepage doesn't poll every 30s on the nose anymore. It uses ~45s + random jitter and respects `Retry-After` on rate limits.

The fixture dashboard opens one `EventSource` per page view. Closing the tab releases the hub subscriber slot and stream rate-limit slot.

---

## Tuning for your deploy

All knobs are in `.env.example`. Start with defaults for a hackathon demo. If you're expecting a crowd:

1. Lower `CACHE_BOARD_LIVE_MS` only if scores feel stale — usually not needed
2. Raise `HUB_MAX_SUBSCRIBERS` if one match will have a big watch party
3. Raise `RATE_LIMIT_*` if you're behind a CDN and all users share one IP (corporate NAT) — or use `X-Forwarded-For` aware limiting at the edge instead
4. Watch `GET /api/health` → `liveHub.subscribers` during a live match

---

## What we'd add for real production

- **Redis** for shared cache and rate-limit state across instances
- **Per-user or per-session auth** so abuse is traceable
- **CDN caching** on board responses for archive days (`Cache-Control` headers are already set)
- **Queue for Gemini** so chat bursts don't block the event loop
- **Separate read replicas** if TxLINE ever offers them

For a single-server hackathon or small demo, what's here should hold up to a few hundred concurrent viewers on one live match without falling over.
