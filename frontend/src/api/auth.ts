import { apiClient } from "./client";
import type {
  DevTokenRequest,
  DevTokenResponse,
  MeOut,
  UserCreate,
  UserOut,
  UserPatch,
} from "../types/api";

export async function loginWithDevToken(username: string): Promise<DevTokenResponse> {
  return apiClient<DevTokenResponse>("/api/v1/dev/token", {
    method: "POST",
    body: JSON.stringify({ username } as DevTokenRequest),
    skipAuth: true,
  });
}

export async function getMe(): Promise<MeOut> {
  return apiClient<MeOut>("/api/v1/me", {
    method: "GET",
  });
}

export async function listUsers(): Promise<UserOut[]> {
  return apiClient<UserOut[]>("/api/v1/users", {
    method: "GET",
  });
}

export async function createUser(data: UserCreate): Promise<UserOut> {
  return apiClient<UserOut>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUser(userId: string, data: UserPatch): Promise<UserOut> {
  return apiClient<UserOut>(`/api/v1/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
