/**
 * Arabic narration via speechSynthesis. Everything here is guarded and never
 * throws — speech is always a bonus layer on top of the visual exercise.
 * `speakArabic` is the public surface; the rest serve the renderers.
 */

const SPEECH_RATE = 0.85;
const SPEECH_LANG = "ar-SA";

function synthesis(): SpeechSynthesis | null {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return null;
    }
    return window.speechSynthesis;
  } catch {
    return null;
  }
}

function utterance(text: string): SpeechSynthesisUtterance {
  const spoken = new SpeechSynthesisUtterance(text);
  spoken.lang = SPEECH_LANG;
  spoken.rate = SPEECH_RATE;
  return spoken;
}

/** Speak one Arabic utterance; a guarded no-op when speech is unsupported. */
export function speakArabic(text: string): void {
  const engine = synthesis();
  if (engine === null || text.length === 0) {
    return;
  }
  try {
    engine.cancel();
    engine.speak(utterance(text));
  } catch {
    // Speech output is a bonus; never let it break a tap.
  }
}

/** Queue several utterances in order, replacing whatever is playing. */
export function speakArabicSequence(texts: readonly string[]): void {
  const engine = synthesis();
  if (engine === null) {
    return;
  }
  try {
    engine.cancel();
    for (const text of texts) {
      if (text.length > 0) {
        engine.speak(utterance(text));
      }
    }
  } catch {
    // Same tolerance as speakArabic.
  }
}

/**
 * Append one utterance WITHOUT cancelling what is already queued — used to
 * chain a sequence item-by-item. `onDone` fires exactly once either way.
 */
export function speakArabicThen(text: string, onDone: () => void): void {
  const engine = synthesis();
  if (engine === null || text.length === 0) {
    onDone();
    return;
  }
  try {
    const spoken = utterance(text);
    spoken.onend = () => onDone();
    spoken.onerror = () => onDone();
    engine.speak(spoken);
  } catch {
    onDone();
  }
}

export function cancelSpeech(): void {
  const engine = synthesis();
  if (engine === null) {
    return;
  }
  try {
    engine.cancel();
  } catch {
    // Nothing sensible to do.
  }
}

/**
 * Delayed narration so host-spoken exercise instructions land first, then the
 * exercise's own prompt/question follows. Returns a canceler for effects.
 */
export function speakDelayed(texts: readonly string[], delayMs = 400): () => void {
  if (!texts.some((text) => text.length > 0)) {
    return () => undefined;
  }
  const timer = setTimeout(() => speakArabicSequence(texts), delayMs);
  return () => clearTimeout(timer);
}
