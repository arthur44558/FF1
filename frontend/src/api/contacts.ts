import { apiClient } from "./client";
import type {
  ContactCreate,
  ContactOut,
  ContactPatch,
  ContactRevealIn,
  ContactRevealOut,
  OptOutIn,
  PreferenceIn,
  PreferenceOut,
} from "../types/api";

export async function listContacts(patientId: string): Promise<ContactOut[]> {
  return apiClient<ContactOut[]>(`/api/v1/patients/${patientId}/contacts`, {
    method: "GET",
  });
}

export async function createContact(
  patientId: string,
  data: ContactCreate
): Promise<ContactOut> {
  return apiClient<ContactOut>(`/api/v1/patients/${patientId}/contacts`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function revealContact(
  contactId: string,
  data: ContactRevealIn
): Promise<ContactRevealOut> {
  return apiClient<ContactRevealOut>(`/api/v1/contacts/${contactId}/reveal`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateContact(
  contactId: string,
  data: ContactPatch
): Promise<ContactOut> {
  return apiClient<ContactOut>(`/api/v1/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function setPreference(
  contactId: string,
  data: PreferenceIn
): Promise<PreferenceOut> {
  return apiClient<PreferenceOut>(`/api/v1/contacts/${contactId}/preferences`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function optOutContact(
  contactId: string,
  data: OptOutIn
): Promise<PreferenceOut> {
  return apiClient<PreferenceOut>(`/api/v1/contacts/${contactId}/opt-out`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
