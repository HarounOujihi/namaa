import { useEffect } from "react";
import type { SoundPositionConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { InstructionText, PlaySoundButton } from "../ui.js";
import { speakDelayed } from "../speech.js";
import {
  answerRow,
  phonemeChip,
  promptCard,
  secondaryButton,
  secondaryButtonDisabled,
  stack,
} from "../styles.js";
import { assetUrl } from "../utils.js";

const POSITIONS = [
  { value: "beginning", label: "البداية" },
  { value: "middle", label: "الوسط" },
  { value: "end", label: "النهاية" },
] as const;

/** Where does the target phoneme fall in the word? */
export function SoundPosition({ configuration, assetUrls, locked, onSubmit }: RendererProps<SoundPositionConfig>) {
  const audioUrl = assetUrl(assetUrls, configuration.word.audioAssetId);

  useEffect(() => {
    if (audioUrl === undefined) {
      return speakDelayed([configuration.word.text]);
    }
    return undefined;
  }, [audioUrl, configuration.word.text]);

  return (
    <section style={stack}>
      <InstructionText>استمع إلى الكلمة: أين يقع هذا الصوت؟</InstructionText>
      <div style={{ ...promptCard, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
        <PlaySoundButton audioUrl={audioUrl} ttsText={configuration.word.text} label="استمع إلى الكلمة" />
        <span style={phonemeChip}>{configuration.targetPhoneme}</span>
      </div>
      <div style={answerRow}>
        {POSITIONS.map((position) => (
          <button
            key={position.value}
            type="button"
            style={
              locked
                ? { ...secondaryButtonDisabled, flex: "1 1 160px" }
                : { ...secondaryButton, flex: "1 1 160px" }
            }
            disabled={locked}
            onClick={() => onSubmit({ kind: "position", position: position.value })}
          >
            {position.label}
          </button>
        ))}
      </div>
    </section>
  );
}
