import React, { useState } from "react";
import {
  Check,
  CheckCircle2,
  CircleUserRound,
  HeartPulse,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  X,
  Copy,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { createPatient, lookupPatient } from "../api/patients";
import { createContact } from "../api/contacts";
import type { PatientOut } from "../types/api";

interface PatientRecordItem {
  id: string; // Patient UUID from backend
  hospitalPatientIdentifier: string;
  fullName: string;
  dob: string;
  age: number;
  gender: string;
  personalPhone: string;
  sharedPhone?: string;
  relationship?: string;
  email?: string;
  address?: string;
  isPhoneVerified: boolean;
  createdAt: string;
}

function calculateAge(dobString: string): number {
  if (!dobString) return 0;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

function cleanIntlPhone(raw: string): string {
  const digitsOnly = raw.trim().replace(/[\s().-]/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.startsWith("+")) return digitsOnly;
  if (digitsOnly.length === 10) return `+91${digitsOnly}`;
  return `+${digitsOnly}`;
}

const INITIAL_SEEDED_PATIENTS: PatientRecordItem[] = [
  {
    id: "seed-pt-20496",
    hospitalPatientIdentifier: "PT-20496",
    fullName: "Elena Marlowe",
    dob: "1984-04-16",
    age: calculateAge("1984-04-16"),
    gender: "Female",
    personalPhone: "+1 (617) 555-0142",
    sharedPhone: "+1 (617) 555-0188",
    relationship: "Spouse / partner",
    email: "elena.marlowe@caretrack.health",
    address: "184 Willow Street, Boston, MA",
    isPhoneVerified: true,
    createdAt: "2026-10-21T09:15:00.000Z",
  },
  {
    id: "seed-pt-31842",
    hospitalPatientIdentifier: "PT-31842",
    fullName: "Marcus Chen",
    dob: "1977-09-02",
    age: calculateAge("1977-09-02"),
    gender: "Male",
    personalPhone: "+1 (617) 555-0195",
    email: "marcus.chen@caretrack.health",
    address: "26 Harrison Avenue, Boston, MA",
    isPhoneVerified: true,
    createdAt: "2026-10-18T14:40:00.000Z",
  },
  {
    id: "seed-pt-58213",
    hospitalPatientIdentifier: "PT-58213",
    fullName: "Priya Shah",
    dob: "1992-01-28",
    age: calculateAge("1992-01-28"),
    gender: "Female",
    personalPhone: "+1 (857) 555-0128",
    sharedPhone: "+1 (857) 555-0103",
    relationship: "Parent",
    email: "priya.shah@caretrack.health",
    address: "58 Beacon Street, Somerville, MA",
    isPhoneVerified: false,
    createdAt: "2026-10-16T11:05:00.000Z",
  },
  {
    id: "seed-pt-74601",
    hospitalPatientIdentifier: "PT-74601",
    fullName: "Jordan Ellis",
    dob: "1969-06-11",
    age: calculateAge("1969-06-11"),
    gender: "Non-binary",
    personalPhone: "+1 (781) 555-0164",
    email: "jordan.ellis@caretrack.health",
    address: "305 Main Street, Cambridge, MA",
    isPhoneVerified: true,
    createdAt: "2026-10-11T08:25:00.000Z",
  },
  {
    id: "seed-pt-49107",
    hospitalPatientIdentifier: "PT-49107",
    fullName: "Avery Thompson",
    dob: "2001-12-04",
    age: calculateAge("2001-12-04"),
    gender: "Other",
    personalPhone: "+1 (339) 555-0171",
    sharedPhone: "+1 (339) 555-0136",
    relationship: "Caregiver",
    email: "avery.thompson@caretrack.health",
    address: "71 Highland Avenue, Brookline, MA",
    isPhoneVerified: false,
    createdAt: "2026-10-07T16:10:00.000Z",
  },
  {
    id: "seed-pt-82539",
    hospitalPatientIdentifier: "PT-82539",
    fullName: "Noah Williams",
    dob: "1958-03-22",
    age: calculateAge("1958-03-22"),
    gender: "Male",
    personalPhone: "+1 (781) 555-0116",
    sharedPhone: "+1 (781) 555-0148",
    relationship: "Child",
    email: "noah.williams@caretrack.health",
    address: "92 Centre Street, Newton, MA",
    isPhoneVerified: true,
    createdAt: "2026-09-29T10:30:00.000Z",
  },
];

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ReceptionDeskScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<PatientRecordItem[]>(INITIAL_SEEDED_PATIENTS);
  const [searchId, setSearchId] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    id: string;
    identifier: string;
    name: string;
  } | null>(null);
  const [notice, setNotice] = useState("");

  // New Patient Form state
  const [formData, setFormData] = useState({
    hospitalPatientIdentifier: "",
    fullName: "",
    dob: "",
    gender: "Female",
    personalPhone: "",
    sharedPhone: "",
    relationship: "Spouse / partner",
    email: "",
    address: "",
    phoneVerified: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [copied, setCopied] = useState(false);

  // Auto-calculated age
  const calculatedAge = calculateAge(formData.dob);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) {
      setSearchError("Please enter a valid Patient Identifier (e.g. PT-2041)");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    try {
      const result: PatientOut = await lookupPatient(searchId.trim());
      // Found! Add to local viewing list if not already present
      const record: PatientRecordItem = {
        id: result.id,
        hospitalPatientIdentifier: result.hospital_patient_identifier,
        fullName: result.display_name || result.hospital_patient_identifier,
        dob: result.date_of_birth || "",
        age: calculateAge(result.date_of_birth || ""),
        gender: "Chart Verified",
        personalPhone: "Direct record verified",
        isPhoneVerified: true,
        createdAt: result.created_at,
      };
      setPatients((prev) => {
        const filtered = prev.filter((p) => p.hospitalPatientIdentifier !== record.hospitalPatientIdentifier);
        return [record, ...filtered];
      });
      setNotice(`Patient record ${result.hospital_patient_identifier} found.`);
    } catch (err: any) {
      setSearchError(
        "No patient record found matching that identifier. Please verify the ID."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.dob) {
      setFormError("Full Name and Date of Birth are mandatory.");
      return;
    }
    if (!formData.personalPhone.trim()) {
      setFormError("Primary contact phone number is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const finalIdentifier =
        formData.hospitalPatientIdentifier.trim() ||
        `PT-${Math.floor(1000 + Math.random() * 8999)}`;

      const primaryPhone = cleanIntlPhone(formData.personalPhone);

      // 1. Authoritative Backend Patient Creation
      const createdPatient = await createPatient({
        hospital_patient_identifier: finalIdentifier,
        display_name: formData.fullName.trim(),
        date_of_birth: formData.dob,
      });

      // 2. Authoritative Primary Contact Creation with mandatory evidence fields
      await createContact(createdPatient.id, {
        channel: "voice",
        destination: primaryPhone,
        is_shared: false,
        sharing_status_source: "patient_direct_declaration",
        verified: formData.phoneVerified,
        verification_source: formData.phoneVerified ? "in_person_reception" : undefined,
      });

      // 3. Optional shared contact with SMS channel & sharing evidence
      if (formData.sharedPhone.trim()) {
        try {
          const sharedPhone = cleanIntlPhone(formData.sharedPhone);
          const sharingSource = `patient_declared_${(formData.relationship || "family")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")}`;

          await createContact(createdPatient.id, {
            channel: "sms",
            destination: sharedPhone,
            is_shared: true,
            sharing_status_source: sharingSource,
            verified: false,
          });
        } catch (secErr) {
          console.warn("Shared contact creation notice:", secErr);
        }
      }

      const newRecord: PatientRecordItem = {
        id: createdPatient.id,
        hospitalPatientIdentifier: createdPatient.hospital_patient_identifier,
        fullName: formData.fullName.trim(),
        dob: formData.dob,
        age: calculatedAge,
        gender: formData.gender,
        personalPhone: primaryPhone,
        sharedPhone: formData.sharedPhone.trim() ? cleanIntlPhone(formData.sharedPhone) : undefined,
        relationship: formData.relationship,
        email: formData.email.trim() || undefined,
        address: formData.address.trim() || undefined,
        isPhoneVerified: formData.phoneVerified,
        createdAt: createdPatient.created_at,
      };

      setPatients((prev) => [newRecord, ...prev]);
      setModalOpen(false);
      setSuccessData({
        id: createdPatient.id,
        identifier: createdPatient.hospital_patient_identifier,
        name: formData.fullName.trim(),
      });

      // Reset form
      setFormData({
        hospitalPatientIdentifier: "",
        fullName: "",
        dob: "",
        gender: "Female",
        personalPhone: "",
        sharedPhone: "",
        relationship: "Spouse / partner",
        email: "",
        address: "",
        phoneVerified: false,
      });
    } catch (err: any) {
      setFormError(
        err.message || "Failed to register patient in hospital database."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c4b80] text-white">
              <HeartPulse className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900">
                  CareTrack
                </span>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  Reception Desk
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Front Office &amp; Secure Patient Intake
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "RCP-302"}
              </span>
              <span className="text-slate-400">|</span>
              <span>{user?.username}</span>
            </div>
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Landing Page
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Notice alert */}
        {notice && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              {notice}
            </span>
            <button onClick={() => setNotice("")}>
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Page Hero Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Patient Registration &amp; Front Desk Directory
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Register incoming patients with verified contacts or retrieve
              active records via strict hospital ID lookup.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#08355c]"
          >
            <Plus className="size-4" />
            <span>New Patient Registration</span>
          </button>
        </div>

        {/* Anti-Enumeration Patient Lookup Bar */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Secure Patient Lookup (Anti-Enumeration Compliant)
          </h2>
          <form onSubmit={handleSearch} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter exact Hospital Patient Identifier (e.g. PT-1001, PT-2041)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={searchLoading}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {searchLoading ? "Searching..." : "Lookup Record"}
            </button>
          </form>
          {searchError && (
            <p className="mt-2.5 text-xs font-medium text-rose-600">
              {searchError}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            Per hospital security standards, unrestricted directory browsing is
            disabled. Direct identifier lookup enforces privacy compliance.
          </p>
        </section>

        {/* Directory / Session Table */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Registered &amp; Active Session Patients
              </h2>
              <p className="text-xs text-slate-500">
                Patients registered or retrieved during this front-desk session.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {patients.length} record{patients.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Patient Details</th>
                  <th className="px-4 py-3.5">Demographics</th>
                  <th className="px-4 py-3.5">Contact Numbers</th>
                  <th className="px-4 py-3.5">Location &amp; Email</th>
                  <th className="px-6 py-3.5 text-right">Registration Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0c4b80]/10 text-xs font-bold text-[#0c4b80]">
                          {initials(patient.fullName)}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {patient.fullName}
                          </div>
                          <div className="font-mono text-[11px] font-medium text-slate-500">
                            {patient.hospitalPatientIdentifier}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {patient.age} yrs · {patient.gender}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        DOB: {formatDate(patient.dob)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Phone className="size-3.5 text-slate-400" />
                        <span>{patient.personalPhone}</span>
                      </div>
                      {patient.sharedPhone && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-medium text-slate-400">
                            Shared:
                          </span>
                          <span>{patient.sharedPhone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="size-3.5 shrink-0 text-slate-400" />
                        <span className="truncate max-w-[200px]">
                          {patient.address || "—"}
                        </span>
                      </div>
                      {patient.email && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="size-3.5 shrink-0 text-slate-400" />
                          <span className="truncate max-w-[200px]">
                            {patient.email}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                      {new Date(patient.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-14 text-center text-sm text-slate-500"
                    >
                      <CircleUserRound className="mx-auto size-8 text-slate-300" />
                      <p className="mt-2 font-medium text-slate-700">
                        No active patients in this session.
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Click "New Patient Registration" or search by ID above.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* New Patient Registration Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  CareTrack Front Office
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  New Patient Registration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="e.g. Eleanor Vance"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Hospital Patient Identifier (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.hospitalPatientIdentifier}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hospitalPatientIdentifier: e.target.value,
                      })
                    }
                    placeholder="Auto-generated if left blank"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              {/* DOB & Auto-Calculated Age */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split("T")[0]}
                    value={formData.dob}
                    onChange={(e) =>
                      setFormData({ ...formData, dob: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Calculated Age
                  </label>
                  <div className="mt-1.5 flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-slate-700">
                    {formData.dob
                      ? calculatedAge === 0
                        ? "< 1 year (Infant)"
                        : `${calculatedAge} year${calculatedAge === 1 ? "" : "s"}`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Sex / Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other / Non-binary</option>
                </select>
              </div>

              {/* Phone & Verification */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Primary Phone Number <span className="text-rose-500">*</span>
                  </label>
                  {formData.phoneVerified && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <Check className="size-3" /> Verified
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="tel"
                    required
                    value={formData.personalPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        personalPhone: e.target.value,
                        phoneVerified: false,
                      })
                    }
                    placeholder="e.g. +91 98765 43210 or 9876543210"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-slate-400"
                  />
                  {!formData.phoneVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.personalPhone.trim()) {
                          setFormData({ ...formData, phoneVerified: true });
                        }
                      }}
                      className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Verify Phone
                    </button>
                  )}
                </div>
              </div>

              {/* Shared / Family Contact */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Shared / Family Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.sharedPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, sharedPhone: e.target.value })
                    }
                    placeholder="e.g. +91 98765 43211 or 9876543211 (Optional)"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Relationship
                  </label>
                  <select
                    value={formData.relationship}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        relationship: e.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    <option value="Spouse / partner">Spouse / partner</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Caregiver">Caregiver</option>
                  </select>
                </div>
              </div>

              {/* Email & Address */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="patient@example.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="123 Hospital Way"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-50"
                >
                  {submitting ? "Saving to Hospital DB..." : "Register Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Registration Success Confirmation Modal */}
      {successData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="size-6 stroke-[3]" />
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Registration Complete
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Patient Added Successfully
            </h3>
            <p className="mt-1.5 text-xs text-slate-500">
              <strong className="text-slate-800">{successData.name}</strong> has
              been registered directly in the authoritative hospital database.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Hospital Patient Identifier
              </span>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-base font-bold text-slate-900">
                  {successData.identifier}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyId(successData.identifier)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copied ? (
                    <CheckCheck className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>{copied ? "Copied" : "Copy ID"}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSuccessData(null)}
              className="mt-6 w-full rounded-xl bg-slate-950 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Done &amp; Return to Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
