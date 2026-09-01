/**
 * Small shared helpers: asset resolution, shuffling, numerals and a minimal
 * configuration shape guard so broken content degrades to a friendly card.
 */

/** Resolve an asset id against the host-provided URL map; missing → text/TTS fallback. */
export function assetUrl(
  urls: Record<string, string> | undefined,
  assetId: string | undefined,
): string | undefined {
  if (assetId === undefined || assetId.length === 0 || urls === undefined) {
    return undefined;
  }
  return urls[assetId];
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** 3 → "٣" — western digits as Arabic-Indic numerals for the child UI. */
export function toArabicDigits(value: number): string {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isAudioWord(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).text === "string"
  );
}

/**
 * True when the configuration carries the minimum fields a renderer needs.
 * Configs are validated upstream by the CMS; this guard only keeps a stray
 * broken payload from crashing a therapy session.
 */
export function isRenderableConfig(typeCode: string, configuration: unknown): boolean {
  if (typeof configuration !== "object" || configuration === null) {
    return false;
  }
  const config = configuration as Record<string, unknown>;
  switch (typeCode) {
    case "MULTIPLE_CHOICE":
    case "IMAGE_MATCH":
      return nonEmptyArray(config.options);
    case "AUDIO_MATCH":
      return config.mode === "pair_comparison"
        ? isAudioWord(config.wordA) && isAudioWord(config.wordB)
        : nonEmptyArray(config.options);
    case "SOUND_POSITION":
      return isAudioWord(config.word) && typeof config.targetPhoneme === "string";
    case "ORDERING":
      return nonEmptyArray(config.items);
    case "WORD_BUILDER":
      return nonEmptyArray(config.pieces) && typeof config.targetWord === "string";
    case "MEMORY_GAME":
      return nonEmptyArray(config.cards);
    default:
      return false;
  }
}
