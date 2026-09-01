import { speakArabic } from "@dyslexia/exercise-engine";
import { getAppSounds } from "./api";
import type { AppSoundEntry, AppSoundsMap } from "./types";

/**
 * Platform sounds with the same rule the exercise engine uses for content
 * audio: play the admin-configured asset when one is bound, otherwise speak
 * the Arabic fallback text via TTS. Fetched once per session.
 */

const DEFAULT_ENTRY: AppSoundEntry = { url: null, text: "" };

let sounds: AppSoundsMap | null = null;
let loading: Promise<void> | null = null;

export function loadAppSounds(token: string): Promise<void> {
  if (sounds !== null || loading !== null) {
    return loading ?? Promise.resolve();
  }
  loading = getAppSounds(token)
    .then((map) => {
      sounds = map;
    })
    .catch(() => {
      // Silent: TTS-only mode when the fetch fails (offline first launch).
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function playAppSound(key: string): void {
  const entry = sounds?.[key] ?? DEFAULT_ENTRY;
  if (entry.url !== null && entry.url.length > 0) {
    const audio = new Audio(entry.url);
    audio.play().catch(() => {
      speakArabic(entry.text);
    });
    return;
  }
  if (entry.text.length > 0) {
    speakArabic(entry.text);
  }
}
