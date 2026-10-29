import { apiClient, getApiBaseUrl, getStoredToken } from "./client";
import type {
  ClinicalDecisionIn,
  ClinicalDecisionOut,
  ScanOut,
  ScanReviewOut,
  VerificationIn,
  VerificationOut,
} from "../types/api";

export async function uploadScan(
  file: File,
  formIdentifier: string,
  formVersion: string
): Promise<ScanOut> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("form_identifier", formIdentifier);
  formData.append("form_version", formVersion);

  return apiClient<ScanOut>("/api/v1/scans", {
    method: "POST",
    body: formData,
  });
}

export async function getScan(scanId: string): Promise<ScanOut> {
  return apiClient<ScanOut>(`/api/v1/scans/${scanId}`, {
    method: "GET",
  });
}

export async function processScan(scanId: string): Promise<ScanOut> {
  return apiClient<ScanOut>(`/api/v1/scans/${scanId}/process`, {
    method: "POST",
  });
}

export async function getScanReview(scanId: string): Promise<ScanReviewOut> {
  return apiClient<ScanReviewOut>(`/api/v1/scans/${scanId}/review`, {
    method: "GET",
  });
}

export async function fetchScanImageBlob(scanId: string): Promise<Blob> {
  const baseUrl = getApiBaseUrl();
  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(`${baseUrl}/api/v1/scans/${scanId}/image`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to load scan image: ${response.status}`);
  }
  return response.blob();
}

export async function recordDecision(
  scanId: string,
  data: ClinicalDecisionIn
): Promise<ClinicalDecisionOut & { scan_id: string; decision_id: string }> {
  return apiClient<ClinicalDecisionOut & { scan_id: string; decision_id: string }>(
    `/api/v1/scans/${scanId}/decision`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function verifyScan(
  scanId: string,
  data: VerificationIn
): Promise<VerificationOut> {
  return apiClient<VerificationOut>(`/api/v1/scans/${scanId}/verification`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
