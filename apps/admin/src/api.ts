import type {
  AdminStats,
  AdminUser,
  AgeGroup,
  AssessmentCreatePayload,
  AssessmentDetail,
  AssessmentItem,
  AssessmentItemCreatePayload,
  AssessmentItemUpdatePayload,
  AssessmentListItem,
  Asset,
  AssetType,
  AssetUploadResult,
  AuthResponse,
  DifficultyLevel,
  ExerciseCreatePayload,
  ExerciseDetail,
  ExerciseListItem,
  ExerciseTypeCreatePayload,
  ExerciseTypeDetail,
  ExerciseTypeSummary,
  ExerciseTypeUpdatePayload,
  ExerciseUpdatePayload,
  ExerciseVersionDetail,
  RoadmapDetail,
  RoadmapStage,
  RoadmapStageItem,
  RoadmapSummary,
  Role,
  Skill,
  StageUpdatePayload,
  User,
  UserCreatePayload,
  ValidationResult,
  AppSound,
  AppSoundUpdatePayload,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly validationErrors: { path: string; message: string }[];

  constructor(
    status: number,
    message: string,
    validationErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.validationErrors = validationErrors;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getApiBase(): string {
  return API_BASE;
}

function isValidationError(value: unknown): value is { path: string; message: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "path" in value && typeof value.path === "string" && "message" in value && typeof value.message === "string";
}

async function buildApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let validationErrors: { path: string; message: string }[] = [];
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "message" in data) {
      const rawMessage = (data as { message: unknown }).message;
      if (typeof rawMessage === "string" && rawMessage.length > 0) {
        message = rawMessage;
      } else if (Array.isArray(rawMessage)) {
        const parts = rawMessage.filter((part): part is string => typeof part === "string");
        if (parts.length > 0) {
          message = parts.join(", ");
        }
      }
    }
    if (typeof data === "object" && data !== null && "validationErrors" in data) {
      const rawErrors = (data as { validationErrors: unknown }).validationErrors;
      if (Array.isArray(rawErrors)) {
        validationErrors = rawErrors.filter(isValidationError);
      }
    }
  } catch {
    // The body was not JSON; keep the generic message.
  }
  return new ApiError(response.status, message, validationErrors);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken !== null) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ApiError(0, "Could not reach the server");
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function encodeQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, value);
    }
  }
  const encoded = search.toString();
  return encoded === "" ? "" : `?${encoded}`;
}

// ---------- Auth ----------

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

// ---------- Meta ----------

export function getStats(): Promise<AdminStats> {
  return request<AdminStats>("/admin/stats");
}

export function listSkills(): Promise<Skill[]> {
  return request<Skill[]>("/admin/skills");
}

export function listDifficultyLevels(): Promise<DifficultyLevel[]> {
  return request<DifficultyLevel[]>("/admin/difficulty-levels");
}

export function listAgeGroups(): Promise<AgeGroup[]> {
  return request<AgeGroup[]>("/admin/age-groups");
}

// ---------- Exercise types ----------

export function listExerciseTypes(includeSchemas = false): Promise<ExerciseTypeSummary[]> {
  return request<ExerciseTypeSummary[]>(
    `/admin/exercise-types${includeSchemas ? "?includeSchemas=1" : ""}`,
  );
}

export function getExerciseType(id: string): Promise<ExerciseTypeDetail> {
  return request<ExerciseTypeDetail>(`/admin/exercise-types/${id}`);
}

export function createExerciseType(payload: ExerciseTypeCreatePayload): Promise<ExerciseTypeDetail> {
  return request<ExerciseTypeDetail>("/admin/exercise-types", {
    method: "POST",
    body: payload,
  });
}

