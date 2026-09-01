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

export interface ValidationError {
  path: string;
  message: string;
}

export interface AdminStats {
  skills: number;
  exerciseTypes: number;
  exercises: number;
  published: number;
  drafts: number;
  assets: number;
  roadmaps: number;
}

export interface Skill {
  id: string;
  code: string;
  name: string;
  order: number;
}

export interface DifficultyLevel {
  id: string;
  code: string;
  name: string;
  order: number;
}

export interface AgeGroup {
  id: string;
  code: string;
  label: string;
  minAge: number;
  maxAge: number;
}

export interface ExerciseTypeLatestVersion {
  id: string;
  version: number;
  createdAt: string;
  configSchema?: Record<string, unknown>;
}

export interface ExerciseTypeSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  versionsCount: number;
  latestVersion: ExerciseTypeLatestVersion | null;
}

export interface ExerciseTypeVersion {
  id: string;
  version: number;
  configSchema: Record<string, unknown>;
  createdAt: string;
}

export interface ExerciseTypeUpdatePayload {
  name?: string;
  description?: string | null;
}

export interface ExerciseTypeDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  versions: ExerciseTypeVersion[];
}

export interface ExerciseTypeCreatePayload {
  code: string;
  name: string;
  description?: string;
  configSchema: Record<string, unknown>;
}

export type JsonObject = Record<string, unknown>;

export type ExerciseStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface ExerciseListVersion {
  id: string;
  title: string;
  status: ExerciseStatus;
  version: number;
  skill: { id: string; code: string; name: string };
  exerciseType: { id: string; code: string; name: string };
  difficultyLevel: { id: string; code: string };
}

export interface ExerciseListItem {
  id: string;
  versionsCount: number;
  stageNames: string[];
  latestVersion: ExerciseListVersion;
}

export interface ExerciseVersionDetail {
  id: string;
  version: number;
  title: string;
  instructions: string | null;
  status: ExerciseStatus;
  configuration: JsonObject;
  skillId: string;
  difficultyLevelId: string;
  ageGroupId: string | null;
  exerciseTypeVersionId: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface ExerciseDetail {
  id: string;
  versionsCount: number;
  stageNames: string[];
  versions: ExerciseVersionDetail[];
}

export interface ExerciseCreatePayload {
  title: string;
  instructions?: string;
  skillId: string;
  difficultyLevelId: string;
  ageGroupId?: string | null;
  exerciseTypeVersionId: string;
  configuration: JsonObject;
}

export interface ExerciseUpdatePayload {
  title?: string;
  instructions?: string | null;
  skillId?: string;
  difficultyLevelId?: string;
  ageGroupId?: string | null;
  configuration?: JsonObject;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface RoadmapSummary {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface RoadmapStageItem {
  id: string;
  order: number;
  exercise: { id: string; title: string } | null;
}

export interface RoadmapStage {
  id: string;
  name: string;
  order: number;
  masteryThreshold: number;
  minAccuracy: number | null;
  minSuccessfulAttempts: number | null;
  skills: { id: string; code: string; name: string }[];
  items: RoadmapStageItem[];
}

export interface RoadmapVersion {
  id: string;
  version: number;
  status: string;
  publishedAt: string | null;
  stages: RoadmapStage[];
}

export interface RoadmapDetail {
  id: string;
  name: string;
  isDefault: boolean;
  versions: RoadmapVersion[];
}

export interface StageUpdatePayload {
  masteryThreshold?: number;
  minAccuracy?: number | null;
  minSuccessfulAttempts?: number | null;
}

export type AssetType = "IMAGE" | "AUDIO" | "VIDEO" | "ANIMATION" | "GAME_ASSET";

export const ASSET_TYPES: readonly AssetType[] = [
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "ANIMATION",
  "GAME_ASSET",
] as const;

export interface Asset {
  id: string;
  type: AssetType;
  mimeType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  url: string;
}

export interface AssetUploadResult {
  id: string;
  type: AssetType;
  mimeType: string;
  url: string;
}

// Platform sounds (admin-manageable app audio with TTS fallback)
export interface AppSoundAsset {
  id: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface AppSound {
  key: string;
  label: string;
  textFallback: string;
  updatedAt: string;
  asset: AppSoundAsset | null;
}

export interface AppSoundUpdatePayload {
  assetId?: string | null;
  textFallback?: string;
  label?: string;
}
