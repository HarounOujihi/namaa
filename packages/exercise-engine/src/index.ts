/**
 * @dyslexia/exercise-engine — React renderers for the first-wave exercise
 * types (plans/exercise_type_spec.md). Rendering is positive-only: the engine
 * never judges an answer visually; it reports through onAnswer and the host
 * app decides how to celebrate.
 */
export { ExercisePlayer } from "./ExercisePlayer.js";
export type { ExercisePlayerProps } from "./ExercisePlayer.js";
export { speakArabic } from "./speech.js";
export * from "@dyslexia/exercise-core";
