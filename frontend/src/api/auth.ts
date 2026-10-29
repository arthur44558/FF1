import { apiClient } from "./client";
import type {
  DevTokenRequest,
  DevTokenResponse,
  LoginRequest,
  LoginResponse,
  MeOut,
  RegistrationRequestIn,
  RegistrationRequestOut,
  UserCreate,
  UserOut,
  UserPatch,
} from "../types/api";

export async function loginWithUniqueId(unique_id: string, password: string): Promise<LoginResponse> {
  return apiClient<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ unique_id, password } as LoginRequest),
    skipAuth: true,
  });
}

export async function requestRegistration(
  data: RegistrationRequestIn
): Promise<{ id: string; status: string; message: string }> {
  return apiClient<{ id: string; status: string; message: string }>("/api/v1/auth/register-request", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuth: true,
  });
}

export async function listRegistrationRequests(): Promise<RegistrationRequestOut[]> {
  return apiClient<RegistrationRequestOut[]>("/api/v1/admin/registration-requests", {
    method: "GET",
  });
}

export async function approveRegistrationRequest(requestId: string): Promise<UserOut> {
  return apiClient<UserOut>(`/api/v1/admin/registration-requests/${requestId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function rejectRegistrationRequest(
  requestId: string,
  reason: string
): Promise<{ status: string; message: string }> {
  return apiClient<{ status: string; message: string }>(
    `/api/v1/admin/registration-requests/${requestId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    }
  );
}

export async function revokeUserAccess(userId: string): Promise<UserOut> {
  return apiClient<UserOut>(`/api/v1/users/${userId}/revoke`, {
    method: "POST",
  });
}

export async function restoreUserAccess(userId: string): Promise<UserOut> {
  return apiClient<UserOut>(`/api/v1/users/${userId}/restore`, {
    method: "POST",
  });
}

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
