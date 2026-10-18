# رحلتي — Arabic Dyslexia Diagnosis & Treatment Platform

An integrated digital therapeutic platform for **diagnosing and treating dyslexia in Arabic-speaking children**: a gamified child journey (island roadmap, adaptive difficulty, stars & rewards), a parent portal, a specialist workspace, and a fully data-driven content CMS — one backend, one database, four apps.

## Architecture

```
Super Admin → CMS (apps/admin) → Skills / Roadmap / Exercise Types / Exercises / Assessments / Sounds
                                        │
                             Exercise Engine (packages/exercise-engine)
                                        │
                            Child app (apps/child) — journey map, diagnostic, rewards
                                        │
                        Attempts → Progression Engine → Skill Levels / Stars / Badges
                                        │
                    Parent portal (apps/web)  ·  Specialist workspace (apps/web)
```

| Piece | Tech |
|---|---|
| Backend | NestJS 11 + Prisma 6, PostgreSQL (JSONB exercise configs), S3-compatible storage (MinIO in dev) |
| Child app | Vite + React 19 — Arabic-only, RTL, touch-first, plain CSS, speech/audio with TTS fallback |
| Admin CMS | Vite + React 19 + shadcn/ui (Base UI) + Tailwind v4 — English, internal tool |
| Parent/Specialist portal | Next.js 15 + shadcn/ui + next-intl — **ar / en / fr** with live RTL⇄LTR |
| Shared packages | `exercise-core` (types, evaluators, Arabic text utils — 32 unit tests), `exercise-engine` (7 exercise renderers) |
| Monorepo | pnpm workspaces + Turborepo |

**Data-driven content**: exercises are JSON configurations validated against per-type JSON Schemas (ajv) — content staff ship new activities without a developer. Exercise types, assessments, roadmap stages and platform sounds are all versioned; historical attempts always point at the exact version they were scored against.

## Quickstart

Prerequisites: **Node 22+, pnpm 9+** (`npm i -g pnpm`), **Docker**.

```bash
git clone <repo-url> && cd treatment

pnpm install                  # installs workspaces + generates the Prisma client

cp .env.example apps/api/.env # local secrets (gitignored); defaults match docker-compose

docker compose up -d --wait   # Postgres :5435 + MinIO :9005 (:9006 console)
                              # (5432/9000 are shifted — commonly taken by other projects)

pnpm db:migrate               # apply all migrations
pnpm db:seed                  # super admin, 9 skills, roadmap, sample exercises,
                              # diagnostic assessment (8 items), rewards catalog

pnpm dev                      # run all four apps together
```

### URLs & seeded accounts

| App | URL | Account |
|---|---|---|
| Child journey | http://localhost:5173 | no login — a parent unlocks once (`parent1@test.com` / `password123`), then the child picks their profile |
| Admin CMS | http://localhost:5174 | `admin@dyslexia.local` / `ChangeMe!123` |
| Parent / Specialist portal | http://localhost:3001 | `parent1@test.com` / `password123` · `spec1@test.com` / `password123` |
| API + Swagger | http://localhost:3000 · /docs | Bearer JWT |

> Seeded dev accounts are for local testing only — rotate them before any real deployment.

## Monorepo layout

```
apps/
  api/      NestJS — auth (JWT, 3 login roles), children & invites, play content,
            attempts + server-side evaluation, assessment, progression engine,
            rewards, platform sounds, admin CMS API, parent & specialist APIs
  child/    Journey map (locked stages from real progress), exercise runner,
            diagnostic assessment, rewards shop, screen-time goodnight screen
  admin/    Exercises (visual config editor + JSON), types, roadmap, assessments,
            asset library, platform sounds, previews
  web/      Parent: weekly summaries, child detail, screen-time settings,
            invite redemption, ar/en/fr. Specialist: case overview with status,
            progress curves, activity history, plan overrides, PDF report
packages/
  exercise-core/     Shared types, answer evaluators, Arabic text utilities (vitest)
  exercise-engine/   Dependency-free React renderers for the 7 exercise types
```

