import { apiClient } from "./client";
import type {
  AuditEventOut,
  PaginatedResponse,
  PolicyApproveIn,
  PolicyCreate,
  PolicyOut,
} from "../types/api";

export async function listPolicies(
  limit: number = 50,
  offset: number = 0
): Promise<PaginatedResponse<PolicyOut>> {
  return apiClient<PaginatedResponse<PolicyOut>>("/api/v1/policies", {
    method: "GET",
    params: { limit, offset },
  });
}

export async function createPolicy(data: PolicyCreate): Promise<PolicyOut> {
  return apiClient<PolicyOut>("/api/v1/policies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approvePolicy(
  policyId: string,
  data: PolicyApproveIn
): Promise<PolicyOut> {
  return apiClient<PolicyOut>(`/api/v1/policies/${policyId}/approve`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function activatePolicy(policyId: string): Promise<PolicyOut> {
  return apiClient<PolicyOut>(`/api/v1/policies/${policyId}/activate`, {
    method: "POST",
  });
}

export interface ListAuditEventsParams {
  entity_type?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export async function listAuditEvents(
  params: ListAuditEventsParams = {}
): Promise<PaginatedResponse<AuditEventOut>> {
  return apiClient<PaginatedResponse<AuditEventOut>>("/api/v1/audit-events", {
    method: "GET",
    params: {
      entity_type: params.entity_type,
      action: params.action,
      since: params.since,
      until: params.until,
      limit: params.limit,
      offset: params.offset,
    },
  });
}
