import { apiClient } from "./client";
import type {
  CallOutcomeIn,
  PaginatedResponse,
  ReminderDetail,
  ReminderOut,
  RetryReviewIn,
} from "../types/api";

export interface ReminderQueueParams {
  status?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  limit?: number;
  offset?: number;
}

export async function getReminderQueue(
  params: ReminderQueueParams = {}
): Promise<PaginatedResponse<ReminderOut>> {
  return apiClient<PaginatedResponse<ReminderOut>>("/api/v1/reminders/queue", {
    method: "GET",
    params: {
      status: params.status,
      scheduled_from: params.scheduled_from,
      scheduled_to: params.scheduled_to,
      limit: params.limit,
      offset: params.offset,
    },
  });
}

export async function getReminder(jobId: string): Promise<ReminderDetail> {
  return apiClient<ReminderDetail>(`/api/v1/reminders/${jobId}`, {
    method: "GET",
  });
}

export async function recordCallOutcome(
  jobId: string,
  data: CallOutcomeIn
): Promise<{ status: string; job_id: string; outcome: string }> {
  return apiClient<{ status: string; job_id: string; outcome: string }>(
    `/api/v1/reminders/${jobId}/call-outcomes`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function submitRetryReview(
  jobId: string,
  data: RetryReviewIn
): Promise<{ status: string; job_id: string; decision: string }> {
  return apiClient<{ status: string; job_id: string; decision: string }>(
    `/api/v1/reminders/${jobId}/retry-review`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}
