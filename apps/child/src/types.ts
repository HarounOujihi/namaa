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
