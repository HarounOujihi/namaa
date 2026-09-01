# Dyslexia Therapy App — Developer Task Plan

```
Super Admin → Content CMS → Skills / Roadmap Stages / Exercise Types → Exercises
                                                                            │
                                                                Exercise Engine (React)
                                                                ┌───────────┴───────────┐
                                                             Simple UI              Phaser Games
                                                                └───────────┬───────────┘
                                                                    Exercise Attempts
                                                                            │
                                                                  Progression Engine
                                                                            │
                                                                    Skill Progress
                                                                            │
                                                    Parent Dashboard  /  Specialist Dashboard
```

Principle: build the configurable platform from day one, seed it with a small MVP content set. Don't ship a hard-coded v1 that gets thrown away later.

---

## Phase 0 — Product & Architecture Decisions

- [x] Content model is data-driven at the schema level from day one — no hard-coded TS/JS exercise arrays. The Super Admin CMS *UI* can still be scoped down for MVP; seed the initial content via migration/seed scripts either way.
- [x] Accounts: only `PARENT`, `SPECIALIST`, `SUPER_ADMIN` are login-based roles. `CHILD` is **not** a credentialed role — a child is a profile selected inside an authenticated parent or specialist session. This matches the source flow directly: picking "child" lists linked profiles with no PIN; picking parent/specialist requires PIN/password.
- [x] Specialist↔child relationship is many-to-many (`specialist_children`), never an ownership transfer. A child can belong to a family (`parent_children`) and have one or more specialists at once, and can change specialists without losing history.
- [x] Specialist-created children start **unclaimed** (no parent yet); a parent claims one via invite code. This is the assignment mechanism — no separate flow needed.
- [x] `skills` = the 9-item canonical list (Auditory Discrimination → Reading Comprehension), independently tracked per child. `roadmap_stages` is a separate table that references skills — kept distinct so a stage's config can change, or a second roadmap can reuse the same skills in a different order, without touching the skill definitions themselves.
- [x] Roadmap unlocking uses per-stage configurable mastery rules (required skills, threshold, min accuracy, min attempts, prerequisites) — not a hardcoded `Stage 1 → Stage 2` chain.
- [x] Finalize monorepo layout (below), initialize repo.
- [ ] Produce: ERD, API spec, frontend architecture doc, exercise-type spec, game architecture, UI wireframes, content model.

---

## Tech Stack

```
apps/
  admin/   Vite + React + TS                     → Super Admin CMS — internal tool, single language
  web/     Next.js + TS + next-intl               → Parent + Specialist dashboards — multi-language,
                                                      benefits from SSR/routing on report-heavy pages
  child/   Vite + React + TS + Phaser + Capacitor  → Child experience — Arabic-only, offline-capable,
                                                      kept lean since it ships inside Capacitor

packages/
  ui/  api-client/  exercise-engine/  exercise-types/  game-components/  audio/  localization/  shared-types/

Backend:     NestJS + TypeScript + Prisma — one service behind all three apps
Database:    PostgreSQL (+ JSONB for exercise configuration)
Cache/Queue: Redis
Storage:     S3-compatible object storage
```

- [ ] One backend for everything. `apps/web` does not get its own API routes — the child app needs offline sync and can't depend on a server anyway, so there's one source of truth for all three frontends.

---

## Phase 1 — Identity & Backend Foundation

