import type {
  AppSoundsMap,
  AuthResponse,
  Child,
  CreateChildInput,
  CreateChildResponse,
  PlayAssessment,
  PlayAssessmentAttemptInput,
  PlayAssessmentAttemptResult,
  PlayAttemptInput,
  PlayAttemptResult,
  PlayEquipResult,
  PlayPurchaseResult,
  PlayRewards,
  PlayRoadmapsResponse,
  RedeemInviteResponse,
  UpdateChildInput,
  PlayRecommendation,
  ChildSettings,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token !== undefined) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "تعذر الاتصال بالخادم، تحقق من اتصالك ثم حاول مجددًا");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && "message" in data) {
      const message = data.message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
      if (Array.isArray(message)) {
        const parts = message.filter((part): part is string => typeof part === "string");
        if (parts.length > 0) {
          return parts.join(" — ");
        }
      }
    }
  } catch {
    // The body was not JSON; fall through to the generic message below.
  }
  return `حدث خطأ (${response.status})`;
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function listChildren(token: string): Promise<Child[]> {
  return request<Child[]>("/children", { token });
}

export function createChild(token: string, input: CreateChildInput): Promise<CreateChildResponse> {
  return request<CreateChildResponse>("/children", {
    method: "POST",
    token,
    body: input,
  });
}

export function updateChild(token: string, childId: string, input: UpdateChildInput): Promise<Child> {
  return request<Child>(`/children/${encodeURIComponent(childId)}`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export function deleteChild(token: string, childId: string): Promise<void> {
  return request<void>(`/children/${encodeURIComponent(childId)}`, {
    method: "DELETE",
    token,
  });
}

export function redeemInvite(token: string, code: string): Promise<RedeemInviteResponse> {
  return request<RedeemInviteResponse>("/invites/redeem", {
    method: "POST",
    token,
    body: { code },
  });
}

export function getPlayRoadmaps(token: string, childId: string): Promise<PlayRoadmapsResponse> {
  return request<PlayRoadmapsResponse>(`/play/${encodeURIComponent(childId)}/roadmaps`, { token });
}

export function getPlayAssessment(token: string, childId: string): Promise<PlayAssessment> {
  return request<PlayAssessment>(`/play/${encodeURIComponent(childId)}/assessment`, { token });
}

export function submitPlayAssessmentAttempt(
  token: string,
  input: PlayAssessmentAttemptInput,
): Promise<PlayAssessmentAttemptResult> {
  return request<PlayAssessmentAttemptResult>(
    `/play/${encodeURIComponent(input.childId)}/assessment/attempts`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
}

export function submitPlayAttempt(token: string, input: PlayAttemptInput): Promise<PlayAttemptResult> {
  return request<PlayAttemptResult>("/play/attempts", {
    method: "POST",
    token,
    body: input,
  });
}

export function getPlayRewards(token: string, childId: string): Promise<PlayRewards> {
  return request<PlayRewards>(`/play/${encodeURIComponent(childId)}/rewards`, { token });
}

export function purchasePlayReward(
  token: string,
  childId: string,
  rewardId: string,
): Promise<PlayPurchaseResult> {
  return request<PlayPurchaseResult>(`/play/${encodeURIComponent(childId)}/rewards/purchase`, {
    method: "POST",
    token,
    body: { rewardId },
  });
}

export function equipPlayReward(
  token: string,
  childId: string,
  rewardId: string,
): Promise<PlayEquipResult> {
  return request<PlayEquipResult>(`/play/${encodeURIComponent(childId)}/rewards/equip`, {
    method: "POST",
    token,
    body: { rewardId },
  });
}

export function getAppSounds(token: string): Promise<AppSoundsMap> {
  return request<AppSoundsMap>("/play/sounds", { token }).then(
    (body: unknown) => (body as { sounds: AppSoundsMap }).sounds,
  );
}

export function getRecommendations(token: string, childId: string): Promise<PlayRecommendation[]> {
  return request<PlayRecommendation[]>(`/play/${encodeURIComponent(childId)}/recommendations`, { token });
}

export function getChildSettings(token: string, childId: string): Promise<ChildSettings> {
  return request<ChildSettings>(`/children/${encodeURIComponent(childId)}/settings`, { token });
}

export function updateChildSettings(
  token: string,
  childId: string,
  input: { dailyLimitMinutes?: number | null; reminderEnabled?: boolean; reminderTime?: string | null },
): Promise<ChildSettings> {
  return request<ChildSettings>(`/children/${encodeURIComponent(childId)}/settings`, {
    method: "PUT",
    token,
    body: input,
  });
}
