import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { evaluateAnswer } from "@dyslexia/exercise-core";
import type {
  AnswerResult,
  AudioMatchConfig,
  ExerciseAnswer,
  ImageMatchConfig,
  MemoryGameConfig,
  MultipleChoiceConfig,
  OrderingConfig,
  SoundPositionConfig,
  WordBuilderConfig,
} from "@dyslexia/exercise-core";
import { stopSound } from "./audio.js";
import { playerRoot } from "./styles.js";
import { isRenderableConfig } from "./utils.js";
import { UnavailableCard } from "./ui.js";
import { AudioMatch } from "./renderers/AudioMatch.js";
import { ImageMatch } from "./renderers/ImageMatch.js";
import { MemoryGame } from "./renderers/MemoryGame.js";
import { MultipleChoice } from "./renderers/MultipleChoice.js";
import { Ordering } from "./renderers/Ordering.js";
import { SoundPosition } from "./renderers/SoundPosition.js";
import { WordBuilder } from "./renderers/WordBuilder.js";

export interface ExercisePlayerProps {
  typeCode: string;
  configuration: unknown;
  assetUrls?: Record<string, string>;
  onAnswer?: (result: AnswerResult) => void;
  disabled?: boolean;
}

/**
 * Renders exactly one exercise interaction: RTL, Arabic, touch-first, and
 * positive-only — the engine never shows right/wrong; it evaluates the answer
 * and reports it through onAnswer so the host decides how to celebrate.
 */
export function ExercisePlayer({
  typeCode,
  configuration,
  assetUrls,
  onAnswer,
  disabled = false,
}: ExercisePlayerProps) {
  const startedAtRef = useRef(performance.now());
  const [answered, setAnswered] = useState(false);
  const locked = disabled || answered;

  // One attempt per mount: stop lingering exercise audio/speech on unmount.
  useEffect(() => stopSound, []);

  const handleSubmit = (answer: ExerciseAnswer): void => {
    if (locked) {
      return;
    }
    setAnswered(true);
    onAnswer?.({
      answer,
      correct: evaluateAnswer(typeCode, configuration, answer),
      responseTimeMs: Math.max(0, Math.round(performance.now() - startedAtRef.current)),
    });
  };

  let exercise: ReactNode = <UnavailableCard />;
  if (isRenderableConfig(typeCode, configuration)) {
    switch (typeCode) {
      case "MULTIPLE_CHOICE":
        exercise = (
          <MultipleChoice
            configuration={configuration as MultipleChoiceConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "IMAGE_MATCH":
        exercise = (
          <ImageMatch
            configuration={configuration as ImageMatchConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "AUDIO_MATCH":
        exercise = (
          <AudioMatch
            configuration={configuration as AudioMatchConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "SOUND_POSITION":
        exercise = (
          <SoundPosition
            configuration={configuration as SoundPositionConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "ORDERING":
        exercise = (
          <Ordering
            configuration={configuration as OrderingConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "WORD_BUILDER":
        exercise = (
          <WordBuilder
            configuration={configuration as WordBuilderConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      case "MEMORY_GAME":
        exercise = (
          <MemoryGame
            configuration={configuration as MemoryGameConfig}
            assetUrls={assetUrls}
            locked={locked}
            onSubmit={handleSubmit}
          />
        );
        break;
      default:
        exercise = <UnavailableCard />;
    }
  }

  return (
    <section dir="rtl" style={playerRoot}>
      {exercise}
    </section>
  );
}
