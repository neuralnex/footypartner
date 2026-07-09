# API Reference

All routes live under `/api`. The browser talks only to these — never to TxLINE or Gemini directly.

Unless noted, responses are JSON. Rate limits apply per IP; a `429` response includes a `Retry-After` header in seconds.

---

## Health

### `GET /api/health`

Liveness check. Useful for load balancers and deploy smoke tests.

```json
{
  "status": "ok",
  "service": "football-pulse-server",
  "liveHub": {
    "channels": 2,
    "subscribers": 47
  }
}
```

`liveHub` shows how many fixture streams are active and how many browsers are connected.

---

## Fixtures

### `GET /api/fixtures/board?epochDay={number}`

**Rate limit:** 40 req/min per IP.

Returns all World Cup fixtures for a calendar day. `epochDay` is days since Unix epoch (the homepage computes this in Africa/Lagos timezone).

**Response:** array of board fixtures.

```json
[
  {
    "FixtureId": 18209181,
    "Competition": "World Cup 2026",
    "StartTime": 1752091200000,
    "homeTeam": "France",
    "awayTeam": "Morocco",
    "status": "live",
    "gameState": "H2",
    "gameStateLabel": "2nd half",
    "minute": "74'",
    "scoreHome": 2,
    "scoreAway": 1,
    "isPulse": true
  }
]
```

`status` is one of `upcoming`, `live`, or `finished`. `isPulse` is true only for live matches.

Responses are cached server-side. Check `X-Cache: HIT|MISS` and `Cache-Control` headers.

---

### `GET /api/fixtures?epochDay={number}`

Legacy route — returns raw fixture snapshot from TxLINE. The homepage uses `/board` instead.

---

### `GET /api/fixtures/live?epochDay={number}`

Legacy live-only listing. Superseded by `/board`.

---

### `GET /api/fixtures/{fixtureId}/stream?home={}&away={}`

**Rate limit:** 20 connect attempts/min per IP, max 3 concurrent streams per IP.

Server-Sent Events stream for live matches. Connect with `EventSource` in the browser.

**Query params:**
- `home`, `away` — team names (used in meta messages; narrative uses generic labels in shared hub mode)
- `narrative=false` — skip AI narrative events (optional)

**SSE events:**

| Event | Payload | When |
|-------|---------|------|
| `meta` | `{ message, devnetDelaySec? }` | On connect |
| `snapshot` | `ScoreSnapshot[]` | Initial score state |
| `score` | `{ source, latest, minute, gameState, isLive }` | Score update |
| `odds` | `NormalizedMatchState + source` | Odds update |
| `narrative` | `{ matchPulse, whyItMatters, whatIf }` | Gemini summary (~60s cadence) |
| `stream` | `{ channel, status, message? }` | Upstream connection status |
| `error` | `{ source, message }` | Non-fatal failure |

Returns `503` if the live hub is at capacity (too many fixtures or subscribers).

---

### `GET /api/fixtures/{fixtureId}/odds?source=snapshot|updates`

Normalized odds for a fixture.

**Query params:**
- `source` — `snapshot` (default) or `updates` (live 5-minute cache)

```json
{
  "fixtureId": 18209181,
  "timestamp": 1752091200000,
  "gameState": "H2",
  "isLive": true,
  "bookmaker": "ExampleBook",
  "probabilities": { "homeWin": 52.632, "draw": 24.100, "awayWin": 23.268 },
  "markets": [
    {
      "bookmaker": "ExampleBook",
      "marketType": "1X2",
      "marketPeriod": "FT",
      "gameState": "H2",
      "inRunning": true,
      "timestamp": 1752091200000,
      "selections": [
        { "name": "1", "price": 190, "pct": 52.632 },
        { "name": "X", "price": 415, "pct": 24.100 },
        { "name": "2", "price": 430, "pct": 23.268 }
      ]
    }
  ]
}
```

---

### `POST /api/fixtures/{fixtureId}/chat`

**Rate limit:** 15 req/min per IP.

AI chat about the match.

**Body:**

```json
{
  "messages": [
    { "role": "user", "content": "Who's dominating possession?" }
  ],
  "homeTeam": "France",
  "awayTeam": "Morocco"
}
```

The last message must be from the user.

**Response:**

```json
{
  "reply": "France have had 58% possession so far..."
}
```

---

### `GET /api/fixtures/{fixtureId}/narrative?home={}&away={}`

One-shot narrative (odds + Gemini). The live stream uses the same engine but pushes over SSE.

---

### `GET /api/fixtures/{fixtureId}/snapshot`

Proxy to TxLINE fixture metadata.

---

### `GET /api/fixtures/{fixtureId}/scores`

Proxy to TxLINE score snapshot for the fixture.

---

### `GET /api/fixtures/{fixtureId}/historical`

Proxy to TxLINE historical scores.

---

### `GET /api/fixtures/{fixtureId}/h2h`

Head-to-head style summary derived from historical score data.

---

## Scores (direct proxies)

These wrap `lib/txline/scores.ts` with caching. Useful if you're building tooling against the local server.

| Route | TxLINE equivalent |
|-------|-------------------|
| `GET /api/scores/snapshot?fixtureId=` | `/api/scores/snapshot/{id}` |
| `GET /api/scores/updates?fixtureId=` | `/api/scores/updates/{id}` |
| `GET /api/scores/historical?fixtureId=` | `/api/scores/historical/{id}` |
| `GET /api/scores/updates/{day}/{hour}/{interval}?fixtureId=` | Historical interval updates |
| `GET /api/scores/stat-validation?fixtureId=&seq=` | Merkle proof (unused in UI) |

---

## Pages (not API, but relevant)

| Path | Description |
|------|-------------|
| `/` | Match board |
| `/fixture/{id}?home=&away=` | Companion dashboard |
| `/match/{id}` | 307 redirect to `/fixture/{id}` |

Team names in query params are display-only — they're passed through to chat and stream meta, not used for data lookup (fixture ID is the key).

---

## Error shapes

Most errors return:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad parameters |
| `429` | Rate limited — back off using `Retry-After` |
| `502` | TxLINE or Gemini upstream failure |
| `503` | Live hub at capacity |
