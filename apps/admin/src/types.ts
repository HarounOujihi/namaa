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

// ---------- Admin users ----------

export interface AdminUser extends User {
  locale: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  fullName: string;
  role: Role;
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

export interface RoadmapCategoryRef {
  id: string;
  name: string;
}

/** Fields shared by GET /admin/roadmaps items and GET /admin/roadmaps/:id. */
interface RoadmapBase {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  description: string | null;
  categoryId: string | null;
  category: RoadmapCategoryRef | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  hasPublishedVersion: boolean;
}

export interface RoadmapSummary extends RoadmapBase {
  _count: { versions: number };
}

export interface RoadmapCreatePayload {
  name: string;
  order?: number;
  description?: string;
  categoryId?: string;
  coverAssetId?: string;
}

/** Any subset; `null` clears the nullable fields. */
export interface RoadmapUpdatePayload {
  name?: string;
  order?: number;
  isActive?: boolean;
  description?: string | null;
  categoryId?: string | null;
  coverAssetId?: string | null;
}

export interface AdminRoadmapCategory {
  id: string;
  name: string;
  description: string | null;
  coverAssetId: string | null;
  coverUrl: string | null;
  order: number;
  roadmapCount: number;
  createdAt: string;
}

export interface RoadmapCategoryCreatePayload {
  name: string;
  description?: string;
  coverAssetId?: string;
  order?: number;
}

/** Any subset; `null` clears description / cover. */
export interface RoadmapCategoryUpdatePayload {
  name?: string;
  description?: string | null;
  coverAssetId?: string | null;
  order?: number;
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

export interface RoadmapDetail extends RoadmapBase {
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
  originalName: string | null;
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
  originalName: string | null;
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

// ---------- Diagnostic assessments ----------

export type AssessmentStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface AssessmentListVersion {
  id: string;
  version: number;
  status: AssessmentStatus;
  publishedAt: string | null;
  itemCount: number;
}

export interface AssessmentListItem {
  id: string;
  name: string;
  versions: AssessmentListVersion[];
}

export interface AssessmentItem {
  id: string;
  order: number;
  skillId: string;
  skill: { id: string; code: string; name: string };
  exerciseTypeVersionId: string;
  typeCode: string;
  configuration: JsonObject;
}

export interface AssessmentVersionDetail {
  id: string;
  version: number;
  status: AssessmentStatus;
  publishedAt: string | null;
  items: AssessmentItem[];
}

export interface AssessmentDetail {
  id: string;
  name: string;
  versions: AssessmentVersionDetail[];
}

export interface AssessmentCreatePayload {
  name: string;
}

export interface AssessmentItemCreatePayload {
  assessmentVersionId: string;
  skillId: string;
  exerciseTypeVersionId: string;
  configuration: JsonObject;
}

export interface AssessmentItemUpdatePayload {
  skillId?: string;
  configuration?: JsonObject;
}
