# Content Review Queue

A locale-based content review queue. Review tickets are tagged with a locale
(West Coast, East Coast, Midwest, South). Reviewers authenticate against a
locale, browse only the tickets in that locale, **reserve** one (held for the
reservation window), and **confirm** they have started processing it. If a
reservation is not confirmed within the window, it is **automatically released**
back into the queue for someone else.

> The hold is **20 minutes** (`RESERVATION_TTL_MINUTES`), per the brief. Lower it
> (e.g. `1`) to make the auto-release flow quick to test or to record the demo.

> Full stack, fully containerized. `docker compose up` brings up Postgres, the
> API, and the web UI.

---

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Project layout](#project-layout)
- [Ticket ingestion strategy](#ticket-ingestion-strategy)
- [Data model](#data-model)
- [Time-bound reservation logic](#time-bound-reservation-logic)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Local development (without Docker)](#local-development-without-docker)
- [Testing](#testing)
- [Design decisions & trade-offs](#design-decisions--trade-offs)
- [Bonus features](#bonus-features)
- [How LLMs were used](#how-llms-were-used)
- [Roadmap](#roadmap)

---

## Architecture

```
                 ┌──────────────────────────────┐
   Browser  ───► │  ui (nginx + React SPA)       │
                 │  serves UI, proxies /api/*    │
                 └───────────────┬──────────────┘
                                 │  REST + SSE
                 ┌───────────────▼──────────────┐
                 │  backend (NestJS API)         │
                 │  • auth (JWT, locale-scoped)  │
                 │  • tickets: available/reserve │
                 │    /confirm/stream            │
                 │  • reservation reaper (timer) │
                 │  • in-memory cache + rate lim │
                 │  • SSE event bus (RxJS)       │
                 └───────────────┬──────────────┘
                                 │  TypeORM
                 ┌───────────────▼──────────────┐
                 │  db (PostgreSQL)              │
                 └──────────────────────────────┘
```

No Redis or external broker: caching, rate limiting, the event bus, and the
reaper are all in-process. This keeps the single-instance deployment simple;
the [Roadmap](#roadmap) covers what changes when scaling horizontally.

## Tech stack

| Layer    | Choice                                                              |
| -------- | ------------------------------------------------------------------ |
| Backend  | NestJS, TypeScript, TypeORM, PostgreSQL (layered architecture)     |
| Auth     | JWT (`@nestjs/jwt` + Passport `jwt` strategy), locale in the token |
| Realtime | Server-Sent Events via Nest `@Sse()` + an RxJS subject            |
| UI       | React + Vite + TypeScript, served by nginx                        |
| Docs     | OpenAPI/Swagger (`@nestjs/swagger`) at `/api/docs` + `openapi.json`|
| Tests    | Jest (+ a Postgres-backed integration suite)                      |
| Infra    | Docker, docker-compose                                            |

Both apps use a `@/` path alias (mapping to `src/`), barrel `index.ts` exports
per folder, and shared ESLint/Prettier config. Conventions are codified in
[`.cursor/rules/`](.cursor/rules) (`project-`, `backend-`, `ui-standards.mdc`).

### Response envelope

Every successful JSON response is wrapped consistently and errors share one
shape; the SSE stream opts out (raw events). The UI unwraps `entity` centrally.

```jsonc
// success
{ "status": true,  "statusCode": 200, "message": "Success", "entity": { /* data */ } }
// error
{ "status": false, "statusCode": 409, "message": "Ticket is no longer available", "error": "Conflict" }
```

## Quick start

Requirements: Docker + Docker Compose.

```bash
docker compose up --build
```

Then open:

| URL                                | What                              |
| ---------------------------------- | --------------------------------- |
| http://localhost:8080              | Web UI (login → browse → reserve → confirm) |
| http://localhost:3000/api          | API root                          |
| http://localhost:3000/api/docs     | Swagger UI (interactive)          |
| http://localhost:3000/api/health   | Liveness probe                    |

The backend seeds 15 demo tickets across the four locales on first boot. Log in
with any reviewer id (e.g. `reviewer-1`) and pick a locale.

To stop and wipe the database volume:

```bash
docker compose down -v
```

## Project layout

The backend follows a **layered** architecture (folders by responsibility,
each with a barrel `index.ts`); the UI mirrors the same idea.

```
.
├── docker-compose.yml          # db + backend + ui
├── .env.example                # all tunables (copy to .env to override)
├── .cursor/rules/              # project / backend / ui coding standards
├── backend/
│   ├── src/
│   │   ├── controllers/        # HTTP routing only (auth, tickets, metrics, health)
│   │   ├── services/           # business logic (auth, reservations, tickets,
│   │   │                       #   metrics, reaper, seed, clock, cache, events)
│   │   ├── entities/           # TypeORM entities (reviewer, ticket, reservation)
│   │   ├── enums/              # Locale, TicketStatus, ReservationStatus
│   │   ├── dtos/               # request + Swagger response DTOs
│   │   ├── interfaces/         # `I`-prefixed shapes (IAuthUser, IMetricsSummary…)
│   │   ├── types/              # type aliases / string unions
│   │   ├── guards/             # JwtAuthGuard, RateLimitGuard
│   │   ├── strategies/         # Passport JWT strategy (header + SSE query token)
│   │   ├── decorators/         # @CurrentUser, @SkipSuccessWrapper
│   │   ├── utilities/          # success interceptor, error filter, swagger
│   │   ├── modules/            # Nest module wiring (+ global CommonModule)
│   │   └── config/             # typed env configuration
│   ├── tickets/<locale>/*.json # ticket seed source (file-system ingestion)
│   ├── scripts/generate-openapi.ts
│   └── openapi.json            # exported API spec (committed)
└── ui/
    └── src/
        ├── app/                # root App + page composition
        ├── components/<feature>/ # auth, tickets, metrics components
        ├── apis/ (+ urls/)     # API clients + endpoint paths
        ├── hooks/              # useNow, useTicketStream
        ├── interfaces/         # `I`-prefixed shapes + component props
        ├── types/              # Locale, status unions
        ├── constants/          # locales, storage key, SSE event names
        ├── utilities/          # axios client (envelope unwrap), session storage
        └── styles/             # global stylesheet
```

## Ticket ingestion strategy

**Chosen approach: a file-system source ingested on boot.**

Tickets live as JSON files under `backend/tickets/<locale>/*.json`, e.g.
`backend/tickets/west-coast/ticket_001.json`. On startup,
[`SeedService`](backend/src/services/seed.service.ts) reads every file, derives a
stable `externalRef` of `"<locale>/<filename>"`, and inserts any tickets not
already present.

Why this approach:

- **Declarative & reviewable** — adding a ticket is adding a file; the locale is
  encoded by the folder, mirroring the example in the brief.
- **Idempotent** — keying on `externalRef` means re-runs never duplicate, so the
  service can safely seed on every boot.
- **Decoupled** — the rest of the system only ever reads tickets from the
  database, so swapping the source (a real queue, an upstream API) later touches
  only this one module.

A second, optional source simulates **continuous ingestion**:
[`TicketGeneratorService`](backend/src/services/ticket-generator.service.ts). When
`GENERATE_TICKETS=true`, it periodically inserts a fresh ticket into a random
locale and emits a live `ticket.available` event — handy for demoing a
"continuous supply of tickets".

Potential improvements: validate ticket files against a JSON schema, watch the
directory for hot-reloading, or replace the file source with a real message
queue (the ingestion seam already isolates this).

## Data model

Three normalized tables keep tickets, reviewers, and reservations cleanly
separated.

```
reviewers                 tickets                       reservations
─────────                 ───────                       ────────────
id (uuid, pk)             id (uuid, pk)                 id (uuid, pk)
reviewer_id (unique)      external_ref (unique)         ticket_id (fk → tickets)
locale                    locale                        reviewer_id
created_at                status                        status
updated_at                payload (jsonb)               reserved_at
                          created_at / updated_at       expires_at
                                                        confirmed_at
```

- `Ticket.status` (`available | reserved | confirmed | completed`) is the single
  source of truth for claimability. Indexed on `(locale, status)` for the hot
  "available tickets for my locale" query.
- `Reservation` records the full lifecycle of each hold
  (`active | confirmed | expired | released`), giving an auditable history
  rather than overwriting state on the ticket. Indexed on `(status, expires_at)`
  for the reaper's scan.

See the entities:
[`ticket.entity.ts`](backend/src/entities/ticket.entity.ts),
[`reservation.entity.ts`](backend/src/entities/reservation.entity.ts),
[`reviewer.entity.ts`](backend/src/entities/reviewer.entity.ts).

## Time-bound reservation logic

The reservation window and auto-release are the core of the problem, implemented
in [`ReservationsService`](backend/src/services/reservations.service.ts). The
window length is `RESERVATION_TTL_MINUTES` (default 20; lower it for testing).

**Concurrency-safe reservation.** Reserving is a single *conditional* UPDATE
inside a transaction:

```sql
UPDATE tickets SET status = 'reserved'
WHERE id = $1 AND status = 'available' AND locale = $2;
```

Postgres row locks make this a safe compare-and-swap: of two reviewers racing
for the same ticket, exactly one sees `affected = 1`; the other re-reads a
non-available row and receives `409 Conflict`. The matching reservation row is
created in the same transaction. (This is verified by an integration test that
fires two reservations concurrently.)

**Auto-release in two layers:**

1. A scheduled **reaper**
   ([`reaper.service.ts`](backend/src/services/reaper.service.ts)) runs every
   `REAPER_INTERVAL_MS`, flips `active` reservations whose `expires_at` has
   passed to `expired`, and re-queues the ticket (`reserved → available`).
2. A **lazy sweep** runs on the read path (`GET /tickets/available`) so a
   just-expired ticket reappears immediately, even between reaper cycles.

Both paths use the same idempotent, transactional release, and time is read
through an injectable [`ClockService`](backend/src/services/clock.service.ts) so
the expiry window is tested deterministically without real waiting.

## API reference

Interactive docs: **http://localhost:3000/api/docs**. The spec is also exported
to [`backend/openapi.json`](backend/openapi.json) (regenerate with
`npm run generate:openapi`).

| Method | Endpoint                  | Auth   | Purpose                                   |
| ------ | ------------------------- | ------ | ----------------------------------------- |
| POST   | `/api/auth/login`         | –      | Authenticate a reviewer, returns a JWT    |
| GET    | `/api/tickets/available`  | Bearer | List claimable tickets for your locale    |
| POST   | `/api/tickets/:id/reserve`| Bearer | Reserve an available ticket (held for the TTL) |
| POST   | `/api/tickets/:id/confirm`| Bearer | Confirm processing within the window      |
| GET    | `/api/tickets/stream`     | Bearer¹| SSE stream of locale-scoped events        |
| GET    | `/api/metrics`            | –      | Queue health metrics                      |
| GET    | `/api/health`             | –      | Liveness                                  |

¹ SSE: the browser `EventSource` API cannot set headers, so the stream accepts
the JWT via an `access_token` query parameter.

### curl walkthrough

```bash
BASE=http://localhost:3000/api

# 1. Authenticate (grab the token; it's under .entity in the envelope)
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"reviewerId":"reviewer-1","locale":"west-coast"}' | jq -r .entity.accessToken)

# 2. Browse available tickets for this locale
curl -s $BASE/tickets/available -H "Authorization: Bearer $TOKEN" | jq

# 3. Reserve one (use an id from step 2)
curl -s -X POST $BASE/tickets/<TICKET_ID>/reserve \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Confirm it within the hold window (RESERVATION_TTL_MINUTES)
curl -s -X POST $BASE/tickets/<TICKET_ID>/confirm \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Queue metrics
curl -s $BASE/metrics | jq

# 6. Subscribe to live events (locale-scoped)
curl -N "$BASE/tickets/stream?access_token=$TOKEN"
```

Representative responses (note the shared envelope — payload is under `entity`):

```jsonc
// POST /auth/login
{
  "status": true, "statusCode": 200, "message": "Success",
  "entity": { "accessToken": "eyJ...", "reviewer": { "reviewerId": "reviewer-1", "locale": "west-coast" } }
}

// POST /tickets/:id/reserve
{
  "status": true, "statusCode": 200, "message": "Success",
  "entity": {
    "ticket":      { "id": "…", "status": "reserved", "locale": "west-coast", "payload": { … } },
    "reservation": { "id": "…", "status": "active", "expiresAt": "2026-…T…Z", "confirmedAt": null }
  }
}
```

## Configuration

All settings have sensible defaults; override via environment variables (copy
`.env.example` to `.env`, which docker-compose loads automatically).

| Variable                  | Default  | Description                                  |
| ------------------------- | -------- | -------------------------------------------- |
| `RESERVATION_TTL_MINUTES` | `20`     | Hold duration before auto-release            |
| `REAPER_INTERVAL_MS`      | `15000`  | How often the reaper scans for expirations   |
| `CACHE_TTL_MS`            | `3000`   | In-memory cache TTL for available list/metrics |
| `RATE_LIMIT_MAX`          | `30`     | Max reserve attempts per reviewer per window |
| `RATE_LIMIT_WINDOW_MS`    | `60000`  | Rate-limit window                            |
| `SEED_ON_BOOT`            | `true`   | Ingest ticket files on startup               |
| `GENERATE_TICKETS`        | `false`  | Enable the continuous ticket generator       |
| `GENERATE_INTERVAL_MS`    | `30000`  | Generator cadence                            |
| `JWT_SECRET`              | `…`      | JWT signing secret (change for production)    |
| `DB_SYNCHRONIZE`          | `true`   | Auto-create schema from entities             |

## Local development (without Docker)

```bash
# Start just Postgres
docker compose up -d db

# Backend (in backend/)
cd backend
npm install
DATABASE_HOST=localhost npm run start:dev      # http://localhost:3000/api

# UI (in ui/)
cd ui
npm install
npm run dev                                     # http://localhost:5173 (proxies /api)
```

## Testing

```bash
cd backend

# Fast unit tests (cache, rate limiter) — no database needed
npm test

# Full suite including the Postgres-backed reservation/expiry integration tests
docker compose up -d db
RUN_DB_TESTS=true DATABASE_HOST=localhost npm test
```

The integration suite
([`reservations.service.spec.ts`](backend/src/services/reservations.service.spec.ts))
covers the parts most worth proving:

- reserving sets the ticket to `reserved`;
- **only one of two concurrent reservers wins** (the other gets `409`);
- cross-locale reservation is forbidden (`403`);
- confirmation succeeds within the window;
- an unconfirmed hold **auto-releases** after the window and re-queues;
- confirming after expiry is rejected (`410`);
- a released ticket can be claimed by another reviewer.

A controllable `FakeClock` advances time so the reservation-expiry logic is
tested in milliseconds. The suite self-skips unless `RUN_DB_TESTS=true`.

## Design decisions & trade-offs

- **Conditional UPDATE over `SELECT … FOR UPDATE`.** A single atomic
  compare-and-swap is simpler and avoids holding explicit locks while still
  being race-safe under the default isolation level.
- **Reservation as its own table.** Keeps an audit trail and normalizes the
  model, rather than stuffing `reserved_by`/`expires_at` onto the ticket.
- **In-process cache / rate limiter / event bus / reaper.** The brief favors a
  working, well-reasoned single deployment; avoiding Redis keeps infra to two
  services. The cost is that these are per-instance — see Roadmap.
- **Lazy + scheduled expiry.** The scheduled reaper guarantees progress with no
  traffic; the lazy sweep guarantees freshness on reads. Both share one
  idempotent code path.
- **`synchronize: true`.** Convenient for the assignment (schema auto-creates on
  boot). For production this would be replaced with explicit migrations.
- **Reviewer auth is simulated.** Login lazily creates the reviewer and trusts
  the supplied id — there is no password, matching "hardcoded reviewer is fine".

### Assumptions

- A reviewer belongs to one locale at a time; logging in under a new locale
  re-points that reviewer (keeps the demo frictionless).
- "Confirm" means processing has begun; a terminal `completed` state is modeled
  but not yet wired to an endpoint.
- Demo ticket volume is small; pagination is deferred (noted in Roadmap).

## Bonus features

All four suggested bonus areas are implemented:

- **`/metrics`** — ticket counts by status and locale, plus reservation
  lifecycle counts.
- **In-memory caching** — short-TTL cache on the available-list and metrics hot
  paths, plus a per-reviewer rate limiter on reserve.
- **Background scheduler** — the reservation reaper releases stale holds.
- **Real-time delivery** — locale-scoped SSE stream; the UI live-refreshes on
  reserve/confirm/release/new-ticket events.
- **Tests** — unit + Postgres-backed integration tests for reservation and
  expiry logic.

## How LLMs were used

An LLM (Cursor) was used to accelerate scaffolding and boilerplate: the NestJS
module/Docker wiring, the React UI components and CSS, the seed JSON files, and
the first drafts of tests and this README. The architecture and the core
decisions — the conditional-UPDATE reservation model, the two-layer expiry
strategy, the normalized schema, the injectable clock for testability, and the
in-process (no-Redis) infrastructure choices — were directed deliberately and
reviewed line by line. No section is included that I cannot explain and defend.

## Roadmap

- **Horizontal scaling.** Move the cache/rate-limiter/event bus to Redis and
  coordinate the reaper with a shared lock or a job queue so multiple API
  replicas don't duplicate work. (Logic is already idempotent, so today's
  behavior is correct but redundant under replicas.)
- **Migrations.** Replace `synchronize` with versioned TypeORM migrations.
- **Pagination & filtering** on the available-tickets endpoint (by priority,
  category, age).
- **Manual release / completion** endpoints and a `completed` workflow.
- **Per-reviewer "my reservations"** endpoint so holds survive a page reload on
  another device.
- **Observability** — Prometheus-format metrics and structured request logging.

---

## Walkthrough video

A 2–3 minute demo covering the system, approach, and architecture.

- **▶️ Video:** _TODO: add Loom (or equivalent) link here._
- **Script / recording guide:** [`WALKTHROUGH.md`](WALKTHROUGH.md) — timed
  segments and a setup checklist for login → browse → reserve → confirm →
  auto-release, plus the real-time, persistence, metrics, and Swagger highlights.
