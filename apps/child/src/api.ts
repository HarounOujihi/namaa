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
  PlayRoadmap,
  RedeemInviteResponse,
  UpdateChildInput,
  PlayRecommendation,
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

export function getPlayRoadmap(token: string, childId: string): Promise<PlayRoadmap> {
  return request<PlayRoadmap>(`/play/${encodeURIComponent(childId)}/roadmap`, { token });
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

export function getAppSounds(token: string): Promise<AppSoundsMap> {
  return request<AppSoundsMap>("/play/sounds", { token }).then(
    (body: unknown) => (body as { sounds: AppSoundsMap }).sounds,
  );
}

export function getRecommendations(token: string, childId: string): Promise<PlayRecommendation[]> {
  return request<PlayRecommendation[]>(`/play/${encodeURIComponent(childId)}/recommendations`, { token });
}
