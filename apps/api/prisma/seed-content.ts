/**
 * First-wave content seed — mirrors plans/exercise_type_spec.md (v1).
 * Arabic exercise content is canonical; schemas are JSON Schema draft-07.
 */

const promptDef = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string' },
    imageAssetId: { type: 'string' },
    audioAssetId: { type: 'string' },
  },
};

const optionDef = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    imageAssetId: { type: 'string' },
    audioAssetId: { type: 'string' },
  },
};

const defs = { definitions: { prompt: promptDef, option: optionDef } };

export const DIFFICULTY_LEVELS = [
  { code: 'BEGINNER', name: 'Beginner', order: 1 },
  { code: 'INTERMEDIATE', name: 'Intermediate', order: 2 },
  { code: 'ADVANCED', name: 'Advanced', order: 3 },
];

export const AGE_GROUPS = [
  { code: 'AG_4_6', label: '4–6 years', minAge: 4, maxAge: 6 },
  { code: 'AG_7_9', label: '7–9 years', minAge: 7, maxAge: 9 },
  { code: 'AG_10_12', label: '10–12 years', minAge: 10, maxAge: 12 },
];

export const EXERCISE_TYPES = [
  {
    code: 'MULTIPLE_CHOICE',
    name: 'Multiple Choice',
    description: 'Generic prompt → pick one option (odd-one-out, vocabulary, spelling, comprehension).',
    configSchema: {
      ...defs,
      type: 'object',
      additionalProperties: false,
      required: ['prompt', 'options', 'correctOptionId'],
      properties: {
        prompt: { $ref: '#/definitions/prompt' },
        options: { type: 'array', minItems: 2, maxItems: 6, items: { $ref: '#/definitions/option' } },
        correctOptionId: { type: 'string' },
        feedbackText: { type: 'string' },
      },
    },
  },
  {
    code: 'IMAGE_MATCH',
    name: 'Image Match',
    description: 'Match a picture (or partial word) to its letter/word from close-looking options.',
    configSchema: {
      ...defs,
      type: 'object',
      additionalProperties: false,
      required: ['prompt', 'options', 'correctOptionId', 'cueStyle'],
      properties: {
        prompt: { $ref: '#/definitions/prompt' },
        options: { type: 'array', minItems: 2, maxItems: 6, items: { $ref: '#/definitions/option' } },
        correctOptionId: { type: 'string' },
        cueStyle: { enum: ['none', 'dots'] },
      },
    },
  },
  {
    code: 'AUDIO_MATCH',
    name: 'Audio Match',
    description: 'Sound comparison (same/different) or match a heard word to its picture.',
    configSchema: {
      type: 'object',
      required: ['mode'],
      oneOf: [
        {
          properties: {
            mode: { const: 'pair_comparison' },
            wordA: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, audioAssetId: { type: 'string' } } },
            wordB: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, audioAssetId: { type: 'string' } } },
            promptImageAssetIdA: { type: 'string' },
            promptImageAssetIdB: { type: 'string' },
            question: { enum: ['same_first_sound', 'same_word'] },
            correct: { enum: ['same', 'different'] },
          },
          required: ['wordA', 'wordB', 'question', 'correct'],
        },
        {
          properties: {
            mode: { const: 'sound_to_image' },
            target: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, audioAssetId: { type: 'string' } } },
            options: { type: 'array', minItems: 2, maxItems: 6, items: { $ref: '#/definitions/option' } },
            correctOptionId: { type: 'string' },
          },
          required: ['target', 'options', 'correctOptionId'],
        },
      ],
      definitions: { option: optionDef },
    },
  },
  {
    code: 'SOUND_POSITION',
    name: 'Sound Position',
    description: 'Where does the target phoneme fall in the word — beginning, middle, or end?',
    configSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['word', 'targetPhoneme', 'correctPosition'],
      properties: {
        word: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, audioAssetId: { type: 'string' } } },
        targetPhoneme: { type: 'string', minLength: 1, maxLength: 2 },
        correctPosition: { enum: ['beginning', 'middle', 'end'] },
      },
    },
  },
  {
    code: 'ORDERING',
    name: 'Ordering',
    description: 'Reproduce or restore a sequence (auditory/visual memory, scrambled letters, event order).',
    configSchema: {
      ...defs,
      type: 'object',
      additionalProperties: false,
      required: ['presentation', 'items'],
      properties: {
        presentation: { enum: ['sequential_audio', 'visual'] },
        items: { type: 'array', minItems: 2, maxItems: 8, items: { $ref: '#/definitions/option' } },
        displaySeconds: { type: 'number', minimum: 1, maximum: 30 },
      },
    },
  },
  {
    code: 'WORD_BUILDER',
    name: 'Word Builder',
    description: 'Drag letters/syllables into slots to build the target word.',
    configSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['targetWord', 'pieceKind', 'pieces', 'audio'],
      properties: {
        targetWord: { type: 'string', minLength: 2 },
        pieceKind: { enum: ['letter', 'syllable'] },
        pieces: {
          type: 'array',
          minItems: 2,
          maxItems: 8,
          items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' } } },
        },
        distractors: {
          type: 'array',
          maxItems: 4,
          items: { type: 'object', additionalProperties: false, required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string' } } },
        },
        audio: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, audioAssetId: { type: 'string' } } },
      },
    },
  },
  {
    code: 'MEMORY_GAME',
    name: 'Memory Game',
    description: 'Cards shown briefly, then the child reproduces the order.',
    configSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['task', 'cards', 'displaySeconds'],
      properties: {
        task: { const: 'reorder' },
        cards: {
          type: 'array',
          minItems: 3,
          maxItems: 8,
          items: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' }, text: { type: 'string' }, imageAssetId: { type: 'string' } } },
        },
        displaySeconds: { type: 'number', minimum: 1, maximum: 20 },
      },
    },
  },
];

