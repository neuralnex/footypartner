# Operations

How to run Football Pulse locally, what happens on first boot, and what to watch in production.

---

## Requirements

- Node.js 18+
- A **funded Solana devnet wallet** (base58 secret key) — needs SOL for the one-time `subscribe` transaction
- A **Gemini API key** — for narratives and chat
- Network access to `txline-dev.txodds.com` and `api.devnet.solana.com`

---

## First-time setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Notes |
|----------|----------|-------|
| `SOLANA_MASTER_PRIVATE_KEY` | Yes | Base58 secret key. Server-only. Never commit. |
| `GEMINI_API_KEY` | Yes | For `/chat` and live narratives |
| `TXLINE_NETWORK` | No | `devnet` (default) or `mainnet` |
| `TXLINE_SCORE_DELAY_MS` | No | Default `60000`. Gates AI narrative cadence on devnet. |

Optional tuning vars for cache, rate limits, and hub caps are in `.env.example`.

```bash
npm run dev
```

Open http://localhost:3000.

---

## What happens on boot

1. Next.js starts and calls `instrumentation.ts`
2. The custodian checks `.txline-cache.json` in the project root
3. If no cached credentials:
   - Requests a guest JWT
   - Submits the on-chain `subscribe` transaction (service level 1, 4 weeks, 0 cost on free tier)
   - Activates the API token
   - Writes credentials to `.txline-cache.json` (mode `0600`)
4. A 20-minute timer refreshes the guest JWT in the background

**First boot takes longer** — you're waiting on a Solana confirmation. Subsequent boots use the cache and are fast.

If warm-up fails, the server still starts. The first API request will retry the pipeline via `getCustodian()`.

---

## Credential lifecycle

| File / mechanism | Purpose |
|------------------|---------|
| `.txline-cache.json` | Persists JWT, API token, subscribe tx sig across restarts |
| `singleton.ts` refresh timer | Proactive JWT refresh every 20 min |
| `withFreshSession()` | Reactive refresh + retry on 401/403 |

**Don't delete `.txline-cache.json` casually.** You'll need a fresh on-chain subscribe (or wait for expiry) if the wallet already has an active subscription.

**Don't re-run activation** with the same `txSig` — TxLINE returns 403. Refresh the JWT only.

---

## Devnet vs mainnet

Config lives in `lib/txline/config.ts`. Set `TXLINE_NETWORK=devnet` or `mainnet`.

| | Devnet | Mainnet |
|---|--------|---------|
| API origin | `txline-dev.txodds.com` | `txline.txodds.com` |
| Program ID | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` |
| Odds sampling (free tier) | ~60 seconds | Depends on tier |

The app was built and tested on devnet. Mainnet needs a funded wallet with TxLINE tokens for paid tiers.

---

## Production build

```bash
npm run build
npm start
```

Set all env vars in your host's secrets manager — not in the repo. The custodian cache path can be overridden with `TXLINE_CACHE_PATH` if you need a writable volume in Docker.

### Docker considerations

- Mount a volume for `.txline-cache.json` so restarts don't re-subscribe
- Single instance is fine for the in-memory cache and live hub
- Multiple instances need Redis (or similar) for shared cache and rate limits — not implemented yet

---

## Monitoring

**`GET /api/health`** — basic liveness plus live hub stats.

Watch server logs for:
- `[txline] custodian pipeline ready` — boot OK
- `[txline] session rejected, refreshing` — JWT expired, auto-recovering
- `[txline] scheduled refresh failed` — background refresh issue, may need manual intervention
- `[api/fixtures/board]` errors — TxLINE fixture fetch failure

---

## Manual recovery scripts

In `scripts/`:

| Script | When to use |
|--------|-------------|
| `manual_activate.js` | Re-activate API token from cached JWT + tx sig |
| `pull_fixture.js` | Debug snapshot/scores/historical for a fixture ID |
| `check_scores.js` | Spot-check scores across a day's fixtures |
| `pull_scores_central.js` | Inspect raw score update response format |

Run with the same `.env` loaded (scripts read `.env` if env vars aren't set).

---

## Security checklist

- [ ] `SOLANA_MASTER_PRIVATE_KEY` only in server env / secrets manager
- [ ] `.txline-cache.json` in `.gitignore` (contains JWT + API token)
- [ ] `.env` not committed
- [ ] `GEMINI_API_KEY` server-side only
- [ ] Rate limits enabled (default on — see [Scalability](./SCALABILITY.md))

This is a custodial hackathon setup. Production with real funds should use a KMS-backed signer and per-tenant auth.
