import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from './evaluate.js';

const mcConfig = {
  prompt: { text: 'قطة' },
  options: [
    { id: 'o1', text: 'قط' },
    { id: 'o2', text: 'كلب' },
    { id: 'o3', text: 'حصان' },
  ],
  correctOptionId: 'o1',
};

const audioPair = {
  mode: 'pair_comparison',
  wordA: { text: 'باب' },
  wordB: { text: 'دب' },
  question: 'same_word',
  correct: 'different',
};

const ordering = {
  presentation: 'sequential_audio',
  items: [
    { id: 'i1', text: 'شمس' },
    { id: 'i2', text: 'بيت' },
    { id: 'i3', text: 'قلم' },
  ],
};

const wordBuilder = {
  targetWord: 'قلم',
  pieceKind: 'letter',
  pieces: [
    { id: 'p1', text: 'ق' },
    { id: 'p2', text: 'ل' },
    { id: 'p3', text: 'م' },
  ],
  distractors: [{ id: 'd1', text: 'س' }],
  audio: { text: 'قلم' },
};

const memory = {
  task: 'reorder',
  cards: [
    { id: 'c1', text: 'ب' },
    { id: 'c2', text: 'ت' },
    { id: 'c3', text: 'ث' },
  ],
  displaySeconds: 5,
};

describe('evaluateAnswer: option types', () => {
  it('MULTIPLE_CHOICE correct option passes', () => {
    expect(evaluateAnswer('MULTIPLE_CHOICE', mcConfig, { kind: 'option', optionId: 'o1' })).toBe(true);
  });
  it('wrong option fails', () => {
    expect(evaluateAnswer('MULTIPLE_CHOICE', mcConfig, { kind: 'option', optionId: 'o2' })).toBe(false);
  });
  it('IMAGE_MATCH follows correctOptionId', () => {
    const cfg = { ...mcConfig, cueStyle: 'none' };
    expect(evaluateAnswer('IMAGE_MATCH', cfg, { kind: 'option', optionId: 'o3' })).toBe(false);
    expect(evaluateAnswer('IMAGE_MATCH', cfg, { kind: 'option', optionId: 'o1' })).toBe(true);
  });
  it('mismatched answer kind scores false', () => {
    expect(evaluateAnswer('MULTIPLE_CHOICE', mcConfig, { kind: 'position', position: 'end' })).toBe(false);
  });
});

describe('evaluateAnswer: AUDIO_MATCH', () => {
  it('pair_comparison matches correct verdict', () => {
    expect(
      evaluateAnswer('AUDIO_MATCH', audioPair, { kind: 'pair_comparison', answer: 'different' }),
    ).toBe(true);
    expect(
      evaluateAnswer('AUDIO_MATCH', audioPair, { kind: 'pair_comparison', answer: 'same' }),
    ).toBe(false);
  });
  it('sound_to_image matches correct option', () => {
    const cfg = {
      mode: 'sound_to_image',
      target: { text: 'قط' },
      options: [
        { id: 'a', imageAssetId: 'x' },
        { id: 'b', imageAssetId: 'y' },
      ],
      correctOptionId: 'b',
    };
    expect(evaluateAnswer('AUDIO_MATCH', cfg, { kind: 'option', optionId: 'b' })).toBe(true);
    expect(evaluateAnswer('AUDIO_MATCH', cfg, { kind: 'option', optionId: 'a' })).toBe(false);
  });
});

describe('evaluateAnswer: SOUND_POSITION', () => {
  const cfg = { word: { text: 'كتاب' }, targetPhoneme: 'ك', correctPosition: 'beginning' };
  it('correct position passes', () => {
    expect(evaluateAnswer('SOUND_POSITION', cfg, { kind: 'position', position: 'beginning' })).toBe(true);
  });
  it('wrong position fails', () => {
    expect(evaluateAnswer('SOUND_POSITION', cfg, { kind: 'position', position: 'middle' })).toBe(false);
  });
});

describe('evaluateAnswer: sequence types', () => {
  it('ORDERING exact order passes', () => {
    expect(evaluateAnswer('ORDERING', ordering, { kind: 'order', itemIds: ['i1', 'i2', 'i3'] })).toBe(true);
  });
  it('ORDERING swapped order fails', () => {
    expect(evaluateAnswer('ORDERING', ordering, { kind: 'order', itemIds: ['i2', 'i1', 'i3'] })).toBe(false);
  });
  it('ORDERING missing item fails', () => {
    expect(evaluateAnswer('ORDERING', ordering, { kind: 'order', itemIds: ['i1', 'i2'] })).toBe(false);
  });
  it('MEMORY_GAME evaluates card order', () => {
    expect(evaluateAnswer('MEMORY_GAME', memory, { kind: 'order', itemIds: ['c1', 'c2', 'c3'] })).toBe(true);
    expect(evaluateAnswer('MEMORY_GAME', memory, { kind: 'order', itemIds: ['c3', 'c2', 'c1'] })).toBe(false);
  });
});

describe('evaluateAnswer: WORD_BUILDER', () => {
  it('correct pieces in order pass', () => {
    expect(evaluateAnswer('WORD_BUILDER', wordBuilder, { kind: 'word', pieceIds: ['p1', 'p2', 'p3'] })).toBe(true);
  });
  it('diacritized target still matches bare pieces', () => {
    const cfg = { ...wordBuilder, targetWord: 'قَلَم' };
    expect(evaluateAnswer('WORD_BUILDER', cfg, { kind: 'word', pieceIds: ['p1', 'p2', 'p3'] })).toBe(true);
  });
  it('wrong order fails', () => {
    expect(evaluateAnswer('WORD_BUILDER', wordBuilder, { kind: 'word', pieceIds: ['p2', 'p1', 'p3'] })).toBe(false);
  });
  it('unknown piece id fails without throwing', () => {
    expect(evaluateAnswer('WORD_BUILDER', wordBuilder, { kind: 'word', pieceIds: ['zz', 'p2', 'p3'] })).toBe(false);
  });
  it('unknown type code scores false', () => {
    expect(evaluateAnswer('FUTURE_TYPE', mcConfig, { kind: 'option', optionId: 'o1' })).toBe(false);
  });
});
