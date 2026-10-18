import type { ExerciseAnswer } from "@dyslexia/exercise-engine";

export type Role = "PARENT" | "SPECIALIST" | "SUPER_ADMIN";

export interface User {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Child {
  id: string;
  fullName: string;
  birthDate: string;
  gradeLevel: string | null;
  avatarAssetId: string | null;
  avatarUrl: string | null;
}

export interface CreateChildInput {
  fullName: string;
  birthDate: string;
  gradeLevel?: string;
}

export interface CreateChildResponse {
  child: Child;
  inviteCode: string | null;
}

export interface RedeemInviteResponse {
  child: Child;
  alreadyLinked: boolean;
}

export interface UpdateChildInput {
  fullName?: string;
  gradeLevel?: string;
}

export interface PlayExercise {
  id: string;
  exerciseVersionId: string;
  title: string;
  instructions: string | null;
  typeCode: string;
  configuration: unknown;
  skill: { code: string; name: string };
  assetUrls: Record<string, string>;
}

export interface PlayStageItem {
  id: string;
  order: number;
  exercise: PlayExercise | null;
  /** Server: a successful attempt for this exercise was played from this roadmap. */
  completed: boolean;
}

export interface PlayStage {
  id: string;
  name: string;
  order: number;
  items: PlayStageItem[];
  completedItems: number;
  totalItems: number;
  completed: boolean;
  unlocked: boolean;
}

export interface PlayCategory {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  order: number;
}

export interface PlayRoadmapProgress {
  opened: boolean;
  lastActivityAt: string | null;
  completedStages: number;
  totalStages: number;
  completedItems: number;
  totalItems: number;
  stars: number;
  maxStars: number;
  currentStageName: string | null;
  completed: boolean;
}

export interface PlayRoadmapSummary {
  id: string;
  name: string;
  order: number;
  description: string | null;
  coverUrl: string | null;
  categoryId: string | null;
  progress: PlayRoadmapProgress;
  stages: PlayStage[];
}

export interface PlayRoadmapsResponse {
  child: { id: string; fullName: string };
  categories: PlayCategory[];
  roadmaps: PlayRoadmapSummary[];
}

export interface PlayAttemptAnswer {
  questionKey: "answer";
  answer: ExerciseAnswer;
  responseTimeMs: number;
}

export interface PlayAttemptInput {
  childId: string;
  clientAttemptId: string;
  exerciseVersionId: string;
  startedAt: string;
  completedAt: string;
  answers: PlayAttemptAnswer[];
  /** The roadmap the exercise was played from; progress is tracked per roadmap. */
  roadmapId?: string;
}

export interface PlayAttemptResult {
  clientAttemptId: string;
  attemptNumber: number;
  correct: boolean;
  score: number;
  isSuccess: boolean;
  duplicate: boolean;
  /** Gamification: 0–3 stars for a correct answer, 0 otherwise. */
  stars: number;
  pointsEarned: number;
  /** Arabic badge names just earned with this attempt. */
  newBadges: string[];
}

export interface PlayBadge {
  code: string;
  name: string;
  /** ISO date when earned; null while the badge is still locked. */
  earnedAt: string | null;
}

export interface PlayRewardItem {
  id: string;
  code: string;
  name: string;
  price: number;
  owned: boolean;
  equipped: boolean;
  /** The customization color applied to the owl's ring on the journey map. */
  color: string;
}

export interface PlayRewards {
  balance: number;
  lifetimePoints: number;
  stars: number;
  badges: PlayBadge[];
  items: PlayRewardItem[];
}

export interface PlayPurchaseResult {
  balance: number;
  item: PlayRewardItem;
}

export interface PlayEquipResult {
  balance: number;
  equippedId: string;
}

export interface PlayAssessmentItem {
  id: string;
  order: number;
  skill: { code: string; name: string };
  typeCode: string;
  configuration: unknown;
  assetUrls: Record<string, string>;
}

export interface PlayAssessmentSkillResult {
  skillCode: string;
  skillName: string;
  correct: number;
  total: number;
  startingLevel: number;
}

export interface PlayAssessment {
  assessment: { id: string; name: string };
  version: { id: string; version: number };
  needsAssessment: boolean;
  items: PlayAssessmentItem[];
  lastResults: PlayAssessmentSkillResult[] | null;
}

export interface PlayAssessmentAttemptAnswer {
  itemId: string;
  answer: ExerciseAnswer;
  responseTimeMs: number;
}

export interface PlayAssessmentAttemptInput {
  childId: string;
  clientAttemptId: string;
  assessmentVersionId: string;
  startedAt: string;
  completedAt: string;
  answers: PlayAssessmentAttemptAnswer[];
}

export interface PlayAssessmentAttemptResult {
  results: PlayAssessmentSkillResult[];
  duplicate: boolean;
}

// Platform sounds: url null means the app falls back to TTS of `text`
export interface AppSoundEntry {
  url: string | null;
  text: string;
}

export type AppSoundsMap = Record<string, AppSoundEntry>;

// Progression engine: a gentler same-skill activity offered after repeated failure
export interface PlayRecommendation {
  skill: { code: string; name: string };
  exercise: PlayExercise;
}

// Parent-managed screen-time settings (advisory enforcement in-app)
export interface ChildSettings {
  dailyLimitMinutes: number | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
}
