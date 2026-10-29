import { useState } from "react";
import {
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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { lookupPatient } from "../api/patients";
import { createEncounter } from "../api/encounters";
import type { PatientOut } from "../types/api";

const DOCTORS_BY_SPECIALTY: Record<string, string[]> = {
  Cardiology: ["Dr. Amelia Reed", "Dr. J. Lin", "Dr. S. Okafor"],
  Orthopedics: ["Dr. R. Morgan", "Dr. L. Ahmed", "Dr. C. Bennett"],
  "General Medicine": ["Dr. Maya Patel", "Dr. K. Sharma", "Dr. T. Rivera"],
  Pediatrics: ["Dr. N. Brooks", "Dr. P. Nair", "Dr. E. Foster"],
  Dermatology: ["Dr. I. Laurent", "Dr. D. Kim", "Dr. F. Cole"],
};

export function AssistantIntakeScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

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

  // Step 3: Follow-Up & Rules
  const [followUpRequired, setFollowUpRequired] = useState(true);
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
    appointmentDate: string;
    priority: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdInput.trim()) {
      setLookupError("Enter a hospital patient identifier (e.g. PT-1001).");
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

  const handleSubmitIntake = async () => {
    if (!matchedPatient) {
      setErrorMsg("A verified patient is required.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    try {
      const extEncounterId = `ENC-${Date.now().toString().slice(-6)}`;
      await createEncounter({
        patient_id: matchedPatient.id,
        external_encounter_identifier: extEncounterId,
        clinician_user_id: user?.id || "",
        encounter_at: `${sessionDate}T09:00:00Z`,
      });

      const refNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      setReceipt({
        reference: refNumber,
        patientName: matchedPatient.display_name || matchedPatient.hospital_patient_identifier,
        patientId: matchedPatient.hospital_patient_identifier,
        doctorName: doctorName,
        appointmentDate: followUpRequired ? appointmentDate : "None (Discharged)",
        priority: priority.toUpperCase(),
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
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
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

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "AST-9021"}
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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Stepper Progress Header */}
        <div className="mb-8">
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, title: "Doctor Context", desc: "Clinician & Specialty" },
              { num: 2, title: "Patient Verification", desc: "Lookup & Identity" },
              { num: 3, title: "Follow-Up Rules", desc: "Strategy & Strategy" },
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
                    : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Step 0{s.num}
                  </span>
                  {step > s.num && (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
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
          <div className="mb-6 rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Step 1: Doctor Context */}
        {step === 1 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                Session Assignment
              </span>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Doctor Session Context
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select the attending clinician and department for this clinical
                verification batch.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Medical Department / Specialty
                </label>
                <select
                  value={specialty}
                  onChange={(e) => {
                    const spec = e.target.value;
                    setSpecialty(spec);
                    const doctors = DOCTORS_BY_SPECIALTY[spec] || [];
                    if (doctors.length > 0) setDoctorName(doctors[0]);
                  }}
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
                  Attending Clinician (Doctor)
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
                  <span>Continue to Patient Verification</span>
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 2: Patient Verification */}
        {step === 2 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                Identity Verification
              </span>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Patient Record Verification
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Assistants may not browse unrestricted patient lists. Enter the
                exact hospital identifier from the doctor encounter slip.
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
                  placeholder="e.g. PT-1001, PT-2041"
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

            {matchedPatient && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
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
                      I certify that the patient demographics match the physical
                      encounter slip signed by {doctorName}.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!matchedPatient || !verifiedPatientIdentity}
                onClick={() => setStep(3)}
                className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-40"
              >
                <span>Proceed to Follow-Up Strategy</span>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </section>
        )}

        {/* Step 3: Follow-Up & Notification Strategy */}
        {step === 3 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                Follow-Up Strategy
              </span>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                Follow-Up &amp; Notification Rules
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Define the follow-up timeline, priority level, and physician
                clinical notes.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Follow-Up Required?
                  </span>
                  <p className="text-[11px] text-slate-500">
                    If toggled off, patient encounter is recorded as completed
                    without scheduling reminders.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={followUpRequired}
                  onChange={(e) => setFollowUpRequired(e.target.checked)}
                  className="size-5 rounded text-[#0c4b80]"
                />
              </div>

              {followUpRequired && (
                <>
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
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="high">High Priority</option>
                        <option value="moderate">Moderate Priority</option>
                        <option value="low">Low Priority</option>
                      </select>
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
                </>
              )}

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
                  onClick={handleSubmitIntake}
                  className="flex items-center gap-2 rounded-xl bg-[#0c4b80] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-50"
                >
                  <Check className="size-4" />
                  <span>
                    {submitting ? "Submitting..." : "Submit Assistant Verification"}
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Confirmation Receipt Modal */}
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
                  {receipt.doctorName}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400 font-medium">Follow-Up Date</span>
                <span className="font-semibold text-slate-900">
                  {receipt.appointmentDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Priority</span>
                <span className="font-bold text-slate-900">
                  {receipt.priority}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
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
    </div>
  );
}
