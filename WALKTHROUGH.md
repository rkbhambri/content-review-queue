# Walkthrough video script (2–3 min)

A tight script for recording a Loom (or equivalent) demo of the Content Review
Queue. Total runtime ~2:45. Timings are guidance — speak naturally.

> Paste the final video link at the top of this file and in the README once recorded:
>
> **▶️ Video:** _<add Loom link here>_

---

## Before you hit record (setup checklist)

- [ ] Stack is up and healthy: `docker compose up -d` → all three containers healthy.
- [ ] Reservation hold is short for the demo: override `RESERVATION_TTL_MINUTES=1`
      (default is 20) so the auto-release is visible on camera, e.g.
      `RESERVATION_TTL_MINUTES=1 docker compose up -d`.
- [ ] (Optional) Enable live ingestion so new tickets appear during the demo:
      set `GENERATE_TICKETS=true` (and e.g. `GENERATE_INTERVAL_MS=10000`) and restart.
- [ ] Open these tabs:
  - UI: http://localhost:8080
  - Swagger: http://localhost:3000/api/docs
  - (Optional) DBeaver on `localhost:5434` (`review` / `review` / `review_queue`).
- [ ] Open **two** browser windows side by side (a normal one + an incognito one)
      to show locale scoping and real-time SSE between two reviewers.
- [ ] Clear state if you want a clean start: `docker compose down -v && docker compose up -d`.

---

## Script

### 0:00 – 0:20 — What it is (hook)

> "This is a **locale-based content review queue**. Review tickets are tagged
> with a US region — West Coast, East Coast, Midwest, South. A reviewer logs in
> for their region, sees only that region's tickets, reserves one — which holds
> it for a fixed window — and confirms they've started. If they don't confirm in
> time, it's automatically released back to the queue. It's full-stack and runs
> with a single `docker compose up`."

### 0:20 – 0:50 — Approach & architecture

Show the architecture diagram in the README (or just talk over the UI).

> "Three containers: a **React + Vite** UI behind nginx, a **NestJS + TypeORM**
> API, and **PostgreSQL**. I deliberately kept the infrastructure minimal — no
> Redis or message broker. Caching, rate limiting, the real-time event bus, and
> the background reaper are all **in-process**, which is the right trade-off for a
> single-instance service and keeps the stack to just these three pieces.
> The backend is organized in a **layered architecture** — controllers, services,
> entities, dtos, interfaces — and there's an **OpenAPI/Swagger** spec generated
> from the code."

### 0:50 – 1:15 — Login & locale scoping

- Window A: log in as `reviewer-1` / **West Coast**.
- Window B (incognito): log in as `reviewer-2` / **East Coast**.

> "Login is locale-scoped — the locale is baked into the JWT. Notice reviewer-1
> on the West Coast and reviewer-2 on the East Coast see **completely different**
> ticket lists. A reviewer can never see or claim another region's work."

### 1:15 – 1:45 — Reserve + the hold timer

- Window A: click **Reserve** on a ticket.

> "Reserving is **atomic** — it's a single conditional UPDATE inside a
> transaction, so under a race only one reviewer can win; the other gets a 409.
> The ticket moves to my **Holds** panel with a live countdown. For the demo the
> hold is one minute; in the brief it's twenty."

- (Optional) Briefly show in Window B that this ticket is **not** claimable there.

### 1:45 – 2:05 — Confirm + real-time updates

- Window A: click **Confirm processing** before the timer runs out.

> "I confirm within the window and it's locked in as mine. Updates are pushed in
> **real time over Server-Sent Events** — watch the metrics panel and lists
> update live without a manual refresh."

### 2:05 – 2:25 — Auto-release (the core feature)

- Window A: reserve **another** ticket and **don't** confirm it. Let the 1-minute
  timer expire on camera.

> "Here's the heart of the problem: if I don't confirm in time, a **background
> reaper** releases the hold and the ticket is **re-queued** automatically —
> see it pop back into the available list, ready for someone else."

### 2:25 – 2:40 — Refresh persistence + metrics

- Window A: reserve one, then **refresh the page**.

> "Holds survive a refresh — they're restored from the server via the
> `/tickets/active` endpoint, not just kept in browser memory. And the
> `/metrics` endpoint gives queue health: counts by status and locale plus
> reservation lifecycle."

### 2:40 – 2:45 — Swagger + close

- Switch to the Swagger tab at `/api/docs`.

> "Every endpoint is documented in Swagger and exported as an OpenAPI spec.
> Everything you saw came up from one `docker compose up`. Thanks for watching."

---

## Optional 20-second add-ons (if you have time)

- **Concurrency:** open Swagger in two tabs and fire `reserve` on the same ticket
  twice quickly — show one `200` and one `409 Conflict`.
- **Testing:** mention the Postgres-backed integration tests prove the
  concurrency + expiry logic (`RUN_DB_TESTS=true npm test`), using a controllable
  clock so the 20-minute window is tested in milliseconds.
- **DB view:** in DBeaver, show the `reservations` table — `status` flipping
  `active → expired` and `reserved_at` / `expires_at` one window apart.

## Talking-point cheat sheet (the "why")

- **Conditional UPDATE** over `SELECT … FOR UPDATE` → simple, race-safe claim.
- **Reservation as its own table** → auditable lifecycle, normalized model.
- **Two-layer expiry** → scheduled reaper (progress with no traffic) + lazy sweep
  on reads (freshness), sharing one idempotent code path.
- **In-process cache / events / reaper** → minimal infra; documented path to
  Redis for horizontal scaling in the README roadmap.
- **File-system ingestion** → declarative, idempotent, easy to swap for a real
  queue later.
