import { apiClient } from "./client";
import type { PatientCreate, PatientOut } from "../types/api";

export async function createPatient(data: PatientCreate): Promise<PatientOut> {
  return apiClient<PatientOut>("/api/v1/patients", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function lookupPatient(hospitalPatientIdentifier: string): Promise<PatientOut> {
  return apiClient<PatientOut>("/api/v1/patients", {
    method: "GET",
    params: { hospital_patient_identifier: hospitalPatientIdentifier },
  });
}

export async function getPatient(patientId: string): Promise<PatientOut> {
  return apiClient<PatientOut>(`/api/v1/patients/${patientId}`, {
    method: "GET",
  });
}
