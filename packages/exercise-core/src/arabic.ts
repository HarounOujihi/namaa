/**
 * Arabic text utilities (plan Phase 3). Conservative normalization for
 * equality checks (answer evaluation) plus classification helpers for
 * renderers. Deliberately does NOT reorder or restructure text.
 */

// Harakat (fatha/damma/kasra variants, shadda, sukun, tanwin, small waw/ya, superscript alef)
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const SUPERSCRIPT_ALEF = '\u0670';

const ALEF_VARIANTS: Record<string, string> = {
  '\u0622': '\u0627', // آ -> ا
  '\u0623': '\u0627', // أ -> ا
  '\u0625': '\u0627', // إ -> ا
  '\u0671': '\u0627', // ٱ -> ا
};

const DOTLESS_YA = '\u0649'; // ى
const YA = '\u064A'; // ي

/** Strip diacritics, tatweel; unify alef/hamza forms and dotless ya. */
export function normalizeArabic(text: string): string {
  let out = text.replace(DIACRITICS, '').replace(TATWEEL, '');
  let result = '';
  for (const ch of out) {
    if (ch === SUPERSCRIPT_ALEF) continue;
    if (ALEF_VARIANTS[ch]) {
      result += ALEF_VARIANTS[ch];
    } else if (ch === DOTLESS_YA) {
      result += YA;
    } else {
      result += ch;
    }
  }
  return result.trim();
}

/** Equality under normalization — the only sanctioned way to compare Arabic user input. */
export function arabicEquals(a: string, b: string): boolean {
  return normalizeArabic(a) === normalizeArabic(b);
}

export function isDiacritic(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06ed)
  );
}

export function isArabicLetter(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x0621 && code <= 0x064a) ||
    (code >= 0x0671 && code <= 0x06d3)
  );
}

/** Characters of a word with diacritics dropped (letter tiles, phoneme checks). */
export function lettersOf(word: string): string[] {
  return [...word].filter((ch) => isArabicLetter(ch));
}

/** Word-level tokens, normalized separators (space, punctuation, Arabic comma). */
export function tokenizeWords(text: string): string[] {
  return text
    .split(/[\s\u060C\u061B\u061F.,!?؟،؛]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Dot count of a letter form — powers the Level-3 dot-cue (ب=1, ت=2, ث=3). */
export function dotCount(ch: string): number {
  return [...ch].reduce((sum, c) => sum + dotCountOfCodepoint(c), 0);
}

function dotCountOfCodepoint(ch: string): number {
  // No Unicode property for "dot count"; cover the common educational set.
  const map: Record<string, number> = {
    ب: 1, پ: 3, ت: 2, ث: 3, ن: 1,
    ج: 1, چ: 3, ح: 0, خ: 1, د: 0, ذ: 1,
    ر: 0, ز: 1, س: 0, ش: 3, ص: 0, ض: 1,
    ط: 0, ظ: 1, ع: 0, غ: 1, ف: 1, ق: 2,
    ك: 1, ل: 0, م: 0, ه: 0, و: 0, ي: 2, ء: 0,
  };
  return map[normalizeTaa(ch)] ?? 0;
}

function normalizeTaa(ch: string): string {
  // ة behaves like ه for cue purposes (0 dots)
  return ch === 'ة' ? 'ه' : ch;
}
