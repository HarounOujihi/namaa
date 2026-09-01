import { cancelSpeech, speakArabic, speakArabicThen } from "./speech.js";

/**
 * Sound playback: an audio asset URL when the host resolved one, speech
 * synthesis of the Arabic text otherwise, plus ordered sequences for the
 * auditory-memory exercises.
 */

export interface SoundSource {
  audioUrl?: string;
  text?: string;
}

let currentAudio: HTMLAudioElement | null = null;
let sequenceToken = 0;

/** Stop any playing audio and queued speech. */
export function stopSound(): void {
  sequenceToken += 1;
  if (currentAudio !== null) {
    try {
      currentAudio.pause();
    } catch {
      // Already torn down; nothing to stop.
    }
    currentAudio = null;
  }
  cancelSpeech();
}

/** Play one sound: the audio asset if resolvable, else TTS of the text. */
export function playSound(source: SoundSource): void {
  stopSound();
  if (source.audioUrl !== undefined) {
    const audio = tryAudioElement(source.audioUrl);
    if (audio !== null) {
      currentAudio = audio;
      audio.onerror = () => {
        if (source.text !== undefined) {
          speakArabic(source.text);
        }
      };
      audio.play().catch(() => {
        if (source.text !== undefined) {
          speakArabic(source.text);
        }
      });
      return;
    }
  }
  if (source.text !== undefined) {
    speakArabic(source.text);
  }
}

/**
 * Play sources strictly in order: audio elements chain through their `ended`
 * events, text-only sources chain through utterance callbacks, and a failed
 * asset falls back to its text so the sequence never stalls.
 */
export function playSoundSequence(sources: readonly SoundSource[]): void {
  stopSound();
  const token = sequenceToken;
  const step = (index: number): void => {
    if (token !== sequenceToken || index >= sources.length) {
      return;
    }
    const source = sources[index];
    const advance = (): void => step(index + 1);
    const audio = source.audioUrl !== undefined ? tryAudioElement(source.audioUrl) : null;
    if (audio !== null) {
      currentAudio = audio;
      audio.onended = advance;
      const fallback = (): void => speakSource(source, advance);
      audio.onerror = fallback;
      audio.play().catch(fallback);
      return;
    }
    speakSource(source, advance);
  };
  step(0);
}

function speakSource(source: SoundSource, onDone: () => void): void {
  if (source.text !== undefined && source.text.length > 0) {
    speakArabicThen(source.text, onDone);
    return;
  }
  onDone();
}

function tryAudioElement(url: string): HTMLAudioElement | null {
  try {
    return new Audio(url);
  } catch {
    return null;
  }
}
