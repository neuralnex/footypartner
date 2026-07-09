# TxLINE API — Endpoints Used & Platform Issues

Football Pulse talks to **TxLINE devnet** (`https://txline-dev.txodds.com`) on **service level 1** — the free World Cup tier. This doc is a reference for which of their endpoints we actually call, and what we ran into on their side while building.

For how we wire those calls into the app, see [Architecture](./ARCHITECTURE.md). For our own API surface, see [API Reference](./API.md).

**Their docs:** [txline-docs.txodds.com](https://txline-docs.txodds.com) · [OpenAPI YAML](https://txline.txodds.com/docs/docs.yaml)

---

## Endpoints we called

### Auth & activation

| Endpoint | Method | Documentation | How we used it |
|----------|--------|---------------|----------------|
| `/auth/guest/start` | POST | [Quickstart](https://txline.txodds.com/documentation/quickstart) | Obtain anonymous guest JWT before on-chain subscribe |
| On-chain `subscribe` | Solana tx | [Quickstart](https://txline.txodds.com/documentation/quickstart) | Register World Cup free tier (service level 1, 4 weeks) |
| `/api/token/activate` | POST | [Quickstart](https://txline.txodds.com/documentation/quickstart) | Exchange `txSig` + wallet signature for `X-Api-Token` |

All data calls below require both headers: `Authorization: Bearer <jwt>` and `X-Api-Token: <token>`.

---

### Fixtures

| Endpoint | Method | Documentation | How we used it |
|----------|--------|---------------|----------------|
| `/api/fixtures/snapshot` | GET | [Fetching Snapshots](https://txline.txodds.com/documentation/examples/fetching-snapshots) | List fixtures; `?startEpochDay=N` for forward window; filter World Cup by `Competition` |
| `/api/fixtures/updates/{epochDay}/{hourOfDay}` | GET | [OpenAPI](https://txline.txodds.com/docs/docs.yaml) | Fetch all 24 hourly batches for a calendar day to recover past fixtures |

**Not called:** `/api/fixtures/validation`

---

### Scores

| Endpoint | Method | Documentation | How we used it |
|----------|--------|---------------|----------------|
| `/api/scores/snapshot/{fixtureId}` | GET | [Fetching Snapshots](https://txline.txodds.com/documentation/examples/fetching-snapshots) | Current score, minute, stats, lineups; fixture board enrichment |
| `/api/scores/updates/{fixtureId}` | GET | [Fetching Snapshots](https://txline.txodds.com/documentation/examples/fetching-snapshots) | Live score polling fallback (5-minute cache) |
| `/api/scores/historical/{fixtureId}` | GET | [Scores Overview](https://txline.txodds.com/documentation/scores/overview) | Full event timeline for finished matches |
| `/api/scores/stream` | GET | [Streaming Data](https://txline.txodds.com/documentation/examples/streaming-data) | SSE live score feed; `?fixtureId=N` |
| `/api/scores/updates/{epochDay}/{hourOfDay}/{interval}` | GET | [OpenAPI](https://txline.txodds.com/docs/docs.yaml) | Exposed via utility route; not used in main UI |

**Not called in UI:** `/api/scores/stat-validation`

---

### Odds

| Endpoint | Method | Documentation | How we used it |
|----------|--------|---------------|----------------|
| `/api/odds/snapshot/{fixtureId}` | GET | [Fetching Snapshots](https://txline.txodds.com/documentation/examples/fetching-snapshots) | Latest demargined odds per market line; optional `?asOf=` for historical |
| `/api/odds/updates/{fixtureId}` | GET | [OpenAPI](https://txline.txodds.com/docs/docs.yaml) | Live odds from 5-minute in-memory cache |
| `/api/odds/stream` | GET | [Streaming Data](https://txline.txodds.com/documentation/examples/streaming-data) | SSE live odds feed; `?fixtureId=N` |

**Not called:** `/api/odds/updates/{epochDay}/{hourOfDay}/{interval}`, `/api/odds/validation`

---

## Platform issues (TxLINE side)

Issues observed from the API, docs, or devnet service — not bugs in our application logic.

### 1. `startEpochDay` is not a calendar-day filter

**Endpoint:** `GET /api/fixtures/snapshot`

**Documented behaviour:** *"The day at or within 30 days after which the fixtures start."*

**Issue:** The parameter name and typical usage pattern imply "fixtures on this date." It actually returns fixtures whose kickoff is **on or after** that day. There is no query parameter to request "all fixtures on epoch day X." Building a day-by-day match board requires combining this endpoint with hourly historical updates and client-side date filtering.

---

### 2. No single endpoint for "fixtures on a given day"

**Endpoints:** `GET /api/fixtures/snapshot` + `GET /api/fixtures/updates/{epochDay}/{hourOfDay}`

**Issue:** To list past World Cup matches for one calendar day, callers must hit the updates endpoint for all 24 hours of that day, merge results, and dedupe by `FixtureId`. This is workable but undocumented as a recommended pattern and adds 24 round-trips per day.

---

### 3. Scores REST endpoints sometimes return SSE-formatted bodies

**Endpoints:** `GET /api/scores/updates/{fixtureId}`, `GET /api/scores/historical/{fixtureId}`

**Documented behaviour:** OpenAPI specifies `application/json` array responses.

**Observed behaviour:** Responses intermittently arrive as `text/event-stream`-style lines (`data: {...}\n`) instead of a JSON array. Content-Type and body format are inconsistent with the spec and with the dedicated `/api/scores/stream` SSE endpoint.

---

### 4. Token re-activation rejected with HTTP 403

**Endpoint:** `POST /api/token/activate`

**Issue:** Calling activate again with the same `txSig` after a token has already been issued returns **403**. The docs describe the activation flow for first-time setup but do not clearly document recovery when a JWT expires while the API token and on-chain subscription remain valid. Refreshing only the guest JWT is required; re-activation is not possible.

---

### 5. On-chain `subscribe` cannot be called while subscription is active

**Program:** TxLINE Solana program (devnet)

**Issue:** A second `subscribe()` transaction for the same wallet hits the `ActiveSubscription` on-chain error. Expected contract behaviour, but it makes dev/test iteration harder — a new wallet or waiting for expiry is needed to re-subscribe. Not an off-chain API bug, but a platform constraint worth noting.

---

### 6. Devnet free tier odds sampling delay (~60 seconds)

**Endpoints:** `/api/odds/snapshot`, `/api/odds/updates`, `/api/odds/stream`

**Documented behaviour:** Free World Cup tier samples odds in real time every ~60 seconds.

**Issue:** Not a bug — it is the documented SLA. On devnet, live odds and any product built on them will lag well behind scores. Scores stream in near real time; odds do not. This gap is easy to miss when reading only the streaming docs.

---

### 7. Fixtures updates endpoint summary is misleading in OpenAPI

**Endpoint:** `GET /api/fixtures/updates/{epochDay}/{hourOfDay}`

**OpenAPI summary:** *"Get all fixture updates for a single fixture on a given day."*

**Actual behaviour:** Returns all fixture updates published during that **UTC hour** across competitions — not scoped to one fixture. The summary text does not match the path parameters or response shape.

---

### 8. Soccer game state codes require separate feed documentation

**Endpoints:** `/api/scores/*`, `/api/odds/*` (`GameState` field)

**Issue:** Live vs finished detection depends on phase codes (`H1`, `HT`, `H2`, `F`, etc.) defined in the [Soccer Feed](https://txline.txodds.com/documentation/scores/soccer-feed) doc, not in the OpenAPI schema enums. The API returns raw strings without a machine-readable enum in the spec, making correct live detection dependent on reading the feed docs separately.

---

### 9. Phantom fixtures with no score feed

**Endpoints:** `GET /api/fixtures/updates/{epochDay}/{hourOfDay}`, `GET /api/scores/historical/{fixtureId}`

**Observed behaviour:** Some World Cup fixtures appear in the fixture feed (e.g. **Tunisia vs Switzerland**, `FixtureId` **17588400**, scheduled 25 Jun 2026) but return **zero** score snapshot, historical, or stream events after kickoff. The fixture row exists with teams and `StartTime`, yet there is no match data to consume.

**Impact:** Callers cannot distinguish a cancelled/postponed match from a data gap without heuristics. Football Pulse marks these as `unavailable` when kickoff was more than three hours ago and no score history exists.

---

### 10. Finished matches report `GameState: F` during extra time

**Endpoints:** `GET /api/scores/historical/{fixtureId}`, `GET /api/scores/stream`

**Observed behaviour:** During knockout extra time, many events carry `GameState: F` (full time) while `Minutes` continues past 90 (e.g. 104', 116'). Separate ET phase codes (`ET1`, `ET2`) appear on some events but not consistently. The final `game_finalised` event is always `F`, even when the match went to **AET** or **penalties** — there is no reliable `FET` / `FPE` on the closing event.

**Impact:** Products cannot rely on `GameState` alone to label knockout results. ET must be inferred from `Score.Participant*.ET1/ET2/PE` totals and/or minute values above 95 in the event timeline.

---

## Summary

| Category | Endpoints called | Not called |
|----------|------------------|------------|
| Auth | 3 (guest, subscribe, activate) | — |
| Fixtures | 2 | `fixtures/validation` |
| Scores | 5 | `scores/stat-validation` (wired, unused in UI) |
| Odds | 3 | `odds/updates/{day}/{hour}/{interval}`, `odds/validation` |
| **Total** | **13 off-chain + 1 on-chain** | **4** |
