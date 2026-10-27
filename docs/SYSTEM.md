# System Guide — How the Platform Works

This explains the mechanics actually implemented in the codebase: the child's journey, mastery rules, levels, the rewarding system, and how everything connects. For setup and running, see the [README](../README.md).

```
Diagnostic Assessment ──► Starting levels per skill
        │
        ▼
Journey Map (roadmap stages, locked/unlocked) ──► Exercise play
        │                                              │
        │                              attempt (server-side evaluated)
        │                                              │
        │                    ┌─────────────────────────┼──────────────────────┐
        │                    ▼                         ▼                      ▼
        │            Progression Engine          Stars / Points          Activity history
        │            (levels, unlocking,         (immediate reward)      (analytics)
        │             easier-activity hints)          │
        ▼                    │                         ▼
Parent / Specialist dashboards ◄────────── Badges on stage mastery, shop purchases
```

---

## 1. Core concepts

| Concept | What it is | Where |
|---|---|---|
| **Skill** | One of the 9 canonical abilities from the therapeutic brief (auditory perception → reading comprehension). Tracked **independently per child** — a child can be advanced in one and behind in another. | `skills` table, seeded |
| **Roadmap** | A journey of stages. Many can be active at once; children see a roadmap only when it is **active and has a PUBLISHED version**. Each has an optional description and cover image and belongs to at most one category. | `roadmaps` / `roadmap_versions` |
| **Roadmap category** | Admin-managed grouping (name, description, cover image, order) for the child app's library. Deleting a category leaves its roadmaps uncategorized. | `roadmap_categories` |
| **Stage** | A stop on the journey. Owns a **mastery rule** (see §3), one or more skills, and an ordered list of exercises. | `roadmap_stages` + `stage_items` |
| **Exercise** | A content unit rendered by an exercise-type renderer. Its entire content is a JSON `configuration` validated against the type's JSON Schema. | `exercises` + `exercise_versions` |
| **Exercise type** | An interaction kind with a renderer + evaluator. First wave: Multiple Choice, Image Match, Audio Match, Sound Position, Ordering, Word Builder, Memory Game. | `exercise_types` + versions, renderers in `packages/exercise-engine` |
| **Assessment item** | A diagnostic task — same engine as exercises, but scored per skill and never shows correctness to the child. | `assessments` family |

**Versioning rule:** editing any published content (exercise, assessment, roadmap) creates a **new version**. Attempts and results always point at the exact version they were scored against — history is never rewritten. Publishing a new version archives the old one.

---

## 2. The diagnostic assessment

