import type {
  ActivityRow,
  AppLocale,
  AuthResponse,
  Child,
  ChildPlan,
  ChildSettings,
  ChildSpecialist,
  CreateChildPayload,
  CreateChildResult,
  ProgressCurveData,
  RedeemResult,
  RoadmapExerciseOption,
  SpecialistOverviewRow,
  WeeklySummary,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function buildApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "message" in data) {
      const rawMessage = data.message;
      if (typeof rawMessage === "string" && rawMessage.length > 0) {
        message = rawMessage;
      } else if (Array.isArray(rawMessage)) {
        const parts = rawMessage.filter((part): part is string => typeof part === "string");
        if (parts.length > 0) {
          message = parts.join(", ");
        }
      }
    }
  } catch {
    // The body was not JSON; keep the generic message.
  }
  return new ApiError(response.status, message);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
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
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ApiError(0, "");
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Network-level failures carry status 0 and no server message. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

// ---------- Auth ----------

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", { method: "POST", body: { email, password } });
}

export function updateLocale(locale: AppLocale): Promise<{ locale: AppLocale }> {
  return request<{ locale: AppLocale }>("/auth/locale", { method: "PUT", body: { locale } });
}

// ---------- Children ----------

export function listChildren(): Promise<Child[]> {
  return request<Child[]>("/children");
}

export function getChildSummary(childId: string): Promise<WeeklySummary> {
  return request<WeeklySummary>(`/children/${childId}/summary`);
}

export function getChildSettings(childId: string): Promise<ChildSettings> {
  return request<ChildSettings>(`/children/${childId}/settings`);
}

export function updateChildSettings(
  childId: string,
  payload: ChildSettings,
): Promise<ChildSettings> {
  return request<ChildSettings>(`/children/${childId}/settings`, {
    method: "PUT",
    body: payload,
  });
}

export function getChildSpecialists(childId: string): Promise<ChildSpecialist[]> {
  return request<ChildSpecialist[]>(`/children/${childId}/specialists`);
}

// ---------- Specialist care data (reads: PARENT|SPECIALIST, writes: SPECIALIST) ----------

export function createChild(payload: CreateChildPayload): Promise<CreateChildResult> {
  return request<CreateChildResult>("/children", { method: "POST", body: payload });
}

export function getSpecialistOverview(): Promise<SpecialistOverviewRow[]> {
  return request<SpecialistOverviewRow[]>("/specialist/overview");
}

export function getChildActivities(childId: string, limit = 25): Promise<ActivityRow[]> {
  return request<ActivityRow[]>(`/children/${childId}/activities?limit=${limit}`);
}

export function getChildProgressCurve(childId: string): Promise<ProgressCurveData> {
  return request<ProgressCurveData>(`/children/${childId}/progress-curve`);
}

export function getChildPlan(childId: string): Promise<ChildPlan> {
  return request<ChildPlan>(`/children/${childId}/plan`);
}

export function setExerciseVisibility(
  childId: string,
  exerciseId: string,
  hidden: boolean,
): Promise<unknown> {
  return request<unknown>(`/children/${childId}/plan/visibility`, {
    method: "PUT",
    body: { exerciseId, hidden },
  });
}

export function setChildSkillLevel(
  childId: string,
  skillId: string,
  level: number,
): Promise<{ skillId: string; level: number }> {
  return request<{ skillId: string; level: number }>(`/children/${childId}/skill-level`, {
    method: "PUT",
    body: { skillId, level },
  });
}

/** Roadmap exercises flattened to picker options (stage → item → exercise). */
export function getChildRoadmapExercises(
  childId: string,
): Promise<RoadmapExerciseOption[]> {
  return request<{
    stages: Array<{
      name: string;
      items: Array<{ exercise?: { id: string; title: string } }>;
    }>;
  }>(`/play/${childId}/roadmap`).then((data) =>
    data.stages.flatMap((stage) =>
      stage.items
        .filter((item) => item.exercise != null)
        .map((item) => ({
          id: item.exercise!.id,
          title: item.exercise!.title,
          stageName: stage.name,
        })),
    ),
  );
}

// ---------- Invites (parent only) ----------

export function redeemInvite(code: string): Promise<RedeemResult> {
  return request<RedeemResult>("/invites/redeem", { method: "POST", body: { code } });
}
