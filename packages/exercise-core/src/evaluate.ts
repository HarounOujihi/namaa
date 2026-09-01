import { arabicEquals } from './arabic.js';
import type {
  AudioMatchConfig,
  ExerciseAnswer,
  ExerciseTypeCode,
  ImageMatchConfig,
  MemoryGameConfig,
  MultipleChoiceConfig,
  OrderingConfig,
  SoundPositionConfig,
  WordBuilderConfig,
} from './types.js';

/**
 * Server- and client-shared answer evaluation. Configs arrive validated
 * (CMS pipeline); evaluation is total — malformed answers score `false`,
 * never throw.
 */
export function evaluateAnswer(
  typeCode: ExerciseTypeCode | string,
  configuration: unknown,
  answer: ExerciseAnswer,
): boolean {
  const c = configuration as Record<string, unknown>;
  switch (typeCode) {
    case 'MULTIPLE_CHOICE':
    case 'IMAGE_MATCH': {
      const cfg = c as unknown as MultipleChoiceConfig | ImageMatchConfig;
      return answer.kind === 'option' && answer.optionId === cfg.correctOptionId;
    }
    case 'AUDIO_MATCH': {
      const cfg = c as unknown as AudioMatchConfig;
      if (cfg.mode === 'pair_comparison') {
        return answer.kind === 'pair_comparison' && answer.answer === cfg.correct;
      }
      return answer.kind === 'option' && answer.optionId === cfg.correctOptionId;
    }
    case 'SOUND_POSITION': {
      const cfg = c as unknown as SoundPositionConfig;
      return answer.kind === 'position' && answer.position === cfg.correctPosition;
    }
    case 'ORDERING': {
      const cfg = c as unknown as OrderingConfig;
      return (
        answer.kind === 'order' &&
        sequencesEqual(answer.itemIds, cfg.items.map((i) => i.id))
      );
    }
    case 'MEMORY_GAME': {
      const cfg = c as unknown as MemoryGameConfig;
      return (
        answer.kind === 'order' &&
        sequencesEqual(answer.itemIds, cfg.cards.map((i) => i.id))
      );
    }
    case 'WORD_BUILDER': {
      const cfg = c as unknown as WordBuilderConfig;
      if (answer.kind !== 'word') return false;
      const byId = new Map<string, string>();
      for (const p of cfg.pieces) byId.set(p.id, p.text);
      for (const d of cfg.distractors ?? []) byId.set(d.id, d.text);
      const built = answer.pieceIds.map((id) => byId.get(id) ?? '').join('');
      return arabicEquals(built, cfg.targetWord);
    }
    default:
      return false;
  }
}

function sequencesEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
