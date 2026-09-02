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

export interface PlayRoadmap {
  child: { id: string; fullName: string };
  roadmap: { id: string; name: string };
  stages: PlayStage[];
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
}

export interface PlayAttemptResult {
  clientAttemptId: string;
  attemptNumber: number;
  correct: boolean;
  score: number;
  isSuccess: boolean;
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
