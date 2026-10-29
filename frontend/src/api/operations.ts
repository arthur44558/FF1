import { apiClient } from "./client";
import type { OperationsSummary } from "../types/api";

export async function getOperationsSummary(): Promise<OperationsSummary> {
  return apiClient<OperationsSummary>("/api/v1/operations/summary", {
    method: "GET",
  });
}

export async function checkHealthLive(): Promise<{ status: string }> {
  return apiClient<{ status: string }>("/health/live", {
    method: "GET",
    skipAuth: true,
  });
}

export async function checkHealthReady(): Promise<{ status: string }> {
  return apiClient<{ status: string }>("/health/ready", {
    method: "GET",
    skipAuth: true,
  });
}
