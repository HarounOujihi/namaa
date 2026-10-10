// Explicit named re-exports (not `export *`): compiled CJS emits direct
// `exports.x = ...` assignments so bundlers can statically resolve names.

export {
  EXERCISE_TYPE_CODES,
  type ExerciseTypeCode,
  type ExerciseAnswer,
  type AnswerResult,
  type PromptSpec,
  type OptionSpec,
  type AudioWordSpec,
  type MultipleChoiceConfig,
  type ImageMatchConfig,
  type AudioMatchConfig,
  type SoundPositionConfig,
  type OrderingConfig,
  type WordBuilderConfig,
  type MemoryGameConfig,
} from './types.js';

export {
  normalizeArabic,
  arabicEquals,
  isDiacritic,
  isArabicLetter,
  lettersOf,
  tokenizeWords,
  dotCount,
} from './arabic.js';

export { evaluateAnswer } from './evaluate.js';
