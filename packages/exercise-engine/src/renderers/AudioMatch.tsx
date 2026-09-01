import { useEffect } from "react";
import type { AudioMatchConfig } from "@dyslexia/exercise-core";
import type { RendererProps } from "../contract.js";
import { InstructionText, OptionButton, PlaySoundButton } from "../ui.js";
import { speakDelayed } from "../speech.js";
import {
  answerRow,
  optionGrid,
  pairRow,
  promptCard,
  promptImage,
  secondaryButton,
  secondaryButtonDisabled,
  stack,
  wordCard,
  wordText,
} from "../styles.js";
import { assetUrl } from "../utils.js";

type PairComparisonConfig = Extract<AudioMatchConfig, { mode: "pair_comparison" }>;
type SoundToImageConfig = Extract<AudioMatchConfig, { mode: "sound_to_image" }>;

/** Sound comparison or sound→picture matching. */
export function AudioMatch(props: RendererProps<AudioMatchConfig>) {
  if (props.configuration.mode === "pair_comparison") {
    return <PairComparison {...props} configuration={props.configuration} />;
  }
  return <SoundToImage {...props} configuration={props.configuration} />;
}

function WordSoundCard({
  label,
  text,
  audioUrl,
  imageUrl,
}: {
  label: string;
  text: string;
  audioUrl?: string;
  imageUrl?: string;
}) {
  return (
    <div style={wordCard}>
      <PlaySoundButton audioUrl={audioUrl} ttsText={text} label={label} />
      {imageUrl !== undefined ? <img src={imageUrl} alt="" style={promptImage} /> : null}
      <p style={wordText}>{text}</p>
    </div>
  );
}

/** Two big play-sound cards, then متشابهان / مختلفان. */
function PairComparison({ configuration, assetUrls, locked, onSubmit }: RendererProps<PairComparisonConfig>) {
  const urlA = assetUrl(assetUrls, configuration.wordA.audioAssetId);
  const urlB = assetUrl(assetUrls, configuration.wordB.audioAssetId);

  // Auto-narrate both words once (after host instructions) when no audio assets exist.
  useEffect(() => {
    if (urlA === undefined && urlB === undefined) {
      return speakDelayed([configuration.wordA.text, configuration.wordB.text]);
    }
    return undefined;
  }, [urlA, urlB, configuration.wordA.text, configuration.wordB.text]);

  const question =
    configuration.question === "same_first_sound"
      ? "هل تبدأ الكلمتان بنفس الصوت؟"
      : "هل الكلمتان متشابهتان؟";

  return (
    <section style={stack}>
      <InstructionText>استمع إلى الكلمتين جيدًا</InstructionText>
      <div style={pairRow}>
        <WordSoundCard
          label="الكلمة الأولى"
          text={configuration.wordA.text}
          audioUrl={urlA}
          imageUrl={assetUrl(assetUrls, configuration.promptImageAssetIdA)}
        />
        <WordSoundCard
          label="الكلمة الثانية"
          text={configuration.wordB.text}
          audioUrl={urlB}
          imageUrl={assetUrl(assetUrls, configuration.promptImageAssetIdB)}
        />
      </div>
      <InstructionText>{question}</InstructionText>
      <div style={answerRow}>
        <button
          type="button"
          style={locked ? { ...secondaryButtonDisabled, flex: "1 1 200px" } : { ...secondaryButton, flex: "1 1 200px" }}
          disabled={locked}
          onClick={() => onSubmit({ kind: "pair_comparison", answer: "same" })}
        >
          متشابهان
        </button>
        <button
          type="button"
          style={locked ? { ...secondaryButtonDisabled, flex: "1 1 200px" } : { ...secondaryButton, flex: "1 1 200px" }}
          disabled={locked}
          onClick={() => onSubmit({ kind: "pair_comparison", answer: "different" })}
        >
          مختلفان
        </button>
      </div>
    </section>
  );
}

/** Hear the target word, then pick its picture. */
function SoundToImage({ configuration, assetUrls, locked, onSubmit }: RendererProps<SoundToImageConfig>) {
  const targetAudioUrl = assetUrl(assetUrls, configuration.target.audioAssetId);

  // The word itself is not displayed: the task is listening → picture.
  useEffect(() => {
    if (targetAudioUrl === undefined) {
      return speakDelayed([configuration.target.text]);
    }
    return undefined;
  }, [targetAudioUrl, configuration.target.text]);

  return (
    <section style={stack}>
      <InstructionText>استمع ثم اضغط الصورة المناسبة</InstructionText>
      <div style={promptCard}>
        <PlaySoundButton
          audioUrl={targetAudioUrl}
          ttsText={configuration.target.text}
          label="استمع إلى الكلمة"
          size={104}
        />
      </div>
      <div style={optionGrid}>
        {configuration.options.map((option) => (
          <OptionButton
            key={option.id}
            option={option}
            assetUrls={assetUrls}
            disabled={locked}
            onTap={(optionId) => onSubmit({ kind: "option", optionId })}
          />
        ))}
      </div>
    </section>
  );
}
