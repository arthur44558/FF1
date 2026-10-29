import React, { useState, useCallback } from "react";
import {
  Users,
  Search,
  Plus,
  Phone,
  Eye,
  UserPlus,
  FilePlus,
} from "lucide-react";
import { createPatient, lookupPatient } from "../api/patients";
import { createEncounter, lookupEncounter } from "../api/encounters";
import {
  listContacts,
  createContact,
  revealContact,
  setPreference,
  optOutContact,
} from "../api/contacts";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import type {
  Channel,
  ContactCreate,
  ContactOut,
  EncounterCreate,
  EncounterOut,
  PatientCreate,
  PatientOut,
  PreferenceIn,
  PreferenceStatus,
} from "../types/api";

export const PatientsScreen: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  // Search state
  const [searchInput, setSearchInput] = useState("TEST-PATIENT-001");
  const [patient, setPatient] = useState<PatientOut | null>(null);
  const [contacts, setContacts] = useState<ContactOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  // Encounter state
  const [encounterSearch, setEncounterSearch] = useState("TEST-ENCOUNTER-001");
  const [foundEncounter, setFoundEncounter] = useState<EncounterOut | null>(null);
  const [encounterLoading, setEncounterLoading] = useState(false);

  // Create Patient Modal
  const [showCreatePatient, setShowCreatePatient] = useState(false);
  const [newPatientId, setNewPatientId] = useState("");
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientDob, setNewPatientDob] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Create Encounter Modal
  const [showCreateEncounter, setShowCreateEncounter] = useState(false);
  const [newEncounterId, setNewEncounterId] = useState("");
  const [newClinicianId, setNewClinicianId] = useState(user?.role === "doctor" ? user.id : "");
  const [newEncounterAt, setNewEncounterAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [creatingEncounter, setCreatingEncounter] = useState(false);

  // Add Contact Modal
  const [showAddContact, setShowAddContact] = useState(false);
  const [newChannel, setNewChannel] = useState<Channel>("sms");
  const [newDestination, setNewDestination] = useState("+919876543210");
  const [newIsShared, setNewIsShared] = useState(false);
  const [newSharingSource, setNewSharingSource] = useState("Patient direct declaration at registration");
  const [newVerified, setNewVerified] = useState(true);
  const [newVerificationSource, setNewVerificationSource] = useState("In-clinic identity & phone verification");
  const [creatingContact, setCreatingContact] = useState(false);

  // Reveal Contact Modal
  const [revealContactId, setRevealContactId] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState("Direct clinical outreach regarding missed visit");
  const [revealedNumber, setRevealedNumber] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  // Set Preference Modal
  const [prefContactId, setPrefContactId] = useState<string | null>(null);
  const [prefStatus, setPrefStatus] = useState<PreferenceStatus>("opted_in");
  const [prefEvidenceType, setPrefEvidenceType] = useState("signed_consent_form");
  const [prefEvidenceRef, setPrefEvidenceRef] = useState("REF-CONSENT-001");
  const [settingPref, setSettingPref] = useState(false);

  // Opt-out Modal
  const [optOutContactId, setOptOutContactId] = useState<string | null>(null);
  const [optOutReason, setOptOutReason] = useState("Patient requested cessation of SMS alerts");
  const [optingOut, setOptingOut] = useState(false);

  const loadPatientData = useCallback(async (identifier: string) => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);
    setRevealedNumber(null);
    try {
      const p = await lookupPatient(identifier.trim());
      setPatient(p);
      const contactList = await listContacts(p.id);
      setContacts(contactList);
    } catch (err: any) {
      setPatient(null);
      setContacts([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookupEncounter = async () => {
    if (!encounterSearch.trim()) return;
    setEncounterLoading(true);
    try {
      const enc = await lookupEncounter(encounterSearch.trim());
      setFoundEncounter(enc);
    } catch (err: any) {
      setFoundEncounter(null);
      addToast("info", "Encounter identifier not found.", "Lookup Result");
    } finally {
      setEncounterLoading(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingPatient(true);
    try {
      const payload: PatientCreate = {
        hospital_patient_identifier: newPatientId.trim(),
        display_name: newPatientName.trim() || null,
        date_of_birth: newPatientDob || null,
      };
      const created = await createPatient(payload);
      addToast("success", `Patient created: ${created.hospital_patient_identifier}`, "Success");
      setShowCreatePatient(false);
      setSearchInput(created.hospital_patient_identifier);
      await loadPatientData(created.hospital_patient_identifier);
    } catch (err: any) {
      addToast("error", err.message || "Failed to create patient");
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleCreateEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setCreatingEncounter(true);
    try {
      const payload: EncounterCreate = {
        patient_id: patient.id,
        external_encounter_identifier: newEncounterId.trim(),
        clinician_user_id: newClinicianId.trim(),
        encounter_at: new Date(newEncounterAt).toISOString(),
      };
      const created = await createEncounter(payload);
      addToast("success", `Encounter created: ${created.external_encounter_identifier}`, "Success");
      setShowCreateEncounter(false);
      setEncounterSearch(created.external_encounter_identifier);
      setFoundEncounter(created);
    } catch (err: any) {
      addToast("error", err.message || "Failed to create encounter");
    } finally {
      setCreatingEncounter(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setCreatingContact(true);
    try {
      const payload: ContactCreate = {
        channel: newChannel,
        destination: newDestination.trim(),
        is_shared: newIsShared,
        sharing_status_source: newSharingSource.trim() || "Clinical intake verification",
        verified: newVerified,
        verification_source: newVerified
          ? newVerificationSource.trim() || "In-person phone check"
          : null,
      };
      await createContact(patient.id, payload);
      addToast("success", "Contact created and registered.", "Contact Saved");
      setShowAddContact(false);
      const list = await listContacts(patient.id);
      setContacts(list);
    } catch (err: any) {
      addToast("error", err.message || "Failed to register contact");
    } finally {
      setCreatingContact(false);
    }
  };

  const handleRevealContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealContactId) return;
    setRevealing(true);
    try {
      const res = await revealContact(revealContactId, { reason: revealReason });
      setRevealedNumber(res.destination);
      addToast("info", "Phone number revealed. Audit record created.", "Contact Revealed");
    } catch (err: any) {
      addToast("error", err.message || "Reveal authorization rejected");
    } finally {
      setRevealing(false);
    }
  };

  const handleSetPreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefContactId) return;
    setSettingPref(true);
    try {
      const payload: PreferenceIn = {
        channel: "sms",
        purpose: "appointment_reminder",
        permission_status: prefStatus,
        evidence_type: prefStatus === "opted_in" ? prefEvidenceType : null,
        evidence_reference: prefStatus === "opted_in" ? prefEvidenceRef : null,
      };
      await setPreference(prefContactId, payload);
      addToast("success", "Communication preference updated.", "Preference Saved");
      setPrefContactId(null);
      if (patient) {
        const list = await listContacts(patient.id);
        setContacts(list);
      }
    } catch (err: any) {
      addToast("error", err.message || "Failed to update preference");
    } finally {
      setSettingPref(false);
    }
  };

  const handleOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optOutContactId) return;
    setOptingOut(true);
    try {
      await optOutContact(optOutContactId, {
        channel: "sms",
        purpose: "appointment_reminder",
        reason: optOutReason,
      });
      addToast("warning", "Contact opted-out. All pending reminders suppressed.", "Opt-Out Recorded");
      setOptOutContactId(null);
      if (patient) {
        const list = await listContacts(patient.id);
        setContacts(list);
      }
    } catch (err: any) {
      addToast("error", err.message || "Failed to record opt-out");
    } finally {
      setOptingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Patients &amp; Contact Governance</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Verified patient identities, clinical encounters, and privacy-preserving contact preferences. Unmasked phone numbers are protected behind audit-recorded reveal gates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission("patient:manage") && (
            <button
              type="button"
              onClick={() => setShowCreatePatient(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0c4b80] px-4 py-2 text-xs font-bold text-white hover:bg-[#08355c] transition"
            >
              <UserPlus className="size-3.5" />
              <span>Create Patient</span>
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner error={error} />}

      {/* Patient Search Bar */}
      <div className="rounded-2xl border border-[#d8e0e7] bg-white p-4 shadow-xs">
        <label className="text-xs font-bold text-[#45627f] block mb-1.5">
          Lookup Hospital Patient by Identifier
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="size-4 text-[#788ca0] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. TEST-PATIENT-001"
              className="w-full rounded-xl border border-[#d8e0e7] pl-9 pr-3.5 py-1.5 text-xs text-[#17212b] focus:border-[#0c4b80] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => loadPatientData(searchInput)}
            disabled={loading}
            className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] transition disabled:opacity-50"
          >
            {loading ? "Searching..." : "Lookup Patient"}
          </button>
        </div>
      </div>

      {/* Patient Details & Contacts Section */}
      {patient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Card */}
          <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[#0c4b80]" />
                <h3 className="text-sm font-bold text-[#183d63]">Patient Record</h3>
              </div>
              <Badge variant="completed" size="sm">
                {patient.identity_status}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#788ca0] block">Hospital Identifier:</span>
                <span className="font-mono font-bold text-[#183d63]">
                  {patient.hospital_patient_identifier}
                </span>
              </div>
              <div>
                <span className="text-[#788ca0] block">Display Name:</span>
                <span className="font-semibold text-[#183d63]">
                  {patient.display_name || "Not recorded"}
                </span>
              </div>
              <div>
                <span className="text-[#788ca0] block">Date of Birth:</span>
                <span className="text-[#516d89]">{patient.date_of_birth || "N/A"}</span>
              </div>
              <div>
                <span className="text-[#788ca0] block">Patient UUID:</span>
                <span className="font-mono text-[10px] text-[#516d89]">{patient.id}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#eaf0f6]">
              {hasPermission("patient:manage") && (
                <button
                  type="button"
                  onClick={() => setShowCreateEncounter(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-full border border-[#0c4b80] bg-white py-2 text-xs font-semibold text-[#0c4b80] hover:bg-[#edf5fb] transition"
                >
                  <FilePlus className="size-3.5" />
                  <span>Register Encounter for Patient</span>
                </button>
              )}
            </div>
          </div>

          {/* Contacts Section */}
          <div className="lg:col-span-2 rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
              <div className="flex items-center gap-2">
                <Phone className="size-4 text-[#0c4b80]" />
                <h3 className="text-sm font-bold text-[#183d63]">
                  Patient Contact Channels ({contacts.length})
                </h3>
              </div>
              {hasPermission("contact:manage") && (
                <button
                  type="button"
                  onClick={() => setShowAddContact(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#0c4b80] px-3.5 py-1 text-xs font-bold text-white hover:bg-[#08355c] transition"
                >
                  <Plus className="size-3" />
                  <span>Add Contact</span>
                </button>
              )}
            </div>

            {contacts.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#788ca0]">
                No contact channels registered. Add a verified telephone number to resolve reminder gates.
              </p>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => {
                  const pref = c.preferences?.[0];
                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-[#e2ebf3] bg-[#fafcff] space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" size="sm">
                            {c.channel.toUpperCase()}
                          </Badge>
                          <span className="font-mono font-bold text-[#183d63]">
                            {c.masked_destination}
                          </span>
                          {c.is_shared && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                              Shared Device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.verified_at ? "completed" : "moderate"} size="sm">
                            {c.verified_at ? "Verified" : "Unverified"}
                          </Badge>
                          <Badge
                            variant={
                              pref?.permission_status === "opted_in"
                                ? "completed"
                                : pref?.permission_status === "opted_out"
                                ? "severe"
                                : "default"
                            }
                            size="sm"
                          >
                            {pref?.permission_status || "unknown"}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-[11px] text-[#788ca0] flex flex-wrap gap-x-4 gap-y-1">
                        <span>Source: {c.sharing_status_source || "None"}</span>
                        {pref?.evidence_reference && (
                          <span>Consent: {pref.evidence_reference}</span>
                        )}
                      </div>

                      {/* Contact Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#edf4fa]">
                        {hasPermission("contact:reveal") && (
                          <button
                            type="button"
                            onClick={() => {
                              setRevealContactId(c.id);
                              setRevealedNumber(null);
                            }}
                            className="rounded-lg border border-[#b7d3e6] px-2.5 py-1 text-[11px] font-semibold text-[#0c4b80] hover:bg-[#eaf4fb] transition"
                          >
                            Reveal (Audited)
                          </button>
                        )}

                        {hasPermission("contact:manage_preferences") && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPrefContactId(c.id)}
                              className="rounded-lg border border-[#d8e0e7] px-2.5 py-1 text-[11px] font-semibold text-[#516d89] hover:bg-[#edf5fb] transition"
                            >
                              Set Consent
                            </button>
                            <button
                              type="button"
                              onClick={() => setOptOutContactId(c.id)}
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 transition"
                            >
                              Record Opt-Out
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Encounter Lookup Section */}
      <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-[#183d63]">Clinical Encounter Verification</h3>
        <p className="text-xs text-[#667c91]">
          Verify patient visits before scan verification. Every follow-up order requires an approved clinical encounter.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={encounterSearch}
            onChange={(e) => setEncounterSearch(e.target.value)}
            placeholder="Encounter identifier, e.g. TEST-ENCOUNTER-001"
            className="flex-1 rounded-xl border border-[#d8e0e7] px-3.5 py-1.5 text-xs text-[#17212b]"
          />
          <button
            type="button"
            onClick={handleLookupEncounter}
            disabled={encounterLoading}
            className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] transition disabled:opacity-50"
          >
            {encounterLoading ? "Checking..." : "Verify Encounter"}
          </button>
        </div>

        {foundEncounter && (
          <div className="mt-3 p-3.5 rounded-xl bg-[#edf5fb] border border-[#bae6fd] text-xs space-y-1">
            <div className="flex justify-between font-bold text-[#183d63]">
              <span>Encounter: {foundEncounter.external_encounter_identifier}</span>
              <Badge variant="completed" size="sm">
                Encounter Matched
              </Badge>
            </div>
            <p className="text-[#516d89]">Patient ID: {foundEncounter.patient_id}</p>
            <p className="text-[#516d89]">
              Encounter Date: {new Date(foundEncounter.encounter_at).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Create Patient Modal */}
      {showCreatePatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Create Patient Identity</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Register a verified patient record in the facility index.
            </p>

            <form onSubmit={handleCreatePatient} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Hospital Patient Identifier
                </label>
                <input
                  type="text"
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  required
                  placeholder="e.g. PATIENT-7890"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="e.g. Synthetic Test Record"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Date of Birth (optional)
                </label>
                <input
                  type="date"
                  value={newPatientDob}
                  onChange={(e) => setNewPatientDob(e.target.value)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreatePatient(false)}
                  disabled={creatingPatient}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPatient}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {creatingPatient ? "Creating..." : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Encounter Modal */}
      {showCreateEncounter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Register Clinical Encounter</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Links a doctor consultation or visit to patient: {patient?.hospital_patient_identifier}
            </p>

            <form onSubmit={handleCreateEncounter} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  External Encounter Identifier
                </label>
                <input
                  type="text"
                  value={newEncounterId}
                  onChange={(e) => setNewEncounterId(e.target.value)}
                  required
                  placeholder="e.g. ENC-9012"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Clinician User UUID (Doctor)
                </label>
                <input
                  type="text"
                  value={newClinicianId}
                  onChange={(e) => setNewClinicianId(e.target.value)}
                  required
                  placeholder="UUID of active clinic doctor"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Encounter Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={newEncounterAt}
                  onChange={(e) => setNewEncounterAt(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateEncounter(false)}
                  disabled={creatingEncounter}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingEncounter}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {creatingEncounter ? "Registering..." : "Save Encounter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Register Contact Destination</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Stored securely with encrypted destination &amp; HMAC duplicate detection.
            </p>

            <form onSubmit={handleAddContact} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Channel
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value as Channel)}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  >
                    <option value="sms">SMS</option>
                    <option value="voice">Voice</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Phone Destination
                  </label>
                  <input
                    type="text"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    required
                    placeholder="+91..."
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shared-dev"
                  checked={newIsShared}
                  onChange={(e) => setNewIsShared(e.target.checked)}
                  className="size-4 rounded text-[#0c4b80] focus:ring-[#0c4b80]"
                />
                <label htmlFor="shared-dev" className="text-xs font-bold text-[#183d63]">
                  Shared device / Family member phone
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Sharing Evidence Source
                </label>
                <input
                  type="text"
                  value={newSharingSource}
                  onChange={(e) => setNewSharingSource(e.target.value)}
                  required
                  placeholder="Record how shared status was established"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ver-contact"
                  checked={newVerified}
                  onChange={(e) => setNewVerified(e.target.checked)}
                  className="size-4 rounded text-[#0c4b80] focus:ring-[#0c4b80]"
                />
                <label htmlFor="ver-contact" className="text-xs font-bold text-[#183d63]">
                  Verified contact identity
                </label>
              </div>

              {newVerified && (
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Verification Source
                  </label>
                  <input
                    type="text"
                    value={newVerificationSource}
                    onChange={(e) => setNewVerificationSource(e.target.value)}
                    required
                    placeholder="Record how the contact was verified"
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>
              )}

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  disabled={creatingContact}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingContact}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {creatingContact ? "Saving..." : "Register Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reveal Contact Modal */}
      {revealContactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#eaf0f6]">
              <Eye className="size-4 text-[#0c4b80]" />
              <h3 className="text-sm font-bold text-[#183d63]">Audited Contact Reveal</h3>
            </div>
            <p className="text-xs text-[#667c91] mt-2 mb-3">
              Unmasking contact destinations requires an authorized reason and is permanently recorded in the immutable audit log.
            </p>

            {revealedNumber ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center my-3">
                <p className="text-xs text-emerald-800">Unmasked Destination:</p>
                <p className="font-mono text-lg font-bold text-emerald-950 mt-1">
                  {revealedNumber}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRevealContactId(null);
                    setRevealedNumber(null);
                  }}
                  className="mt-4 rounded-full bg-emerald-800 px-5 py-1.5 text-xs font-bold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRevealContact} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Justification for Reveal
                  </label>
                  <input
                    type="text"
                    value={revealReason}
                    onChange={(e) => setRevealReason(e.target.value)}
                    required
                    minLength={3}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRevealContactId(null)}
                    disabled={revealing}
                    className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={revealing}
                    className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                  >
                    {revealing ? "Verifying..." : "Authorize Reveal"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Set Preference Modal */}
      {prefContactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Communication Preference</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Set opt-in consent evidence for appointment reminders.
            </p>

            <form onSubmit={handleSetPreference} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Permission Status
                </label>
                <select
                  value={prefStatus}
                  onChange={(e) => setPrefStatus(e.target.value as PreferenceStatus)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                >
                  <option value="opted_in">Opted In (Patient Agreed)</option>
                  <option value="opted_out">Opted Out (Withdrawn)</option>
                  <option value="not_permitted">Not Permitted</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              {prefStatus === "opted_in" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Evidence Type
                    </label>
                    <input
                      type="text"
                      value={prefEvidenceType}
                      onChange={(e) => setPrefEvidenceType(e.target.value)}
                      required
                      placeholder="e.g. signed_consent_form"
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Evidence Reference
                    </label>
                    <input
                      type="text"
                      value={prefEvidenceRef}
                      onChange={(e) => setPrefEvidenceRef(e.target.value)}
                      required
                      placeholder="e.g. DOC-CONSENT-2026-001"
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                </>
              )}

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPrefContactId(null)}
                  disabled={settingPref}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settingPref}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {settingPref ? "Saving..." : "Update Preference"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Opt Out Modal */}
      {optOutContactId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-red-600 mb-1">Record Patient Opt-Out</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Immediately suppresses all scheduled reminder messages for this channel.
            </p>

            <form onSubmit={handleOptOut} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Opt-Out Reason
                </label>
                <input
                  type="text"
                  value={optOutReason}
                  onChange={(e) => setOptOutReason(e.target.value)}
                  required
                  minLength={3}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setOptOutContactId(null)}
                  disabled={optingOut}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={optingOut}
                  className="rounded-full bg-red-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {optingOut ? "Recording..." : "Confirm Opt-Out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
