# Football Pulse

**A live match companion for World Cup 2026 — powered by TxLINE and Gemini.**

Football Pulse explains the game as it unfolds. Browse every World Cup fixture from group stage through knockouts, follow live scores and demargined odds in real time, and get AI-generated match summaries plus an interactive chat panel — all in a broadcast-style dark UI built for companion viewing alongside the match.

---

## What it does

### Match board
The homepage is a day-by-day fixture feed for the World Cup. Scroll through dates, search by team, and tap any match to open it. Live fixtures show a pulsing indicator and a **Pulse** badge; finished matches open as archives with full score history.

### Live companion (`/fixture/[id]`)
When a match is in play, Football Pulse becomes a full companion dashboard:

| Tab | What you get |
|-----|--------------|
| **Summary** | AI narrative pillars — match pulse, why it matters, what-if scenarios |
| **Events** | Goal, card, and substitution timeline |
| **Stats** | Possession, shots, passes, and more from the TxLINE scores feed |
| **Lineups** | Starting XI and bench |
| **Odds** | Live demargined probabilities and market lines (live matches only) |
| **Ask AI** | Chat with Gemini about the match, scores, and odds context |

Archive mode (finished or upcoming fixtures) still shows scores, events, stats, lineups, and chat — but disables the live stream, odds tab, and AI narrative feed.

### Under the hood
- **TxLINE devnet** — canonical World Cup scores and StablePrice odds via a server-side custodial subscription
- **Gemini** — narrative generation and conversational Q&A
- **Next.js 15** — App Router, server-side API routes, SSE streaming to the browser

---

## Quick start

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|----------|-------------|
| `SOLANA_MASTER_PRIVATE_KEY` | Base58-encoded devnet keypair with SOL for the on-chain `subscribe` transaction |
| `TXLINE_NETWORK` | `devnet` (default) or `mainnet` |
| `GEMINI_API_KEY` | Google Gemini API key for AI features |

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first boot the server runs the TxLINE custodian pipeline (guest JWT → on-chain subscribe → API token activation) and caches credentials in `.txline-cache.json`.

> **Devnet note:** The free World Cup tier samples odds roughly every 60 seconds. Set `TXLINE_SCORE_DELAY_MS=60000` (default) to align AI narrative cadence with that delay. Scores themselves are not throttled.

---

## Architecture

```
Browser
  │
  ├─ GET /api/fixtures/board          → World Cup fixtures for a calendar day
  ├─ GET /api/fixtures/[id]/stream    → SSE: scores + odds + AI narrative (live only)
  ├─ GET /api/fixtures/[id]/odds      → Demargined odds snapshot or updates
  ├─ POST /api/fixtures/[id]/chat     → Gemini chat with match context
  └─ GET /api/scores/*                → Score snapshot, updates, historical

Server (lib/txline/)
  │
  ├─ custodian.ts    → Solana subscribe + token activation
  ├─ singleton.ts    → Cached credentials, 20-min refresh, 401 retry
  ├─ fixtures.ts     → Fixture snapshot + historical day queries
  ├─ scores.ts       → Score snapshot, updates, stream, historical
  ├─ odds.ts         → Odds snapshot + updates
  └─ parser.ts       → Normalizes raw TxLINE odds into probabilities + markets
```

Authentication is fully server-side. The browser never holds a Solana wallet or TxLINE tokens.


## API routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Liveness check |
| `/api/fixtures/board?epochDay=N` | GET | All World Cup fixtures for a calendar day with status and scores |
| `/api/fixtures/[id]/stream` | GET | SSE aggregator: scores stream, odds stream, AI narrative |
| `/api/fixtures/[id]/odds?source=snapshot\|updates` | GET | Normalized odds for a fixture |
| `/api/fixtures/[id]/chat` | POST | AI chat with match context |
| `/api/fixtures/[id]/narrative` | GET | One-shot odds + Gemini narrative |
| `/api/scores/snapshot?fixtureId=N` | GET | Latest score state for a fixture |
| `/api/scores/historical?fixtureId=N` | GET | Full score history for finished matches |
| `/api/scores/updates?fixtureId=N` | GET | Live score updates from the 5-minute cache |

---

## Pages

| Path | Description |
|------|-------------|
| `/` | Match board with date scroller and search |
| `/fixture/[fixtureId]` | Live companion or archive dashboard |
| `/match/[id]` | Redirects to `/fixture/[id]` |

---

## Technical documentation

Full engineering docs live in **[docs/](docs/README.md)**:

- [Architecture](docs/ARCHITECTURE.md) — data flow, auth model, live vs archive modes
- [API Reference](docs/API.md) — routes, SSE events, error codes
- [Operations](docs/OPERATIONS.md) — setup, credentials, deployment
- [Scalability](docs/SCALABILITY.md) — caching, live hub, rate limits
- [TxLINE Integration](docs/TXLINE_INTEGRATION.md) — external API reference and platform quirks

---

## Security

`SOLANA_MASTER_PRIVATE_KEY` is a custodial signing key. Keep it in server environment variables or a secrets manager — never in source control, client bundles, or logs. Appropriate for a devnet hackathon demo; use a KMS-backed signer before any mainnet deployment with real funds.

---

## License

Hackathon project — see repository for details.
