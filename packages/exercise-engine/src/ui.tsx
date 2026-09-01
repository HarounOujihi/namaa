import { useEffect } from "react";
import type { ReactNode } from "react";
import type { PromptSpec } from "@dyslexia/exercise-core";
import { playSound } from "./audio.js";
import { speakDelayed } from "./speech.js";
import {
  instructionText,
  optionButton,
  optionButtonDisabled,
  optionImage,
  playButton,
  promptCard,
  promptImage,
  promptText,
} from "./styles.js";
import { assetUrl } from "./utils.js";

/** Big round play-sound control: audio asset when available, TTS of the text otherwise. */
export function PlaySoundButton({
  audioUrl,
  ttsText,
  label = "تشغيل الصوت",
  size = 84,
}: {
  audioUrl?: string;
  ttsText?: string;
  label?: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{ ...playButton, width: size, height: size, fontSize: Math.round(size / 2.6) }}
      onClick={() => playSound({ audioUrl, text: ttsText })}
    >
      🔊
    </button>
  );
}

/**
 * Uniform prompt rendering: audio control if the prompt carries a resolvable
 * audio asset, the picture when present, and the text (which also doubles as
 * the TTS fallback per the exercise type spec).
 */
export function PromptView({
  prompt,
  assetUrls,
}: {
  prompt: PromptSpec | undefined;
  assetUrls: Record<string, string> | undefined;
}) {
  const imageUrl = assetUrl(assetUrls, prompt?.imageAssetId);
  const audioUrl = assetUrl(assetUrls, prompt?.audioAssetId);
  const text = prompt?.text;

  // Narrate the prompt shortly after mount (host instructions go first);
  // one-shot, the play control stays for replays.
  useEffect(
    () => speakDelayed(text !== undefined && audioUrl === undefined ? [text] : []),
    [text, audioUrl],
  );

  const hasText = text !== undefined && text.length > 0;
  if (imageUrl === undefined && audioUrl === undefined && !hasText) {
    return null;
  }
  return (
    <div style={promptCard}>
      {imageUrl !== undefined ? <img src={imageUrl} alt="" style={promptImage} /> : null}
      {hasText ? <p style={promptText}>{text}</p> : null}
      {audioUrl !== undefined ? <PlaySoundButton audioUrl={audioUrl} ttsText={text} /> : null}
    </div>
  );
}

/** One big answer option: picture when resolvable, otherwise the text. */
export function OptionButton({
  option,
  assetUrls,
  disabled,
  onTap,
  children,
}: {
  option: { id: string; text?: string; imageAssetId?: string };
  assetUrls: Record<string, string> | undefined;
  disabled: boolean;
  onTap: (optionId: string) => void;
  children?: ReactNode;
}) {
  const imageUrl = assetUrl(assetUrls, option.imageAssetId);
  return (
    <button
      type="button"
      style={disabled ? optionButtonDisabled : optionButton}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onTap(option.id);
        }
      }}
    >
      {imageUrl !== undefined ? <img src={imageUrl} alt="" style={optionImage} /> : null}
      {imageUrl === undefined ? <span>{option.text !== undefined && option.text.length > 0 ? option.text : "؟"}</span> : null}
      {children}
    </button>
  );
}

export function InstructionText({ children }: { children: ReactNode }) {
  return <p style={instructionText}>{children}</p>;
}

/** Friendly fallback for unknown type codes / unusable configurations — never a crash. */
export function UnavailableCard() {
  return (
    <div style={{ ...promptCard, padding: "34px 20px" }}>
      <span style={{ fontSize: "3rem" }} aria-hidden>
        🧩
      </span>
      <p style={{ ...promptText, fontSize: "1.5rem" }}>هذا النوع من الأنشطة غير متاح بعد</p>
    </div>
  );
}
