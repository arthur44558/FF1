import type { ApiErrorDetail, ApiErrorResponse } from "../types/api";

const TOKEN_KEY = "caretrack_access_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail: ApiErrorDetail | string;
  errors?: Array<{ location: string[]; code: string; message: string }>;

  constructor(status: number, message: string, detail: ApiErrorDetail | string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    if (typeof detail === "object" && detail !== null) {
      this.code = detail.code || `HTTP_${status}`;
      this.errors = detail.errors;
    } else {
      this.code = `HTTP_${status}`;
    }
  }
}

let onAuthFailureCallback: (() => void) | null = null;

export function registerAuthFailureHandler(cb: () => void) {
  onAuthFailureCallback = cb;
}

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  // Default to relative if empty (uses Vite dev server proxy)
  return "";
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.append(key, String(val));
      }
    }
    const query = searchParams.toString();
    if (query) {
      url += (url.includes("?") ? "&" : "?") + query;
    }
  }

  const headers = new Headers(options.headers || {});

  if (!options.skipAuth) {
    const token = getStoredToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // If body is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err: any) {
    throw new ApiError(
      0,
      `Network connection failed. Backend service may be unreachable.`,
      { code: "network_error", message: err.message || "Failed to fetch" }
    );
  }

  if (response.status === 401) {
    setStoredToken(null);
    if (onAuthFailureCallback) {
      onAuthFailureCallback();
    }
  }

  if (!response.ok) {
    let errorDetail: ApiErrorDetail | string = "An unknown error occurred";
    let errorMessage = `Request failed with status ${response.status}`;

    try {
      const errorJson = (await response.json()) as ApiErrorResponse;
      if (errorJson && errorJson.detail) {
        errorDetail = errorJson.detail;
        if (typeof errorDetail === "string") {
          errorMessage = errorDetail;
        } else if (errorDetail.message) {
          errorMessage = errorDetail.message;
        } else if (errorDetail.code) {
          errorMessage = `Error code: ${errorDetail.code}`;
        }
      }
    } catch {
      // response wasn't JSON
      try {
        const text = await response.text();
        if (text) errorMessage = text.slice(0, 300);
      } catch {
        // ignore
      }
    }

    throw new ApiError(response.status, errorMessage, errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
