import { apiClient } from "./client";
import type { EncounterCreate, EncounterOut } from "../types/api";

export async function createEncounter(data: EncounterCreate): Promise<EncounterOut> {
  return apiClient<EncounterOut>("/api/v1/encounters", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function lookupEncounter(externalEncounterIdentifier: string): Promise<EncounterOut> {
  return apiClient<EncounterOut>("/api/v1/encounters", {
    method: "GET",
    params: { external_encounter_identifier: externalEncounterIdentifier },
  });
}