export function updateExerciseType(
  id: string,
  payload: ExerciseTypeUpdatePayload,
): Promise<ExerciseTypeDetail> {
  return request<ExerciseTypeDetail>(`/admin/exercise-types/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function createExerciseTypeVersion(
  id: string,
  configSchema: Record<string, unknown>,
): Promise<ExerciseTypeDetail> {
  return request<ExerciseTypeDetail>(`/admin/exercise-types/${id}/versions`, {
    method: "POST",
    body: { configSchema },
  });
}

// ---------- Exercises ----------

export interface ExerciseFilters {
  status?: string;
  skillId?: string;
  q?: string;
}

export function listExercises(filters: ExerciseFilters = {}): Promise<ExerciseListItem[]> {
  return request<ExerciseListItem[]>(
    `/admin/exercises${encodeQuery({ status: filters.status, skillId: filters.skillId, q: filters.q })}`,
  );
}

export function getExercise(id: string): Promise<ExerciseDetail> {
  return request<ExerciseDetail>(`/admin/exercises/${id}`);
}

export function createExercise(payload: ExerciseCreatePayload): Promise<ExerciseDetail> {
  return request<ExerciseDetail>("/admin/exercises", {
    method: "POST",
    body: payload,
  });
}

export function updateExercise(
  id: string,
  payload: ExerciseUpdatePayload,
): Promise<ExerciseDetail> {
  return request<ExerciseDetail>(`/admin/exercises/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function validateExercise(id: string): Promise<ValidationResult> {
  return request<ValidationResult>(`/admin/exercises/${id}/validate`, {
    method: "POST",
  });
}

export function publishExercise(id: string): Promise<ExerciseDetail> {
  return request<ExerciseDetail>(`/admin/exercises/${id}/publish`, {
    method: "POST",
  });
}

export function archiveExercise(id: string): Promise<ExerciseDetail> {
  return request<ExerciseDetail>(`/admin/exercises/${id}/archive`, {
    method: "POST",
  });
}

export function cloneExercise(id: string): Promise<ExerciseDetail> {
  return request<ExerciseDetail>(`/admin/exercises/${id}/clone`, {
    method: "POST",
  });
}

export type { ExerciseVersionDetail };

// ---------- Assessments (diagnostic) ----------

export function listAssessments(): Promise<AssessmentListItem[]> {
  return request<AssessmentListItem[]>("/admin/assessments");
}

export function getAssessment(id: string): Promise<AssessmentDetail> {
  return request<AssessmentDetail>(`/admin/assessments/${id}`);
}

export function createAssessment(payload: AssessmentCreatePayload): Promise<AssessmentDetail> {
  return request<AssessmentDetail>("/admin/assessments", { method: "POST", body: payload });
}

export function createAssessmentVersion(id: string): Promise<AssessmentDetail> {
  return request<AssessmentDetail>(`/admin/assessments/${id}/versions`, { method: "POST" });
}

export function createAssessmentItem(
  payload: AssessmentItemCreatePayload,
): Promise<AssessmentItem> {
  return request<AssessmentItem>("/admin/assessment-items", { method: "POST", body: payload });
}

export function updateAssessmentItem(
  id: string,
  payload: AssessmentItemUpdatePayload,
): Promise<AssessmentItem> {
  return request<AssessmentItem>(`/admin/assessment-items/${id}`, { method: "PATCH", body: payload });
}

export function deleteAssessmentItem(id: string): Promise<void> {
  return request<void>(`/admin/assessment-items/${id}`, { method: "DELETE" });
}

export function publishAssessmentVersion(versionId: string): Promise<AssessmentDetail> {
  return request<AssessmentDetail>(`/admin/assessment-versions/${versionId}/publish`, {
    method: "POST",
  });
}

// ---------- Roadmap ----------

export function listRoadmaps(): Promise<RoadmapSummary[]> {
  return request<RoadmapSummary[]>("/admin/roadmaps");
}

export function getRoadmap(id: string): Promise<RoadmapDetail> {
  return request<RoadmapDetail>(`/admin/roadmaps/${id}`);
}

export function updateStage(id: string, payload: StageUpdatePayload): Promise<RoadmapStage> {
  return request<RoadmapStage>(`/admin/stages/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export function addStageItem(stageId: string, exerciseId: string): Promise<RoadmapStageItem> {
  return request<RoadmapStageItem>(`/admin/stages/${stageId}/items`, {
    method: "POST",
    body: { exerciseId },
  });
}

export function deleteStageItem(itemId: string): Promise<void> {
  return request<void>(`/admin/stage-items/${itemId}`, {
    method: "DELETE",
  });
}

export function updateStageItemOrder(itemId: string, order: number): Promise<RoadmapStageItem> {
  return request<RoadmapStageItem>(`/admin/stage-items/${itemId}`, {
    method: "PATCH",
    body: { order },
  });
}

// ---------- Assets ----------

export function listAssets(type?: AssetType): Promise<Asset[]> {
  return request<Asset[]>(`/admin/assets${type ? `?type=${type}` : ""}`);
}

export function uploadAsset(file: File, type: AssetType): Promise<AssetUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);

  const headers: Record<string, string> = {};
  if (authToken !== null) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return fetch(`${API_BASE}/assets`, { method: "POST", headers, body: form }).then(
    async (response: Response): Promise<AssetUploadResult> => {
      if (!response.ok) {
        throw await buildApiError(response);
      }
      return (await response.json()) as AssetUploadResult;
    },
    () => {
      throw new ApiError(0, "Could not reach the server");
    },
  );
}

export function listAppSounds(): Promise<AppSound[]> {
  return request<AppSound[]>("/admin/app-sounds");
}

export function updateAppSound(key: string, payload: AppSoundUpdatePayload): Promise<AppSound> {
  return request<AppSound>(`/admin/app-sounds/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: payload,
  });
}

// ---------- Admin users ----------

export interface UserFilters {
  q?: string;
  role?: Role;
}

export function listUsers(filters: UserFilters = {}): Promise<AdminUser[]> {
  return request<AdminUser[]>(`/admin/users${encodeQuery({ q: filters.q, role: filters.role })}`);
}

export function createUser(payload: UserCreatePayload): Promise<AdminUser> {
  return request<AdminUser>("/admin/users", { method: "POST", body: payload });
}

export function setUserActive(id: string, active: boolean): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${id}/active`, {
    method: "PATCH",
    body: { active },
  });
}

export function resetUserPassword(id: string, password: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/admin/users/${id}/password`, {
    method: "PUT",
    body: { password },
  });
}

