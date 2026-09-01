/**
 * Typed views of exercise `configuration` objects (plans/exercise_type_spec.md)
 * and the answer shapes renderers produce. Configs are validated by the CMS
 * schema pipeline before publish — these types describe the trusted shape.
 */

export interface PromptSpec {
  text?: string;
  imageAssetId?: string;
  audioAssetId?: string;
}

export interface OptionSpec {
  id: string;
  text?: string;
  imageAssetId?: string;
  audioAssetId?: string;
}

export interface MultipleChoiceConfig {
  prompt: PromptSpec;
  options: OptionSpec[];
  correctOptionId: string;
  feedbackText?: string;
}

export interface ImageMatchConfig {
  prompt: PromptSpec;
  options: OptionSpec[];
  correctOptionId: string;
  cueStyle: 'none' | 'dots';
}

export interface AudioWordSpec {
  text: string;
  audioAssetId?: string;
}

export type AudioMatchConfig =
  | {
      mode: 'pair_comparison';
      wordA: AudioWordSpec;
      wordB: AudioWordSpec;
      promptImageAssetIdA?: string;
      promptImageAssetIdB?: string;
      question: 'same_first_sound' | 'same_word';
      correct: 'same' | 'different';
    }
  | {
      mode: 'sound_to_image';
      target: AudioWordSpec;
      options: OptionSpec[];
      correctOptionId: string;
    };

export interface SoundPositionConfig {
  word: AudioWordSpec;
  targetPhoneme: string;
  correctPosition: 'beginning' | 'middle' | 'end';
}

export interface OrderingConfig {
  presentation: 'sequential_audio' | 'visual';
  items: OptionSpec[];
  displaySeconds?: number;
}

export interface WordBuilderConfig {
  targetWord: string;
  pieceKind: 'letter' | 'syllable';
  pieces: { id: string; text: string }[];
  distractors?: { id: string; text: string }[];
  audio: AudioWordSpec;
}

export interface MemoryGameConfig {
  task: 'reorder';
  cards: { id: string; text?: string; imageAssetId?: string }[];
  displaySeconds: number;
}

export const EXERCISE_TYPE_CODES = [
  'MULTIPLE_CHOICE',
  'IMAGE_MATCH',
  'AUDIO_MATCH',
  'SOUND_POSITION',
  'ORDERING',
  'WORD_BUILDER',
  'MEMORY_GAME',
] as const;

export type ExerciseTypeCode = (typeof EXERCISE_TYPE_CODES)[number];

/** What a renderer reports when the child submits an answer. */
export type ExerciseAnswer =
  | { kind: 'option'; optionId: string }
  | { kind: 'pair_comparison'; answer: 'same' | 'different' }
  | { kind: 'position'; position: 'beginning' | 'middle' | 'end' }
  | { kind: 'order'; itemIds: string[] }
  | { kind: 'word'; pieceIds: string[] };

export interface AnswerResult {
  answer: ExerciseAnswer;
  correct: boolean;
  responseTimeMs: number;
}
