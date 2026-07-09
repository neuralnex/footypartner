# Architecture

Football Pulse is a **live match companion** for World Cup 2026. Users browse fixtures on a day-by-day board, open a match, and get scores, events, stats, odds, and AI commentary — without signing in or connecting a wallet.

That last point matters architecturally: **all TxLINE access goes through one server-side subscription**. The browser never sees JWTs, API tokens, or Solana keys.

---

## The big picture

```
┌─────────────┐     HTTPS/SSE      ┌──────────────────────┐     REST/SSE     ┌─────────────┐
│   Browser   │ ◄────────────────► │  Next.js (BFF layer) │ ◄──────────────► │   TxLINE    │
│  React UI   │                    │  custodian + cache   │                  │   devnet    │
└─────────────┘                    │  live hub + Gemini   │                  └─────────────┘
                                   └──────────┬───────────┘
                                              │
                                   ┌──────────▼───────────┐
                                   │  Solana devnet         │
                                   │  subscribe() tx        │
                                   └────────────────────────┘
```

The frontend is thin. It fetches our `/api/*` routes and opens an `EventSource` on live matches. The server owns authentication, caching, rate limiting, and the upstream TxLINE connections.

---

## Authentication model

TxLINE expects two headers on every data call:

- `Authorization: Bearer <guest JWT>`
- `X-Api-Token: <activation token>`

We obtain these once at boot via the **custodian pipeline** (`lib/txline/custodian.ts`):

1. `POST /auth/guest/start` → guest JWT
2. On-chain `subscribe(service_level_id: 1, weeks: 4)` → transaction signature
3. Sign `txSig:leagues:jwt` with the server keypair
4. `POST /api/token/activate` → long-lived API token

Credentials persist in `.txline-cache.json` so restarts don't re-subscribe on-chain (which would fail with `ActiveSubscription`).

`instrumentation.ts` runs this pipeline when the Node process starts. `lib/txline/singleton.ts` keeps the custodian on `globalThis` (survives Next.js hot reload) and refreshes the JWT every 20 minutes. `withFreshSession()` wraps every TxLINE call and retries once on 401/403.

---

## Two modes: Pulse vs archive

A fixture is either **live** (Pulse mode) or **not** (archive mode). We detect this from the latest score snapshot's `gameState` — soccer uses phase codes like `H1`, `HT`, `H2`, not just a generic `LIVE` string. See `lib/txline/gameState.ts`.

| Capability | Pulse (live) | Archive (finished / upcoming) |
|------------|--------------|-------------------------------|
| Real-time score SSE | Yes | No |
| Odds tab + stream | Yes | Snapshot only, if available |
| AI narrative feed | Yes | No |
| Ask AI chat | Yes | Yes |
| Events / stats / lineups | Yes | Yes (historical scores for finished) |

The fixture page gets an `isPulse` flag from the server (`app/fixture/[fixtureId]/page.tsx`). The dashboard only opens the SSE stream when the match is live.

---

## Homepage: the match board

The board answers one question: *what World Cup matches are on this calendar day?*

`GET /api/fixtures/board?epochDay=N` does more work than you'd expect:

1. **Fixture discovery** — TxLINE's `startEpochDay` param is *not* a day filter. It means "fixtures starting from this day onward." To show past group-stage games we merge:
   - `GET /api/fixtures/snapshot?startEpochDay=N`
   - `GET /api/fixtures/updates/{N}/{hour}` for all 24 hours
   Then filter to World Cup competitions and kickoffs that fall on the selected day (Africa/Lagos timezone).

2. **Score enrichment** — for each fixture that has kicked off, we fetch `scores/snapshot` to get status, minute, and scoreline.

3. **Sort** — live matches first, then kickoff time ascending.

The response is cached in memory (15s when live, up to 5min for archive days) so a crowd hitting the homepage doesn't hammer TxLINE.

---

## Fixture page: the live companion

`FixtureDashboard.tsx` is the main UI. On load it:

1. Fetches `GET /api/scores/snapshot?fixtureId=` for initial state
2. For finished matches, also fetches `GET /api/scores/historical?fixtureId=` for the full event timeline
3. Fetches odds snapshot for the Odds tab (live) or archive display
4. If `isPulse`, opens `EventSource` on `GET /api/fixtures/[id]/stream`

### The stream route and live hub

Early versions opened a **separate TxLINE SSE connection per browser tab**. That doesn't scale — 100 users watching the same match meant 100 upstream connections.

Now `lib/txline/liveHub.ts` maintains **one upstream connection per fixture**:

- Subscribes to TxLINE `scores/stream` and `odds/stream`
- Polls `scores/updates` and `odds/updates` as fallback
- Fans events out to every connected browser
- Shuts down 90 seconds after the last viewer leaves
- Shares one Gemini narrative generation across all viewers (60s cooldown, aligned with devnet odds sampling)

The stream route (`app/api/fixtures/[id]/stream/route.ts`) is thin: it rate-limits the client, acquires a subscriber slot on the hub, and pipes hub events into the browser's SSE response.

### AI layer

**Narratives** (`lib/ai/narrativeEngine.ts`) — Gemini receives normalized odds probabilities, current score, and stats. It returns three pillars: match pulse, why it matters, what-if. Only generated when the match is live and odds/score state has changed.

**Chat** (`lib/ai/chatEngine.ts`) — `POST /api/fixtures/[id]/chat` sends the conversation history plus a context block built from the latest score snapshot, odds, and recent events. Works in archive mode too.

---

## Data normalization

Raw TxLINE odds payloads use fields like `PriceNames`, `Pct`, `SuperOddsType`, and `InRunning`. `lib/txline/parser.ts` picks the best 1/X/2 match-winner market and outputs:

```typescript
{
  fixtureId, timestamp, gameState, isLive, bookmaker,
  probabilities: { homeWin, draw, awayWin },
  markets: OddsMarketView[]
}
```

Score snapshots are used mostly as-is. `lib/txline/gameState.ts` adds helpers for live/finished detection, minute formatting, event descriptions, and lineup extraction.

---

## Middleware and the BFF pattern

`middleware.ts` applies a default per-IP rate limit on `/api/*` (120 req/min). Heavier routes — board, stream connect, chat — have their own limits inside the route handlers.

We deliberately don't expose TxLINE directly to the client. Every external integration sits behind `/api/*` where we can cache, throttle, and reshape responses.

---

## What we didn't build (yet)

- **On-chain validation UI** — `scores/stat-validation` and odds validation endpoints are wired but not surfaced. Would power a "verified on-chain" badge.
- **Per-user auth** — intentional for the hackathon; everything shares one subscription.
- **Historical odds replay** — archive matches show the latest odds snapshot, not interval-by-interval history.

For TxLINE endpoint details and platform quirks, see [TXLINE_INTEGRATION.md](./TXLINE_INTEGRATION.md).
