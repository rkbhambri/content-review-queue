# Getting started

How to run the Content Review Queue locally. For architecture and design, see
[`README.md`](README.md).

## Prerequisites

- **Docker** + **Docker Compose** (only requirement for the quick start)
- For local (non-Docker) development: **Node.js 20+** and npm

## Quick start (Docker — recommended)

From the project root:

```bash
docker compose up --build
```

This builds and starts all three services in the right order (Postgres →
backend → UI) and seeds 15 demo tickets on first boot.

Then open:

| URL                              | What                               |
| -------------------------------- | ---------------------------------- |
| http://localhost:8080            | Web UI (login → browse → reserve → confirm) |
| http://localhost:3000/api        | API root                           |
| http://localhost:3000/api/docs   | Swagger UI                         |
| http://localhost:3000/api/health | Liveness probe                     |

Log in with any reviewer id (e.g. `reviewer-1`) and pick a locale.

Stop everything (and wipe the database volume):

```bash
docker compose down -v
```

## Database access (DBeaver / psql)

The Postgres container is published on host port **5434** (chosen to avoid
clashing with a local Postgres on 5432):

| Field    | Value          |
| -------- | -------------- |
| Host     | `localhost`    |
| Port     | `5434`         |
| Database | `review_queue` |
| User     | `review`       |
| Password | `review`       |

Or from the container: `docker compose exec db psql -U review -d review_queue`.

## Local development (hot reload, no rebuilds)

Run only Postgres in Docker; run the apps locally so saves reflect instantly.

```bash
# 1. start just the database
docker compose up -d db

# 2. backend (auto-restarts on save)
cd backend
npm install
DATABASE_HOST=localhost npm run start:dev      # http://localhost:3000/api

# 3. UI (Vite hot module replacement)
cd ui
npm install
npm run dev                                     # http://localhost:5173 (proxies /api)
```

> If the backend is already running in Docker, stop it first so port 3000 is
> free: `docker compose stop backend`.

## Common commands

```bash
# Rebuild + restart one service after code changes (Docker workflow)
docker compose up -d --build backend
docker compose up -d --build ui

# Tail logs
docker compose logs -f backend

# Backend: build, tests, lint, regenerate OpenAPI spec
cd backend
npm run build
npm test                                        # unit tests
RUN_DB_TESTS=true DATABASE_HOST=localhost npm test   # + integration (needs db)
npm run lint
npm run generate:openapi

# UI: typecheck / build
cd ui
npm run tsc
npm run build
```

## Useful environment variables

Defaults live in [`.env.example`](.env.example) (copy to `.env` to override;
docker-compose loads it automatically). A few worth knowing:

| Variable                  | Default | Notes                                   |
| ------------------------- | ------- | --------------------------------------- |
| `RESERVATION_TTL_MINUTES` | `20`    | Hold duration (lower it, e.g. 1, for quick testing) |
| `GENERATE_TICKETS`        | `false` | Set `true` to simulate continuous ingestion |
| `DATABASE_PORT`           | `5434`  | Host-published Postgres port            |

## Troubleshooting

- **`role "review" does not exist` in DBeaver** → you're hitting a local Postgres
  on 5432, not the container. Use port **5434**.
- **Code changes not showing in Docker** → the image bakes the build; rebuild
  with `docker compose up -d --build <service>`, or use the local dev loop above.
- **Port already in use (3000 / 8080 / 5434)** → stop the conflicting process or
  change the published port in `docker-compose.yml`.
