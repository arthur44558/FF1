import { apiClient } from "./client";
import type {
  CancelIn,
  CompleteIn,
  ContactResolveIn,
  FollowupAmendmentIn,
  FollowupDetail,
  FollowupOut,
  PaginatedResponse,
  RescheduleIn,
  SupersedeIn,
} from "../types/api";

export interface ListFollowupsParams {
  status?: string;
  severity?: string;
  responsible_doctor?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  overdue?: boolean;
  limit?: number;
  offset?: number;
}

export async function listFollowups(
  params: ListFollowupsParams = {}
): Promise<PaginatedResponse<FollowupOut>> {
  return apiClient<PaginatedResponse<FollowupOut>>("/api/v1/followups", {
    method: "GET",
    params: {
      status: params.status,
      severity: params.severity,
      responsible_doctor: params.responsible_doctor,
      scheduled_from: params.scheduled_from,
      scheduled_to: params.scheduled_to,
      overdue: params.overdue,
      limit: params.limit,
      offset: params.offset,
    },
  });
}

export async function getFollowup(followupId: string): Promise<FollowupDetail> {
  return apiClient<FollowupDetail>(`/api/v1/followups/${followupId}`, {
    method: "GET",
  });
}

export async function amendFollowup(
  followupId: string,
  data: FollowupAmendmentIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/amendments`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}

export async function rescheduleFollowup(
  followupId: string,
  data: RescheduleIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/reschedule`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}

export async function completeFollowup(
  followupId: string,
  data: CompleteIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/complete`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}

export async function cancelFollowup(
  followupId: string,
  data: CancelIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/cancel`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}

export async function resolveFollowupContact(
  followupId: string,
  data: ContactResolveIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/resolve-contact`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}

export async function supersedeFollowup(
  followupId: string,
  data: SupersedeIn,
  idempotencyKey?: string
): Promise<FollowupOut> {
  return apiClient<FollowupOut>(`/api/v1/followups/${followupId}/supersede`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    body: JSON.stringify(data),
  });
}
