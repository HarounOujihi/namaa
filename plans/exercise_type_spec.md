# Exercise Type Spec — First Wave (v1)

Status: **Active** · Consumers: Super Admin CMS (validation), exercise engine renderers (Phase 3), content authors.

Versioned via `exercise_type_versions.configSchema` (JSON Schema draft-07, enforced by ajv). Changing a type's structure = new type version; historical attempts keep pointing at the version they were scored against.

## Common conventions

- **Prompt spec** (uniform across types): `{ text?: string, imageAssetId?: string, audioAssetId?: string }` — at least one field required (semantic check). Renderers: audio if present, else image, else text; `text` doubles as TTS fallback when audio is absent (MVP ships before the audio library exists).
- **Option/item spec**: `{ id: string, text?: string, imageAssetId?: string, audioAssetId?: string }` — `id` is stable within a config (renderer key + answer reference), unique (semantic check).
- **Assets**: every `*AssetId` must exist in the `assets` table (referential check at validate/publish time). Configs store asset IDs, never URLs.
- **Validation pipeline** (backend, runs on create/patch/validate/publish):
  1. ajv: config vs the type version's `configSchema`
  2. Semantic: option counts, id uniqueness, `correctOptionId` membership, prompt non-empty
  3. Referential: asset IDs exist; skill / difficulty / age-group rows exist
- **Content language**: Arabic is canonical inside `configuration`; nothing in configs passes through the i18n layer.

---

## 1. `MULTIPLE_CHOICE`

Generic prompt → pick one option. Covers: odd-one-out, vocabulary (image→word, word→image), complete-the-word, spot-the-spelling-error, comprehension questions after a passage.

```jsonc
{
  prompt: { text?, imageAssetId?, audioAssetId? },
  options: [Option, ...],          // 2–6, ids unique
  correctOptionId: string,
  feedbackText?: string            // positive closing line, shown after answer
}
```

Example (vocabulary, brief L6): prompt.text `"🐱"` … options قِط / كَلب / حِصان, correct `"قِط"`.
Example (comprehension, brief L9): prompt.text = passage + سؤال, options موز/تفاح/برتقال.

## 2. `IMAGE_MATCH`

Match a picture to its letter/word from **close-looking options** (visual discrimination). Supports the Level-3 dot-count cue.

```jsonc
{
  prompt: { text?, imageAssetId?, audioAssetId? },   // usually the picture
  options: [ { id, text } ],                          // 2–6 letters/words, close-looking
  correctOptionId: string,
  cueStyle: "none" | "dots"    // "dots" renders dot-count cues under similar letters (ب ت ث)
}
```

Example (brief L2): prompt = fish picture, options س / ص / ش, correct س. Example (brief L3): prompt.text `"ـيت"`, options ب / ت / ث, correct ب, cueStyle "dots".

## 3. `AUDIO_MATCH`

Two modes — sound comparison, or match a sound to a picture.

```jsonc
// mode A: pair_comparison — same or different? (brief L1 نشاط 3)
{ mode: "pair_comparison",
  wordA: { text, audioAssetId? }, wordB: { text, audioAssetId? },
  promptImageAssetIdA?, promptImageAssetIdB?,     // e.g. apple/duck for "same first sound?"
  question: "same_first_sound" | "same_word",      // what the child is asked
  correct: "same" | "different" }

// mode B: sound_to_image — hear it, pick its picture
{ mode: "sound_to_image",
  target: { text, audioAssetId? },
  options: [ { id, imageAssetId, text? } ],        // 2–6
  correctOptionId: string }
```

Example (brief L1): wordA باب, wordB دب, question same_word, correct different.

## 4. `SOUND_POSITION`

Where does the target phoneme fall in the word? (brief L1 نشاط 2)

```jsonc
{
  word: { text, audioAssetId? },
  targetPhoneme: string,                  // 1–2 chars, Arabic
  correctPosition: "beginning" | "middle" | "end"
}
```

Example: word كتاب, targetPhoneme ك, correctPosition beginning.

## 5. `ORDERING`

Reproduce / restore a sequence. Covers auditory memory (brief L1 نشاط 4), visual memory reorder, arrange scrambled letters (brief L7), event ordering (brief L9).

```jsonc
{
  presentation: "sequential_audio" | "visual",   // played in order, or cards shown then hidden
  items: [Option, ...],                          // 2–8 in TARGET order; ids unique
  displaySeconds?: number                        // for "visual" (default 5)
}
```

Scoring: exact target order. Example (brief L1): sequential_audio, items شمس/بيت/قلم.

## 6. `WORD_BUILDER`

Drag pieces into slots to build the word. Covers syllable merging (brief L4), letter drag-and-drop (brief L4).

```jsonc
{
  targetWord: string,
  pieceKind: "letter" | "syllable",
  pieces: [ { id, text } ],        // in TARGET order; concatenation must equal targetWord
  distractors?: [ { id, text } ],  // extra decoy pieces shuffled into the pool
  audio: { text, audioAssetId? }   // the word, read aloud when slot fills / on request
}
```

Semantic: `pieces.map(p => p.text).join("") === targetWord` (with `distractors` excluded). Example: pieces با + با → بابا; pieces ق ل م → قلم (+ distractor س).

## 7. `MEMORY_GAME`

Cards shown briefly, then reproduce. Covers the 5-card visual memory task (brief L2) and the memory mini-game.

```jsonc
{
  task: "reorder",                  // MVP: reproduce display order ("match_pairs" reserved)
  cards: [ { id, text?, imageAssetId? } ],   // 3–8, target order
  displaySeconds: number            // default 5
}
```

Example: cards ب ت ث ج ح, displaySeconds 5.

---

## Scoring (all types, Phase 3)

Per item: correct/incorrect + response time; attempts logged to `exercise_answers`. Stars (1–3) computed from accuracy + time in the rewards layer — **never** deduct on error.

## Reserved codes (not first wave)

`TIMED_READING` (fluency), `SYLLABLE_WHEEL`, `VISUAL_MAZE`, `TEXT_INPUT` (listen-and-write), game-renderer types (Balloon Pop, Fishing, …) — games reuse these 7 content shapes via a Phaser renderer per exercise type code; new interaction = developer-built renderer + new type version entry.
