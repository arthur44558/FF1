import { useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  LogOut,
  MapPin,
  Search,
  Stethoscope,
  UserCheck,
  Video,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { lookupPatient } from "../api/patients";
import { createEncounter } from "../api/encounters";
import { listFollowups } from "../api/followups";
import type { PatientOut } from "../types/api";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { LiveStatusPill } from "../components/common/LiveStatusPill";

const DOCTORS_BY_SPECIALTY: Record<string, string[]> = {
  Cardiology: ["Dr. Amelia Reed", "Dr. J. Lin", "Dr. S. Okafor"],
  Orthopedics: ["Dr. R. Morgan", "Dr. L. Ahmed", "Dr. C. Bennett"],
  "General Medicine": ["Dr. Maya Patel", "Dr. K. Sharma", "Dr. T. Rivera"],
  Pediatrics: ["Dr. N. Brooks", "Dr. P. Nair", "Dr. E. Foster"],
  Dermatology: ["Dr. I. Laurent", "Dr. D. Kim", "Dr. F. Cole"],
};

interface OnlineConsultRecord {
  id: string;
  name: string;
  age: number;
  gender: string;
  priority: "high" | "moderate" | "low";
  phone: string;
  caretaker?: string;
  relationship?: string;
  doctor: string;
  specialty: string;
  date: string;
  note: string;
  done: boolean;
}

const INITIAL_CONSULT_RECORDS: OnlineConsultRecord[] = [
  {
    id: "PT-20496",
    name: "Ramesh Kumar",
    age: 46,
    gender: "Male",
    priority: "high",
    phone: "+91 98765 43210",
    caretaker: "+91 98765 43211",
    relationship: "Spouse",
    doctor: "Dr. Amelia Reed",
    specialty: "Cardiology",
    date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    note: "Confirm ECG reading & blood pressure assessment prior to call.",
    done: false,
  },
  {
    id: "PT-31842",
    name: "Sunita Devi",
    age: 63,
    gender: "Female",
    priority: "moderate",
    phone: "+91 98111 22334",
    caretaker: "+91 98111 22335",
    relationship: "Child",
    doctor: "Dr. Priya Patel",
    specialty: "Endocrinology",
    date: new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0],
    note: "Review fasting blood sugar logs.",
    done: false,
  },
  {
    id: "PT-58213",
    name: "Mohammad Arif",
    age: 51,
    gender: "Male",
    priority: "high",
    phone: "+91 98222 33445",
    caretaker: "",
    relationship: "",
    doctor: "Dr. Amelia Reed",
    specialty: "Pulmonology",
    date: new Date(Date.now() + 1 * 86400000).toISOString().split("T")[0],
    note: "Post-discharge respiratory checkup.",
    done: false,
  },
  {
    id: "PT-74601",
    name: "Priya Sharma",
    age: 34,
    gender: "Female",
    priority: "low",
    phone: "+91 98333 44556",
    caretaker: "+91 98333 44557",
    relationship: "Sibling",
    doctor: "Dr. R. Morgan",
    specialty: "Orthopedics",
    date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    note: "Routine physical therapy mobility follow-up.",
    done: false,
  },
  {
    id: "PT-49107",
    name: "Rajesh Gupta",
    age: 57,
    gender: "Male",
    priority: "moderate",
    phone: "+91 98444 55667",
    caretaker: "",
    relationship: "",
    doctor: "Dr. Maya Patel",
    specialty: "General Medicine",
    date: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0],
    note: "Medication tolerability assessment.",
    done: true,
  },
];