The entry point of the journey (`الاختبار التشخيصي`, 8 items across 6 skills, seeded from the brief's own examples):

1. Framed as a game ("لعبة قصيرة وممتعة — ليس فيها نجاح أو خطأ") with **zero correctness feedback** — errors are recorded invisibly (a therapy requirement, not a style choice).
2. Answers are evaluated **server-side** and grouped per skill.
3. Each skill's accuracy maps to a **starting level**:

| Accuracy | Starting level |
|---|---|
| ≥ 75% | 3 |
| ≥ 40% | 2 |
| < 40% | 1 |

4. Results land in `assessment_results` **and** seed `child_skill_progress` — this is the initial placement the progression engine then evolves.

A child is offered the assessment once (banner on the journey screen); results are visible to parent/specialist only.

---

## 3. Mastery rules & stage unlocking

Every stage carries its own configurable rule (editable in the CMS, no code):

```
masteryThreshold         e.g. 0.8
minAccuracy              e.g. 0.7      (nullable → default 0.7)
minSuccessfulAttempts    e.g. 3        (nullable → default 3)
```

**Stage completion (v0 rule):** a stage is *completed* when every one of its playable exercises has at least one successful attempt by that child **played from that roadmap** — progress is tracked per roadmap. Every attempt records the `roadmapId` it was played from; the same exercise in two roadmaps must be passed in each. Skills, levels and rewards still count every attempt regardless of roadmap. Attempts made before per-roadmap tracking were attributed to the original roadmap (الرحلة العلاجية) by the migration.

**Unlocking:** a stage is *unlocked* when **every prior playable stage is completed**. Stages with no exercises (قيد التحضير) never block the chain. This runs server-side (`computeStageUnlocks` in `progression/rules.ts`, unit-tested) — the child app just renders the states:

| Map state | Meaning |
|---|---|
| ✓ green | completed |
| amber, pulsing + owl | **current** — first unlocked-but-not-completed stage; the owl travels here |
| amber | unlocked, waiting |
| 🔒 gray | locked — tapping gives a gentle hint ("أكمل المرحلة السابقة أولًا 🌱"), never opens |
| 🌱 dashed | coming soon (no content yet) |

The **Phase 5 rule engine** (planned next iteration of this rule) evaluates the full mastery config per stage; the v0 gate above already runs on the same contract.

---

## 4. Levels & the progression engine

Each child has a `currentLevel` **per skill** (not one global level). Levels start at 1–3 from the diagnostic and evolve through play.

After **every** attempt, the engine (`apps/api/src/progression/`) evaluates two rules — pure functions, unit-tested (17 tests):

**Level-up** (`SKILL_LEVEL_UP_V1`):
- A fresh run of `minSuccessfulAttempts` **consecutive successes** — counting only attempts *since the last promotion* (one long streak promotes exactly once)
- at accuracy ≥ `minAccuracy` over that window
- → `currentLevel + 1`, logged with a human-readable reason

**Repeated failure** (`REPEATED_FAILURE_EASIER_V1`):
- 3 consecutive failures in a skill
- → the level **never decreases** (no punishment — a core therapy rule); instead the child is offered the **easiest not-yet-succeeded exercise of that skill** as a "🌱 نشاط أسهل" card on the stage screen. Completing it doesn't advance the stage.

**Manual override** (`MANUAL_OVERRIDE`): a specialist can set a skill level directly (stepper in the portal); the change is logged like any other decision.

Every level change lands in `progression_decisions` (`child, skill, previous→new level, reason, ruleId, source attempt`) — the adaptive system is fully auditable, and the analytics progress curves are drawn from this log.

---

## 5. The rewarding system

All rewards are **positive-only**: wrong answers earn nothing, deduct nothing, and never lower levels.

### Stars (1–3)
On a successful attempt, by completion time (the brief's "حسب الدقة والزمن"; success itself carries the accuracy):

| Duration | Stars |
|---|---|
| ≤ 8s | ⭐⭐⭐ |
| ≤ 15s | ⭐⭐ |
| > 15s | ⭐ |

Stars appear in the child's feedback banner as soon as the attempt submission resolves (submission fires the moment the child answers).

### Points
`10 points × stars`, every earn/spend recorded in `reward_transactions` (an append-only ledger — the balance is always `Σ earned − Σ spent`, never a stored number).

### Badges (وسام)
One per skill: **"بطل \<skill\>"** — granted when the skill's stage is fully completed (all items succeeded). Granted retroactively too: existing progress is honored the first time the engine runs.

### Customization shop (متجر الوشاح)
Items with prices in points (scarves 30, halos 80). Purchase → ownership (`child_rewards`) + SPENT transaction. The child may **equip** one item:
- **Scarf items** → a real colored scarf drawn around the owl's neck (journey map, rewards screen, shop previews)
- **Halo items** → a colored glow around the owl

### What deliberately doesn't exist
No leaderboards, no comparisons between children — progress is only ever compared to the child's own history (per the brief).

---

## 6. Attempts & evaluation

- The child app generates a `clientAttemptId` (UUID) per attempt; submission is **idempotent** — the same ID is stored once. This is the foundation for the future offline queue.
- Answers are evaluated **server-side** by shared evaluators (`packages/exercise-core`) — the client's idea of correctness is never trusted. Arabic comparisons run through normalization (diacritics, alef variants, tatweel, dotless-ya).
- Attempts carry `stars`, `isSuccess`, `durationMs`, `attemptNumber`, and per-answer detail (`exercise_answers`) — the raw material for every analytic.

---

## 7. The child experience

- **Entry**: logged-out visitors land on the public landing page (the idea, how it works, expert-designed programs and the 9 skills, child-safe design, family & specialist features) with a single **تسجيل الدخول** button — any parent or specialist account signs in there, no role choice. A signed-in device opens straight on the child picker; children never log in. Optional per-child PIN for shared tablets.
- **Library** (hash routes, browser back + shareable links): `#/` shows the categories page — a "تابع رحلتك" card for the most recently active unfinished roadmap, then category cards (uncategorized roadmaps form a "رحلات أخرى" bucket). `#/c/<categoryId>` (or `#/c/other`) lists that category's roadmaps; each card shows, **before opening**, whether it is new / in progress / completed, passed stages, stars earned in that roadmap, the current stage and last activity. With a single bucket the categories page is skipped; with a single roadmap its journey opens directly. Entering a roadmap records it as opened (`child_roadmap_progress`).
- **Journey screen** (`#/r/<id>`, stages `#/r/<id>/s/<order>`, exercises `#/r/<id>/e/<order>`): slim header (back, greeting, 🎁, exit), a horizontally scrolling switcher for roadmaps in the same category (or a roadmap chip when it is alone), passed-stages and stars chips, the island map, and (if unassessed) the assessment banner.
- **Navigation safety**: picking another child or exiting resets to `#/`; in-app back only walks history entries created by the current child's session, and a deep link or history entry into a **locked** stage opens that roadmap's journey instead. Every screen uses the same round back button at the RTL start of its header.
- **Stage screen**: "✓ x من y" progress and a ✓ on every activity already passed **in this roadmap** (from the server, so it survives reloads).
- **Play**: exercises render through the engine with audio assets first, Arabic TTS fallback. A wrong answer offers "🔁 حاول مرة أخرى" (a fresh recorded attempt) or "التالي"; only a correct answer marks the activity done. Positive-only feedback everywhere; platform sounds (welcome / celebration / retry / stage complete) are admin-manageable with TTS fallback.
- **Screen time**: the parent sets a daily limit (5–480 min). The child app tracks minutes per day and shows a gentle goodnight screen ("🌙 انتهى وقت الرحلة لهذا اليوم") when reached — advisory in-app, never a hard lock mid-flow.

---

## 8. Content management (CMS)

- **Visual-first authoring**: each exercise type has a form editor; JSON remains as an advanced tab. Assessment items reuse the same editors.
- **Validation pipeline** (create/patch/publish): ajv schema check → per-type semantic checks (correct-answer membership, option counts, word-builder concatenation…) → referential asset checks.
- **Lifecycle**: Draft → Validate → Publish → Archive. Published versions are frozen; "New version" clones into an editable draft.
- **Roadmap categories** (`/roadmap-categories`): create/edit/delete/reorder categories with cover upload or library pick. Roadmap cards show cover, category and a **"Draft only — hidden from children"** warning until a version is published; "Edit details" sets name, description, category, cover and order.
- **Assets**: uploads live in S3-compatible storage (MinIO locally); configs store asset IDs, URLs are presigned per session. Filenames are preserved for human recognition in pickers.
- **Platform sounds**: four admin-manageable slots (welcome / celebration / retry / stage-complete), each with an Arabic TTS fallback text.

---

## 9. Roles & access

| Role | Can | Cannot |
|---|---|---|
| **Child** (profile, not a login) | play, see own rewards | see any diagnostic data, settings, other profiles |
| **Parent** | own linked children; profiles CRUD; settings; invite redemption | other children; content |
| **Specialist** | assigned children (m-n); plan overrides; level overrides; reports | edit/delete profiles; settings |
| **Super Admin** | all content & platform config | child case data beyond content |

All rules are enforced **server-side** (verified with 403 tests); the child is scoped through the authenticated parent/specialist session.

---

## 10. Where things live

| Concern | Code |
|---|---|
| Progression rules (pure + tests) | `apps/api/src/progression/rules.ts` |
| Rewards engine | `apps/api/src/rewards/rewards.service.ts` |
| Assessment & placement | `apps/api/src/assessment/` |
| Play content, library progress + attempts | `apps/api/src/play/` |
| Roadmap categories (admin) | `apps/api/src/admin/roadmap-categories.*` |
| Analytics (all computed on demand) | `apps/api/src/analytics/` |
| Exercise evaluators + Arabic utils (32 tests) | `packages/exercise-core/` |
| Exercise renderers | `packages/exercise-engine/` |
| Journey map | `apps/child/src/components/JourneyMap.tsx` |
| Child library pages + hash navigation | `apps/child/src/screens/RoadmapLibrary.tsx`, `apps/child/src/play-views.ts` |
| Public landing page | `apps/child/src/screens/LandingPage.tsx` |
| Exercise-type contract | `plans/exercise_type_spec.md` |