// Samples are the client brief's own examples, one+ per type.
export const SAMPLE_EXERCISES = [
  {
    typeCode: 'AUDIO_MATCH',
    skillCode: 'AUDITORY_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'تمييز الأصوات: باب / دب',
    instructions: 'استمع للكلمتين ثم اختر: متشابهتان أم مختلفتان؟',
    configuration: {
      mode: 'pair_comparison',
      wordA: { text: 'باب' },
      wordB: { text: 'دب' },
      question: 'same_word',
      correct: 'different',
    },
  },
  {
    typeCode: 'SOUND_POSITION',
    skillCode: 'AUDITORY_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'أين الصوت؟ كتاب / ك',
    instructions: 'استمع لكلمة «كتاب». أين يقع صوت (ك)؟',
    configuration: {
      word: { text: 'كتاب' },
      targetPhoneme: 'ك',
      correctPosition: 'beginning',
    },
  },
  {
    typeCode: 'ORDERING',
    skillCode: 'AUDITORY_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'ذاكرة سمعية: شمس، بيت، قلم',
    instructions: 'استمع للكلمات ثم رتّب الصور بالترتيب نفسه.',
    configuration: {
      presentation: 'sequential_audio',
      items: [
        { id: 'i1', text: 'شمس' },
        { id: 'i2', text: 'بيت' },
        { id: 'i3', text: 'قلم' },
      ],
    },
  },
  {
    typeCode: 'IMAGE_MATCH',
    skillCode: 'VISUAL_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'مطابقة الصورة بالحرف: سمكة',
    instructions: 'ما الحرف الذي تبدأ به كلمة «سمكة»؟',
    configuration: {
      prompt: { text: 'سمكة' },
      options: [
        { id: 'o1', text: 'س' },
        { id: 'o2', text: 'ص' },
        { id: 'o3', text: 'ش' },
      ],
      correctOptionId: 'o1',
      cueStyle: 'none',
    },
  },
  {
    typeCode: 'MULTIPLE_CHOICE',
    skillCode: 'VISUAL_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'أوجد المختلف: ب ب ب ت ب',
    instructions: 'ابحث عن الحرف المختلف.',
    configuration: {
      prompt: { text: 'أوجد المختلف' },
      options: [
        { id: 'a', text: 'ب' },
        { id: 'b', text: 'ب' },
        { id: 'c', text: 'ب' },
        { id: 'd', text: 'ت' },
        { id: 'e', text: 'ب' },
      ],
      correctOptionId: 'd',
    },
  },
  {
    typeCode: 'MEMORY_GAME',
    skillCode: 'VISUAL_PERCEPTION',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'الذاكرة البصرية: خمس بطاقات',
    instructions: 'راقب البطاقات ثم أعد ترتيبها كما ظهرت.',
    configuration: {
      task: 'reorder',
      cards: [
        { id: 'c1', text: 'ب' },
        { id: 'c2', text: 'ت' },
        { id: 'c3', text: 'ث' },
        { id: 'c4', text: 'ج' },
        { id: 'c5', text: 'ح' },
      ],
      displaySeconds: 5,
    },
  },
  {
    typeCode: 'WORD_BUILDER',
    skillCode: 'DECODING',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'تركيب كلمة: بابا',
    instructions: 'رتّب المقاطع لتكوين كلمة «بابا».',
    configuration: {
      targetWord: 'بابا',
      pieceKind: 'syllable',
      pieces: [
        { id: 'p1', text: 'با' },
        { id: 'p2', text: 'با' },
      ],
      distractors: [{ id: 'd1', text: 'بو' }],
      audio: { text: 'بابا' },
    },
  },
  {
    typeCode: 'MULTIPLE_CHOICE',
    skillCode: 'VOCABULARY',
    difficultyCode: 'BEGINNER',
    ageGroupCode: 'AG_4_6',
    title: 'مطابقة الصورة بالكلمة: قطة',
    instructions: 'اختر الكلمة التي تطابق الصورة.',
    configuration: {
      prompt: { text: 'قطة' },
      options: [
        { id: 'o1', text: 'قط' },
        { id: 'o2', text: 'كلب' },
        { id: 'o3', text: 'حصان' },
      ],
      correctOptionId: 'o1',
    },
  },
  {
    typeCode: 'MULTIPLE_CHOICE',
    skillCode: 'READING_COMPREHENSION',
    difficultyCode: 'INTERMEDIATE',
    ageGroupCode: 'AG_7_9',
    title: 'اقرأ ثم أجب: سلمى في السوق',
    instructions: 'اقرأ الجملة ثم أجب عن السؤال.',
    configuration: {
      prompt: {
        text: 'ذهبت سلمى إلى السوق مع أمها واشترت تفاحاً. ما الذي اشترته سلمى؟',
      },
      options: [
        { id: 'o1', text: 'موز' },
        { id: 'o2', text: 'تفاح' },
        { id: 'o3', text: 'برتقال' },
      ],
      correctOptionId: 'o2',
    },
  },
];

// stage identified by its required skill; items = sample exercise titles in order
export const STAGE_ASSIGNMENTS: { stageSkillCode: string; exerciseTitles: string[] }[] = [
  { stageSkillCode: 'AUDITORY_PERCEPTION', exerciseTitles: ['تمييز الأصوات: باب / دب', 'أين الصوت؟ كتاب / ك', 'ذاكرة سمعية: شمس، بيت، قلم'] },
  { stageSkillCode: 'VISUAL_PERCEPTION', exerciseTitles: ['مطابقة الصورة بالحرف: سمكة', 'أوجد المختلف: ب ب ب ت ب', 'الذاكرة البصرية: خمس بطاقات'] },
  { stageSkillCode: 'DECODING', exerciseTitles: ['تركيب كلمة: بابا'] },
  { stageSkillCode: 'VOCABULARY', exerciseTitles: ['مطابقة الصورة بالكلمة: قطة'] },
  { stageSkillCode: 'READING_COMPREHENSION', exerciseTitles: ['اقرأ ثم أجب: سلمى في السوق'] },
];