- [x] Auth (JWT/session) for `PARENT`, `SPECIALIST`, `SUPER_ADMIN` only
- [x] Tables: `users`, `roles`, `user_roles`, `parent_profiles`, `specialist_profiles` *(simplified: single `role` enum column on `users` replaces the `roles`/`user_roles` join tables — sufficient until roles need metadata)*
- [x] `child_profiles` (no login credentials) — fields: `full_name`, `birth_date`, `grade_level`, avatar; optionally a lightweight shared PIN if you want a "which kid is this" gate on a shared tablet
- [x] `parent_children`, `specialist_children` — both many-to-many, no ownership field on either
- [x] Start screen: role picker (child / parent / specialist). Child path → list linked profiles, no credential. Parent/specialist path → PIN/password. Full audio narration, minimal text, light load. *(in `apps/child`; narration via speechSynthesis until audio assets exist)*
- [x] Family child-selection screen: avatar card per child; **add child = parent only**; **edit/delete = parent only**, enforced server-side *(403 for specialists verified via API)*
- [x] Specialist "add child" flow: creates an unclaimed profile + parent invite code/link
- [x] Parent "claim child" flow: redeem invite code → creates the `parent_children` row (doesn't touch `specialist_children`)
- [x] Basic shells for all three apps
- [x] Object storage wiring *(MinIO via S3 SDK; presigned upload/GET verified)*

**Result:** parents/specialists authenticate; children exist as profiles reachable from either side, with no login of their own.

---

## Phase 2 — Content Model & Super Admin CMS (single language)

- [x] `skills` table, seeded with the 9 canonical entries
- [x] `roadmap_stages` table, referencing `skills`, with per-stage mastery config (required skills, threshold, min accuracy, min attempts, prerequisite stages) *(table + seed done — 9 stages chained; CMS CRUD pending)*
- [ ] Exercise type CRUD, versioned (`exercise_type` + `exercise_type_version`) — changing a type's structure shouldn't corrupt historical attempts
- [ ] Exercise CRUD with `configuration_json`. Keep this rule visible in the CMS copy: *"Create unlimited exercises from existing exercise types. A brand-new interaction type needs a developer-built renderer."*
- [x] `assets` table (`id, type, storage_key, mime_type, size, duration, metadata, status`) — exercises reference asset IDs, never raw storage URLs *(table + upload/GET verified; exercise references land with Phase 2 CRUD)*
- [ ] Exercise duplication ("clone, then swap target word/image/audio") — cheap and worth having even at small catalog size
- [ ] Content validation before publish: exercise-type + version exist, skill + roadmap stage exist, difficulty/age range valid, required fields present, correct answer present, referenced assets exist, JSON matches the type's schema
- [ ] Workflow: Draft → Validate → Review → Publish → Archive
- [ ] Roadmap CRUD, stage-exercise assignment
- [ ] Milestone: admin ships a full new activity with no developer involved
- [ ] *Deferred, not MVP-critical: bulk import/export, bulk media upload — revisit once the content library is actually large enough to need them*

---

## Phase 3 — Exercise Engine & Attempt Tracking

- [ ] Frontend exercise-type registry (`{ type, version, render, validate }`)
- [ ] Renderer + validator + **preview/test mode** for first-wave types: Multiple Choice, Image Match, Audio Match, Letter/Sound Position, Ordering, Drag & Drop / Word Builder, Memory — preview lives here (needs the renderer to exist), not in Phase 2
- [ ] Build every renderer for touch input, small/tablet screens, and audio latency from the start — don't defer mobile constraints to the Capacitor phase
- [ ] Tables: `exercise_attempts`, `exercise_answers`, `exercise_events` — include `client_attempt_id` / `client_event_id` on each from day one (needed for offline sync in Phase 11; cheap now, painful to retrofit)
- [ ] Arabic text utility layer: normalization, character comparison, letter classification, diacritic handling, tokenization
- [ ] Unit tests: renderer correctness, configuration validation, answer evaluation

---

## Phase 4 — Diagnostic Assessment

- [ ] Assessment builder on the same content model as Phase 2, seeded with the MVP set
- [ ] 8–12 short-task session, unified button/image/audio interface
- [ ] Visual progress bar
- [ ] Positive closing screen regardless of score
- [ ] No red marks, no harsh error sound anywhere in this flow — its own acceptance criterion, not inherited from Phase 6
- [ ] Each `assessment_item` references its target `skill_id` directly, so scoring routes straight to a per-skill starting level — no separate difficulty→skill lookup table needed
- [ ] Results summary — parent/specialist only, no child-facing version
- [ ] Tables: `assessments`, `assessment_versions`, `assessment_items`, `assessment_attempts`, `assessment_answers`, `assessment_results`
- [ ] E2E test: full assessment run → correct per-skill placement

---

## Phase 5 — Roadmap & Progression Engine

- [ ] Visual roadmap (island/path metaphor)
- [ ] Progression engine as a **backend** service, never client-side only:
  - [ ] evaluate each stage's configured mastery rule rather than a hardcoded "next stage" pointer
  - [ ] on repeated failure → recommend an easier same-skill exercise
  - [ ] on mastery → unlock the next eligible stage(s)
- [ ] `progression_decisions` table: `child_id, skill_id, previous_level, new_level, reason, source_attempt_id, rule_id, created_at` — every level change is logged with why it happened, so the adaptive system stays debuggable
- [ ] Tables: `child_skill_progress`, `roadmap_versions`, `roadmap_stages` (from Phase 2), `stage_items`
- [ ] Unit tests on the rule engine: repeated failure → easier activity, consistent success → level up, mastery → unlock, wrong answer → no negative reward

---

## Phase 6 — Gamification

- [ ] Stars (1–3), points, badges
- [ ] Character/theme customization, unlockable with points
- [ ] Short positive animation + audio celebration
- [ ] No negative punishment for wrong answers, anywhere in the app
- [ ] No competitive leaderboard — progress compared only to the child's own history
- [ ] Tables: `reward_types`, `rewards`, `badges`, `child_rewards`, `child_badges`, `reward_transactions`

---

## Phase 7 — Graphical Games (Phaser)

- [ ] Game launcher inside the React shell
- [ ] First games, reusing Phase 3's content model — the same target letter/word can power Multiple Choice, Balloon Pop, Fishing, or Fruit Picking without duplicating content: Balloon Pop, Fishing, Word Train, Castle Building, Picture–Word Match, Target Throw, Fruit Picking, Maze, Memory Game
- [ ] Test each game on mobile browsers/devices as it's built, not after the web app is "done"

---

## Phase 8 — Parent Dashboard (multi-language)

- [ ] i18n: `next-intl`, locale switcher in settings, locale stored per-user
- [ ] Dynamic `dir="rtl"`/`dir="ltr"` shell using CSS logical properties (`margin-inline-start`, not `margin-left`)
- [ ] Translate: navigation, buttons, forms, settings, notifications — not the child's exercise content
- [ ] Weekly summary: time spent, activities completed, most-improved skill, plain-language line per metric
- [ ] Daily screen-time limits, reminder settings
- [ ] Contact-specialist link, if one exists
- [ ] Invite-code redemption UI

---

## Phase 9 — Specialist Dashboard (multi-language)

- [ ] Shares Phase 8's i18n/locale setup — same Next.js app, role-scoped routes
- [ ] Child list with quick status indicator
- [ ] Per-child detail: skill levels, activity history, progress curve
- [ ] Roadmap customization: enable/disable activities, adjust starting difficulty
- [ ] PDF report export
- [ ] "Add child" flow (unclaimed profile + invite code)

---

## Phase 10 — Analytics & Reporting

- [ ] Per-skill progress line chart, over weeks
- [ ] Time-distribution pie chart across skills
- [ ] Baseline-vs-current comparison table
- [ ] Reading speed, spelling-error count, difficult letters/syllables
- [ ] Stagnation alert on a plateaued skill
- [ ] Compute every metric from raw `exercise_attempts` / `exercise_events` / `progression_decisions` — never store only the calculated number

---

## Phase 11 — Mobile (Child App via Capacitor)

- [ ] Wrap `apps/child` with Capacitor for Android/iOS
- [ ] Offline cache: roadmap, exercise metadata, required media, game assets
- [ ] Offline queue, built for reliability:
  - [ ] every queued attempt/event carries its `client_attempt_id` / `client_event_id` from Phase 3
  - [ ] sync API is idempotent — the same ID submitted twice is stored once
  - [ ] retry strategy + failed-sync queue + duplicate detection
  - [ ] sync requests carry the content version the attempt was made against, so a since-edited exercise doesn't corrupt historical data
- [ ] Device testing: Android tablets, iPads, phones — audio latency, touch, full-screen, orientation, performance, background/foreground transitions
- [ ] No i18n here — child app is Arabic-only by scope

---

## Phase 12 — Production Hardening

- [ ] Error tracking, API monitoring, performance monitoring, background-job monitoring
- [ ] Mobile sync monitoring with alerting on sync failures specifically
- [ ] Monitor child-app-specific failure modes: game crashed, audio failed to load, asset failed to load, unexpected exercise configuration
- [ ] Backend integration/API test suite
- [ ] E2E coverage of the critical path: parent creates child → child completes assessment → skill levels generated → child completes exercise → progress updates → parent sees it → specialist sees assigned child → offline attempt syncs correctly
- [ ] Accessibility pass on the parent/specialist dashboards
- [ ] Security review — confirm every rule below is enforced server-side, not just hidden in the UI

---

## Cross-cutting — Security

- [ ] Child (active profile, not a login role): activity access only, no admin/diagnostic data
- [ ] Parent: own linked children only; sole holder of profile edit/delete rights
- [ ] Specialist: assigned children only (via `specialist_children`); can customize plan, cannot edit/delete core profile data
- [ ] Super Admin: platform/content management only
- [ ] All of the above enforced server-side

## Cross-cutting — Multi-language scope (final)

- [ ] In scope: Parent dashboard, Specialist dashboard — pages, navigation, action buttons, form labels, notifications
- [ ] Out of scope: Super Admin CMS (single language), Child app (Arabic-only)
- [ ] Skill / badge / roadmap-stage **display names** get a small translation field (`{ar, fr, en}`) separate from the actual exercise content
- [ ] Diagnostic/exercise/game text never passes through the translation layer

---

## MVP Cut

- [ ] Parent + Specialist + Super Admin roles, full production data model underneath — no throwaway simplified schema to migrate away from later
- [ ] One roadmap, 3–5 skills, 8–12 exercise types, 2–3 graphical games
- [ ] Stars/rewards, basic child progress view
- [ ] Admin: skills, roadmap, exercise types/exercises, media, publish/unpublish, preview — seeded with the source's 9-level content
- [ ] Basic parent + specialist progress dashboard
- [ ] Expand in this order after validating the core loop: skills → games → specialist functionality — the architecture doesn't need to change to do it