## Key flows

- **Onboarding** — specialist (or parent) creates a child; specialist-created children start unclaimed and are linked to the family via an invite code. The child is never a login: it's a profile inside a parent/specialist session.
- **Diagnostic** — 8-item adaptive assessment (reuses the exercise engine, zero failure feedback) produces per-skill starting levels.
- **Play loop** — attempts are evaluated **server-side** (client honesty never trusted), drive the progression engine (level-ups, easier-activity recommendations, stage unlocking), and award stars/points/badges. Idempotent by `clientAttemptId` — built for future offline sync.
- **Care** — parents get plain-language weekly summaries and set gentle screen-time limits; specialists see status flags (not started / inactive / struggling), progress curves, can hide specific exercises per child and adjust levels manually — every change logged (`progression_decisions`).

## Scripts

| Command | What |
|---|---|
| `pnpm dev` / `pnpm build` | Run / build all workspaces (Turborepo) |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:studio` | Prisma workflow |
| `pnpm --filter api test` | Progression-engine unit tests (17) |
| `pnpm --filter api db:seed:test-roadmaps` | Add 3 published "(تجريبية)" roadmaps built from existing published exercises (idempotent; delete from the CMS) |
| `pnpm --filter @dyslexia/exercise-core test` | Evaluator + Arabic-utils tests (32) |
| `pnpm infra:up` / `pnpm infra:down` | Docker dev infra |

## Configuration

`apps/api/.env` (see `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET`, `PORT`. Uploads land in the MinIO docker volume locally; point the S3 vars at real object storage for deploys. Frontends take `VITE_API_URL` / `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).

## Documentation

- **[docs/SYSTEM.md](docs/SYSTEM.md)** — how everything works: the diagnostic placement, mastery rules & stage unlocking, per-skill levels and the progression engine, the rewarding system (stars/points/badges/shop), attempts & server-side evaluation, roles, and where each piece lives in the code.

## Status

Phases 0–8 complete (identity & roles, CMS, exercise engine, diagnostic assessment, progression engine, gamification, parent portal, specialist workspace). Next per the internal plan: graphical Phaser games, analytics dashboards, Capacitor mobile packaging with offline sync, production hardening.


---

## Production Deployment (Vercel + Neon + S3)

The platform is deployed on **Vercel** (4 projects from the `main` branch) with a **Neon PostgreSQL** database and an **S3-compatible storage** bucket for uploaded assets.

### Production URLs

| App | URL |
|---|---|
| 🧒 Child app | https://namaa-6ren.vercel.app |
| 👨‍👩‍👧 Parent/Specialist portal | https://namaa-web-ruby.vercel.app |
| 🛠 Admin CMS | https://namaa-admin-five.vercel.app |
| 🔌 API + Swagger | https://namaa-steel.vercel.app · /docs |

### Production credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@dyslexia.local` | `ChangeMe!123` |
| Parent | `parent1@test.com` | `password123` |
| Specialist | `spec1@test.com` | `password123` |

> ⚠️ Rotate these before real users.

### Database (Neon)

```
DATABASE_URL=postgresql://neondb_owner:npg_FCodayIn8G9H@ep-calm-moon-b41rfr2v-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require
```

All 9 migrations are applied and the database is seeded (1 super admin, 9 skills, 9 roadmap stages, 7 exercise types, 9 exercises, 8 assessment items, 9 badges, 5 customization items).

### Asset storage (S3-compatible)

| Variable | Value |
|---|---|
| `S3_ENDPOINT` | `https://s3.mahd.cloud/mahd` |
| `S3_BUCKET` | `pub-sawi` |

Assets (exercise audio/images, avatars, platform sounds) are stored as **keys only** — presigned URLs are generated per request. Removing storage doesn't break the app: the engine falls back to Arabic TTS and emoji avatars.

### Redeploying

Pushes to `main` auto-deploy all four Vercel projects. To manually trigger: Vercel dashboard → project → Redeploy (or `vercel redeploy <url>` via CLI).
