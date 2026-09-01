import type { ExerciseAnswer } from "@dyslexia/exercise-core";

/**
 * What every renderer receives from ExercisePlayer. `locked` freezes
 * interaction after an answer has been submitted (positive-only: the engine
 * itself never judges, it only reports through onAnswer).
 */
export interface RendererProps<TConfig> {
  configuration: TConfig;
  assetUrls: Record<string, string> | undefined;
  locked: boolean;
  onSubmit: (answer: ExerciseAnswer) => void;
}
