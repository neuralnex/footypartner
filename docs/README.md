# FootyPartner — Technical Documentation

This folder is the engineering reference for FootyPartner. The [README](../README.md) at the repo root is the product overview; what's here is how the thing actually works.

## What's in here

| Document | What you'll find |
|----------|------------------|
| [Architecture](./ARCHITECTURE.md) | How data flows from TxLINE and Gemini into the browser, and why we built it this way |
| [API Reference](./API.md) | Every route we expose, request/response shapes, and SSE event types |
| [Operations](./OPERATIONS.md) | Environment variables, first boot, credential caching, and running in production |
| [Scalability](./SCALABILITY.md) | How we handle many concurrent users without a login system |
| [TxLINE Integration](./TXLINE_INTEGRATION.md) | Which TxLINE endpoints we call and known quirks on their side |

## Stack at a glance

- **Next.js 15** (App Router) — pages, API routes, middleware
- **TxLINE devnet** — World Cup scores and StablePrice odds
- **Solana / Anchor** — on-chain subscription for the free World Cup tier
- **Google Gemini** — live narratives and match chat
- **Tailwind CSS** — custom broadcast-style design system

## Repo layout (the parts that matter)

```
app/
  page.tsx                          Homepage match board
  fixture/[fixtureId]/
    page.tsx                        Server render + isPulse detection
    FixtureDashboard.tsx            Live companion UI (tabs, SSE client)
  api/                              BFF layer over TxLINE + Gemini

lib/
  txline/                           TxLINE client, parser, live hub
  ai/                               Narrative and chat engines
  infra/                            Cache, rate limits, concurrency helpers

middleware.ts                       Per-IP rate limiting on /api/*
instrumentation.ts                  Warms TxLINE custodian on server boot
```

If you're onboarding to the codebase, read **Architecture** first, then **API** if you're touching routes, or **Operations** if you're deploying.
