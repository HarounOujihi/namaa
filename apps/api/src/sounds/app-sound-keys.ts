export interface AppSoundKeyDef {
  key: string;
  label: string;
  description: string;
  defaultText: string;
}

/** Canonical platform-sound slots. Rows are seeded from this list. */
export const KNOWN_APP_SOUND_KEYS: AppSoundKeyDef[] = [
  {
    key: 'WELCOME',
    label: 'Welcome',
    description: 'Played when a child profile is selected and the journey opens',
    defaultText: 'أهلًا بك! هيا نبدأ رحلة ممتعة',
  },
  {
    key: 'CELEBRATION_CORRECT',
    label: 'Celebration — correct answer',
    description: 'Played on a correct exercise answer (with the visual celebration)',
    defaultText: 'أحسنت! عمل رائع',
  },
  {
    key: 'ENCOURAGEMENT_RETRY',
    label: 'Encouragement — retry',
    description: 'Played gently when the answer was not correct',
    defaultText: 'لنجرب مرة أخرى، أنت تستطيع',
  },
  {
    key: 'STAGE_COMPLETE',
    label: 'Stage complete',
    description: 'Played when every exercise in a stage has been completed',
    defaultText: 'رائع! أكملت المرحلة كاملة',
  },
];