export function createRoadmap(name: string, order?: number): Promise<RoadmapDetail> {
  return request<RoadmapDetail>("/admin/roadmaps", { method: "POST", body: { name, order } });
}

export function updateRoadmap(id: string, payload: { name?: string; order?: number; isActive?: boolean }): Promise<RoadmapDetail> {
  return request<RoadmapDetail>(`/admin/roadmaps/${id}`, { method: "PUT", body: payload });
}

export function createRoadmapVersion(id: string): Promise<RoadmapDetail> {
  return request<RoadmapDetail>(`/admin/roadmaps/${id}/versions`, { method: "POST" });
}

export function publishRoadmapVersion(versionId: string): Promise<RoadmapDetail> {
  return request<RoadmapDetail>(`/admin/roadmap-versions/${versionId}/publish`, { method: "POST" });
}

export function addRoadmapStage(versionId: string, name: string): Promise<unknown> {
  return request<unknown>(`/admin/roadmap-versions/${versionId}/stages`, { method: "POST", body: { name } });
}

export function removeRoadmapStage(stageId: string): Promise<void> {
  return request<void>(`/admin/stages/${stageId}`, { method: "DELETE" });
}

export function deleteRoadmap(roadmapId: string): Promise<void> {
  return request<void>(`/admin/roadmaps/${roadmapId}`, { method: "DELETE" });
}