export function AssistantIntakeScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

  // Top level views: "intake" | "consultancy"
  const [activeTab, setActiveTab] = useState<"intake" | "consultancy">("intake");
  const [showNotifications, setShowNotifications] = useState(false);

  // Stepper state for intake wizard: 1 = Doctor Context, 2 = Patient Verification, 3 = Follow-Up Rules
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [specialty, setSpecialty] = useState("Cardiology");
  const [doctorName, setDoctorName] = useState("Dr. Amelia Reed");
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Step 2: Patient lookup & verification
  const [patientIdInput, setPatientIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchedPatient, setMatchedPatient] = useState<PatientOut | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [verifiedPatientIdentity, setVerifiedPatientIdentity] = useState(false);

  // DECISION TREE BRANCH: Follow-Up Required toggle
  const [followUpRequired, setFollowUpRequired] = useState(true);

  // Step 3: Follow-Up & Notification Strategy (Conditional on followUpRequired === true)
  const [appointmentDate, setAppointmentDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [priority, setPriority] = useState<"high" | "moderate" | "low">("moderate");
  const [consultationMode, setConsultationMode] = useState<"in_person" | "online">("in_person");
  const [doctorRemark, setDoctorRemark] = useState("");

  // Submission state & Receipt modal
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    reference: string;
    patientName: string;
    patientId: string;
    doctorName: string;
    specialty: string;
    appointmentDate: string;
    priority: string;
    consultationMode: string;
    doctorRemark: string;
    followUpRequired: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Online Consultancy Table state
  const [consultRecords, setConsultRecords] = useState<OnlineConsultRecord[]>(INITIAL_CONSULT_RECORDS);
  const [consultSearch, setConsultSearch] = useState("");
  const [consultDateFrom, setConsultDateFrom] = useState("");
  const [consultDateTo, setConsultDateTo] = useState("");
  const [selectedConsult, setSelectedConsult] = useState<OnlineConsultRecord | null>(null);

  const fetchConsultancyData = async () => {
    try {
      const res = await listFollowups({ limit: 50 });
      if (res && res.items && res.items.length > 0) {
        const liveMapped: OnlineConsultRecord[] = res.items.map((fo) => ({
          id: fo.patient_identifier || `PT-${fo.patient_id.slice(0, 5).toUpperCase()}`,
          name: fo.patient_display_name || "Clinical Patient",
          age: 45,
          gender: "Verified Chart",
          priority: (fo.severity?.toLowerCase() as any) || "moderate",
          phone: "+91 98765 43210",
          doctor: "Dr. Amelia Reed",
          specialty: "Cardiology",
          date: fo.scheduled_at ? fo.scheduled_at.split("T")[0] : new Date().toISOString().split("T")[0],
          note: `Follow-up order #${fo.id.slice(0, 8)} (${fo.status})`,
          done: fo.status === "completed",
        }));
        setConsultRecords(liveMapped);
      }
    } catch (e) {
      console.error("Failed to sync consultancy live data", e);
    }
  };

  const { formattedLastUpdated, isRefreshing, refreshNow, refreshError } =
    useLiveRefresh({
      onRefresh: fetchConsultancyData,
      intervalMs: 15000,
      enabled: Boolean(user),
    });

  // Update doctor name when specialty changes
  const handleSpecialtyChange = (spec: string) => {
    setSpecialty(spec);
    const docs = DOCTORS_BY_SPECIALTY[spec] || [];
    setDoctorName(docs[0] || "Dr. Amelia Reed");
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdInput.trim()) {
      setLookupError("Enter a hospital patient identifier (e.g. PT-20496, PT-1001).");
      return;
    }
    setSearching(true);
    setLookupError("");
    setMatchedPatient(null);
    setVerifiedPatientIdentity(false);

    try {
      const p = await lookupPatient(patientIdInput.trim());
      setMatchedPatient(p);
    } catch (err: any) {
      setLookupError(
        "No patient record found matching this identifier. Please verify with reception."
      );
    } finally {
      setSearching(false);
    }
  };

  // Submission logic for both decision tree branches
  const handleSubmitIntake = async (isFollowupBranch: boolean) => {
    if (!matchedPatient) {
      setErrorMsg("A verified patient record is required.");
      return;
    }
    if (!verifiedPatientIdentity) {
      setErrorMsg("Please certify the encounter slip demographics.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const extEncounterId = `ENC-${Date.now().toString().slice(-6)}`;
      // Create encounter on backend
      await createEncounter({
        patient_id: matchedPatient.id,
        external_encounter_identifier: extEncounterId,
        clinician_user_id: user?.role === "doctor" ? user.id : undefined,
        encounter_at: `${sessionDate}T09:00:00Z`,
      });

      const refNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      setReceipt({
        reference: refNumber,
        patientName: matchedPatient.display_name || matchedPatient.hospital_patient_identifier,
        patientId: matchedPatient.hospital_patient_identifier,
        doctorName: doctorName,
        specialty: specialty,
        appointmentDate: isFollowupBranch && followUpRequired ? appointmentDate : "Not Required (Discharged)",
        priority: isFollowupBranch && followUpRequired ? priority.toUpperCase() : "N/A",
        consultationMode: isFollowupBranch && followUpRequired ? (consultationMode === "online" ? "Online Consultation" : "In-Person Visit") : "Discharged",
        doctorRemark: doctorRemark.trim() || "No doctor's remarks provided",
        followUpRequired: isFollowupBranch && followUpRequired,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit assistant intake to backend.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setReceipt(null);
    setStep(1);
    setMatchedPatient(null);
    setPatientIdInput("");
    setVerifiedPatientIdentity(false);
    setDoctorRemark("");
    setFollowUpRequired(true);
    setErrorMsg("");
  };

  // Consultancy row complete handler
  const handleMarkConsultDone = (id: string) => {
    setConsultRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: true } : r))
    );
  };

  const handleUpdateConsultNote = (id: string, note: string) => {
    setConsultRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, note } : r))
    );
  };

  // Filtered consultancy rows
  const filteredConsultRecords = consultRecords.filter((rec) => {
    const q = consultSearch.toLowerCase();
    const matchesSearch =
      !q ||
      rec.name.toLowerCase().includes(q) ||
      rec.id.toLowerCase().includes(q) ||
      rec.phone.includes(q) ||
      rec.doctor.toLowerCase().includes(q) ||
      rec.specialty.toLowerCase().includes(q);

    const matchesFrom = !consultDateFrom || rec.date >= consultDateFrom;
    const matchesTo = !consultDateTo || rec.date <= consultDateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c4b80] text-white">
              <Stethoscope className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900">
                  CareTrack
                </span>
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                  Assistant Verifier
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical Intake &amp; Doctor Context Verification
              </p>
            </div>
          </div>

          {/* Navigation Tabs between Patient Intake and Online Consultancy */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("intake")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "intake"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Patient Intake</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consultancy")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "consultancy"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Video className="size-3.5" />
              <span>Online Consultancy</span>
              <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] font-bold text-sky-800">
                {consultRecords.filter((r) => !r.done).length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <LiveStatusPill
              lastUpdatedText={formattedLastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshNow}
              error={refreshError}
            />

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Bell className="size-4" />
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                  2
                </span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">System Alerts</span>
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="rounded-lg bg-sky-50 p-2.5">
                      <p className="font-semibold text-sky-900">Dr. Amelia Reed Active</p>
                      <p className="text-[11px] text-sky-700">Cardiology consultation batch ready for verification.</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2.5">
                      <p className="font-semibold text-emerald-900">Task Scope Authorized</p>
                      <p className="text-[11px] text-emerald-700">Encounter creation permitted under clinic pilot policy.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "AST-9021"}
              </span>
              <span className="text-slate-400">|</span>
              <span className="max-w-[120px] truncate">{user?.display_name || user?.username}</span>
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

      {/* ========================================================== */}
      {/* VIEW 1: PATIENT INTAKE WIZARD (3-STEP DECISION TREE)        */}
      {/* ========================================================== */}
      {activeTab === "intake" && (
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {/* Stepper Progress Header */}
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-2">
              {[
                { num: 1, title: "Doctor Context", desc: "Clinician & Specialty", status: step > 1 ? "Complete" : step === 1 ? "Current" : "Pending" },
                { num: 2, title: "Patient Verification", desc: "Lookup & Decision Tree", status: step > 2 ? "Complete" : step === 2 ? "Current" : "Next" },
                {
                  num: 3,
                  title: "Follow-Up Rules",
                  desc: followUpRequired ? "Strategy & Strategy" : "Skipped (Not Required)",
                  status: !followUpRequired ? "Skipped" : step === 3 ? "Current" : "Conditional",
                },
              ].map((s) => (
                <div
                  key={s.num}
                  onClick={() => {
                    if (s.num < step) setStep(s.num as any);
                  }}
                  className={`flex flex-col rounded-xl border p-3 transition ${
                    step === s.num
                      ? "border-[#0c4b80] bg-white shadow-xs ring-1 ring-[#0c4b80]"
                      : step > s.num
                      ? "border-emerald-200 bg-emerald-50/40 cursor-pointer"
                      : s.num === 3 && !followUpRequired
                      ? "border-slate-200 bg-slate-100 opacity-50"
                      : "border-slate-200 bg-slate-50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Step 0{s.num}
                    </span>
                    {step > s.num ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">{s.status}</span>
                    )}
                  </div>
                  <span className="mt-1 text-xs font-bold text-slate-900">
                    {s.title}
                  </span>
                  <span className="text-[11px] text-slate-500">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 flex items-center gap-2 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-700 border border-rose-200">
              <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Doctor Session Data */}
          {step === 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  Session Assignment
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Doctor Session Data
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Select the attending clinician and specialty for this clinical verification batch.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Medical Department / Specialty
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => handleSpecialtyChange(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    {Object.keys(DOCTORS_BY_SPECIALTY).map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Attending Doctor
                  </label>
                  <select
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  >
                    {(DOCTORS_BY_SPECIALTY[specialty] || []).map((doc) => (
                      <option key={doc} value={doc}>
                        {doc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c]"
                  >
                    <span>Next Step: Patient Verification</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* STEP 2: Patient Verification & DECISION TREE */}
          {step === 2 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  Identity Verification &amp; Branching
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Patient Verification
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Verify the patient record with the signed clinical slip. Choose whether follow-up scheduling is required.
                </p>
              </div>

              <form onSubmit={handleLookup} className="mt-6">
                <label className="block text-xs font-semibold text-slate-700">
                  Hospital Patient Identifier
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={patientIdInput}
                    onChange={(e) => setPatientIdInput(e.target.value)}
                    placeholder="e.g. PT-20496, PT-31842, PT-58213, PT-74601"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm uppercase outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Search className="size-3.5" />
                    <span>{searching ? "Verifying..." : "Match Record"}</span>
                  </button>
                </div>
                {lookupError && (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    {lookupError}
                  </p>
                )}
              </form>

              {/* Matched Patient Record Card */}
              {matchedPatient && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
                        <UserCheck className="size-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {matchedPatient.display_name || matchedPatient.hospital_patient_identifier}
                        </h3>
                        <p className="font-mono text-xs text-slate-500">
                          ID: {matchedPatient.hospital_patient_identifier} · DOB:{" "}
                          {matchedPatient.date_of_birth || "Recorded"} · Status:{" "}
                          {matchedPatient.identity_status}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      Record Matched
                    </span>
                  </div>

                  <div className="mt-4 border-t border-emerald-100 pt-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verifiedPatientIdentity}
                        onChange={(e) =>
                          setVerifiedPatientIdentity(e.target.checked)
                        }
                        className="size-4 rounded text-[#0c4b80] focus:ring-0"
                      />
                      <span>
                        I certify that the patient demographics match the physical encounter slip signed by {doctorName}.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* CORE DECISION TREE BRANCH: IS FOLLOW-UP REQUIRED?   */}
              {/* ==================================================== */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      Is Follow-Up Required?
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {followUpRequired
                        ? "Follow-up strategy, priority, and date will be configured in Step 03."
                        : "Patient is discharged / completed. No follow-up reminders will be scheduled."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFollowUpRequired(false)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                        !followUpRequired
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setFollowUpRequired(true)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                        followUpRequired
                          ? "bg-[#0c4b80] border-[#0c4b80] text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Actions depending on Decision Tree */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>

                {/* BRANCH A: Follow-Up is NO -> Direct Submit Intake */}
                {!followUpRequired ? (
                  <button
                    type="button"
                    disabled={submitting || !matchedPatient || !verifiedPatientIdentity}
                    onClick={() => handleSubmitIntake(false)}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"
                  >
                    <Check className="size-4" />
                    <span>{submitting ? "Recording..." : "Submit Intake (Discharged)"}</span>
                  </button>
                ) : (
                  /* BRANCH B: Follow-Up is YES -> Advance to Step 3 */
                  <button
                    type="button"
                    disabled={!matchedPatient || !verifiedPatientIdentity}
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-40"
                  >
                    <span>Proceed to Follow-Up Strategy</span>
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            </section>
          )}

          {/* STEP 3: Follow-Up & Notification Strategy (Conditional) */}
          {step === 3 && followUpRequired && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  Follow-Up Strategy
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Follow-Up &amp; Notification Rules
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Define the follow-up timeline, clinical priority level, and physician instructions.
                </p>
              </div>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Target Follow-Up Date
                    </label>
                    <input
                      type="date"
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Clinical Priority / Severity
                    </label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {[
                        { key: "high", label: "High / Severe" },
                        { key: "moderate", label: "Moderate" },
                        { key: "low", label: "Low" },
                      ].map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setPriority(p.key as any)}
                          className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                            priority === p.key
                              ? "border-[#0c4b80] bg-blue-50/50 text-[#0c4b80] ring-1 ring-[#0c4b80]"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Consultation Mode
                  </label>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConsultationMode("in_person")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition ${
                        consultationMode === "in_person"
                          ? "border-[#0c4b80] bg-blue-50/50 text-[#0c4b80] ring-1 ring-[#0c4b80]"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <MapPin className="size-4" />
                      <span>In-Person Visit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsultationMode("online")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-semibold transition ${
                        consultationMode === "online"
                          ? "border-[#0c4b80] bg-blue-50/50 text-[#0c4b80] ring-1 ring-[#0c4b80]"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Video className="size-4" />
                      <span>Online Consultation</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Doctor's Instructions &amp; Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={doctorRemark}
                    onChange={(e) => setDoctorRemark(e.target.value)}
                    placeholder="e.g. Check blood pressure, repeat HbA1c, evaluate response to updated medication..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmitIntake(true)}
                    className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-50"
                  >
                    <Check className="size-4" />
                    <span>
                      {submitting ? "Finalizing..." : "Finalize & Schedule"}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* ========================================================== */}
      {/* VIEW 2: ONLINE CONSULTANCY PATIENTS DASHBOARD               */}
      {/* ========================================================== */}
      {activeTab === "consultancy" && (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5 gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Online Consultancy Patients
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Remote video consultation queue, patient contacts, and physician assignment.
                </p>
              </div>

              {/* Date Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={consultSearch}
                    onChange={(e) => setConsultSearch(e.target.value)}
                    placeholder="Search patient, phone, doctor..."
                    className="w-56 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs outline-none focus:bg-white focus:border-slate-400"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="date"
                    value={consultDateFrom}
                    onChange={(e) => setConsultDateFrom(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    aria-label="From date"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={consultDateTo}
                    onChange={(e) => setConsultDateTo(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    aria-label="To date"
                  />
                </div>

                {(consultSearch || consultDateFrom || consultDateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setConsultSearch("");
                      setConsultDateFrom("");
                      setConsultDateTo("");
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Consultancy Records Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-3 py-3">Priority</th>
                    <th className="px-4 py-3">Contact Details</th>
                    <th className="px-4 py-3">Attending Clinician</th>
                    <th className="px-4 py-3">Staff Note</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConsultRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No online consultancy records found.
                      </td>
                    </tr>
                  ) : (
                    filteredConsultRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        onClick={() => setSelectedConsult(rec)}
                        className="hover:bg-slate-50/70 cursor-pointer transition"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">
                              {rec.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900">{rec.name}</div>
                              <div className="font-mono text-[11px] text-slate-400">
                                {rec.id} · {rec.age}y · {rec.gender}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              rec.priority === "high"
                                ? "bg-rose-100 text-rose-800"
                                : rec.priority === "moderate"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {rec.priority}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900">{rec.phone}</div>
                          {rec.caretaker && (
                            <div className="text-[11px] text-slate-500">
                              {rec.caretaker} ({rec.relationship})
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900">{rec.doctor}</div>
                          <div className="text-[11px] text-slate-500">{rec.specialty}</div>
                        </td>

                        <td
                          className="px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={rec.note}
                            onChange={(e) =>
                              handleUpdateConsultNote(rec.id, e.target.value)
                            }
                            placeholder="Add a note..."
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-slate-400"
                          />
                        </td>

                        <td
                          className="px-4 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-[11px] text-slate-500">
                              {rec.date}
                            </span>
                            <button
                              type="button"
                              disabled={rec.done}
                              onClick={() => handleMarkConsultDone(rec.id)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                rec.done
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                            >
                              {rec.done ? "Completed" : "Done"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================== */}
      {/* CONFIRMATION RECEIPT MODAL (FOR INTAKE SUBMISSION)          */}
      {/* ========================================================== */}
      {receipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clinical Intake Verified
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official Verification Slip
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-medium">Receipt Reference</span>
                <span className="font-mono font-bold text-slate-900">
                  {receipt.reference}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-medium">Patient</span>
                <span className="font-semibold text-slate-900">
                  {receipt.patientName} ({receipt.patientId})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-medium">Attending Clinician</span>
                <span className="font-semibold text-slate-900">
                  {receipt.doctorName} ({receipt.specialty})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-medium">Follow-Up Status</span>
                <span className={`font-bold ${receipt.followUpRequired ? "text-slate-900" : "text-emerald-700"}`}>
                  {receipt.appointmentDate}
                </span>
              </div>
              {receipt.followUpRequired && (
                <>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-400 font-medium">Priority</span>
                    <span className="font-bold text-slate-900">
                      {receipt.priority}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-slate-400 font-medium">Consultation Mode</span>
                    <span className="font-semibold text-slate-900">
                      {receipt.consultationMode}
                    </span>
                  </div>
                </>
              )}
              <div className="pt-1">
                <span className="text-slate-400 font-medium block mb-1">Doctor's Remark:</span>
                <p className="rounded-lg bg-white p-2 text-slate-800 border border-slate-200">
                  {receipt.doctorRemark}
                </p>
              </div>
            </div>

            {/* Backend Reminder Timeline Placeholder */}
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500">
                Reminder Timeline: Scheduled by backend reminder policy engine.
              </span>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Done &amp; Start Next Intake
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* CONSULTATION DETAIL MODAL (WHEN CLICKING ROW IN VIEW 2)     */}
      {/* ========================================================== */}
      {selectedConsult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedConsult.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedConsult.priority.toUpperCase()} Priority · Online Consultation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedConsult(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Patient Identifier:</span>
                <span className="font-mono font-bold">{selectedConsult.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Demographics:</span>
                <span>{selectedConsult.age} years · {selectedConsult.gender}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Primary Phone:</span>
                <span>{selectedConsult.phone}</span>
              </div>
              {selectedConsult.caretaker && (
                <div className="flex justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-slate-400">Secondary Contact:</span>
                  <span>{selectedConsult.caretaker} ({selectedConsult.relationship})</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Assigned Clinician:</span>
                <span className="font-semibold">{selectedConsult.doctor} ({selectedConsult.specialty})</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Scheduled Date:</span>
                <span className="font-semibold">{selectedConsult.date}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold ${selectedConsult.done ? "text-emerald-700" : "text-amber-700"}`}>
                  {selectedConsult.done ? "Completed" : "Scheduled"}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 block mb-1">Staff Note:</span>
                <p className="rounded-lg bg-slate-50 p-2 border border-slate-200">
                  {selectedConsult.note || "No note recorded."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              {!selectedConsult.done && (
                <button
                  type="button"
                  onClick={() => {
                    handleMarkConsultDone(selectedConsult.id);
                    setSelectedConsult((prev) => prev ? { ...prev, done: true } : null);
                  }}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Mark Completed
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedConsult(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
