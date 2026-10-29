import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  LogOut,
  Phone,
  PhoneCall,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getReminderQueue, recordCallOutcome } from "../api/reminders";
import type { ReminderOut } from "../types/api";

type SeverityFilter = "all" | "severe" | "mid" | "low";

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function prettyDate(isoDate: string): string {
  try {
    const date = new Date(`${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return isoDate;
  }
}

export function CoordinatorTriageScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

  const [currentDate, setCurrentDate] = useState<string>(toIsoDate(new Date()));
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<ReminderOut[]>([]);
  const [, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<ReminderOut | null>(null);

  // Call outcome modal state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callReached, setCallReached] = useState(true);
  const [callOutcomeType, setCallOutcomeType] = useState("confirmed");
  const [barrierDetected, setBarrierDetected] = useState(false);
  const [barrierNotes, setBarrierNotes] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const [notice, setNotice] = useState("");

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await getReminderQueue({ limit: 100 });
      setQueue(res.items);
      if (res.items.length > 0 && !selectedJob) {
        setSelectedJob(res.items[0]);
      }
    } catch (err: any) {
      console.error("Failed to load triage queue", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const filteredQueue = queue.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.id.toLowerCase().includes(q) ||
      item.patient_identifier.toLowerCase().includes(q);

    // Filter by severity if mapped
    const matchesSeverity =
      severityFilter === "all" ||
      (severityFilter === "severe" && item.attempt_count >= 2) ||
      (severityFilter === "mid" && item.attempt_count === 1) ||
      (severityFilter === "low" && item.attempt_count === 0);

    return matchesSearch && matchesSeverity;
  });

  const handleOpenCallModal = (job: ReminderOut) => {
    setSelectedJob(job);
    setCallReached(true);
    setCallOutcomeType("confirmed");
    setBarrierDetected(false);
    setBarrierNotes("");
    setCallNotes("");
    setCallModalOpen(true);
  };

  const handleSaveCallOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    setSubmittingOutcome(true);
    try {
      const fullNotes = [
        callNotes.trim(),
        barrierDetected ? `[Barrier Identified: ${barrierNotes.trim()}]` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const outcomeMap: Record<string, "contacted_patient" | "no_answer" | "voicemail_left_neutral" | "wrong_number" | "requested_reschedule" | "declined_messages"> = {
        confirmed: "contacted_patient",
        reschedule_requested: "requested_reschedule",
        declined: "declined_messages",
        no_answer: "no_answer",
        voicemail_left: "voicemail_left_neutral",
        wrong_number: "wrong_number",
      };
      const mappedResult = outcomeMap[callOutcomeType] || (callReached ? "contacted_patient" : "no_answer");

      await recordCallOutcome(selectedJob.id, {
        result: mappedResult,
        safe_result_notes: fullNotes || undefined,
        occurred_at: new Date().toISOString(),
      });

      setNotice(
        `Contact attempt recorded for task ${selectedJob.id.slice(0, 8)}.`
      );
      setCallModalOpen(false);
      fetchQueue();
    } catch (err: any) {
      alert("Failed to record call outcome: " + (err.message || "Unknown error"));
    } finally {
      setSubmittingOutcome(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c4b80] text-white">
              <PhoneCall className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900">
                  CareTrack
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                  Staff Triage &amp; Outreach
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Patient Contact Operations &amp; Barrier Resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "STF-4410"}
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Notice alert */}
        {notice && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="flex items-center gap-2">
              <CircleCheck className="size-4" />
              {notice}
            </span>
            <button onClick={() => setNotice("")}>
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Date Navigation Strip */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentDate(shiftIsoDate(currentDate, -1))}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Previous day"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex items-center gap-2 px-2">
              <CalendarDays className="size-4 text-[#0c4b80]" />
              <span className="text-sm font-bold text-slate-900">
                {prettyDate(currentDate)}
              </span>
            </div>
            <button
              onClick={() => setCurrentDate(shiftIsoDate(currentDate, 1))}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Next day"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={() => setCurrentDate(toIsoDate(new Date()))}
              className="ml-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter:</span>
            {(["all", "severe", "mid", "low"] as SeverityFilter[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSeverityFilter(mode)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition ${
                  severityFilter === mode
                    ? "bg-[#0c4b80] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace Grid: Task Queue List + Selected Patient Action Panel */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          {/* Left Column: Triage Task Queue */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Triage &amp; Outreach Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    Active follow-up contact tasks awaiting resolution.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-600">
                  {filteredQueue.length} Tasks
                </span>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter tasks by ID..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredQueue.map((item) => {
                const isSelected = selectedJob?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedJob(item)}
                    className={`flex cursor-pointer items-start justify-between p-4 transition ${
                      isSelected
                        ? "bg-sky-50/70 border-l-4 border-l-[#0c4b80]"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          TASK-{item.id.slice(0, 8)}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            item.status === "scheduled"
                              ? "bg-amber-50 text-amber-700"
                              : item.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.status.toUpperCase()}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          Attempts: {item.attempt_count}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        Patient Ref: {item.patient_identifier}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Target Time:{" "}
                        {new Date(item.scheduled_at).toLocaleString()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCallModal(item);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50"
                    >
                      Log Call
                    </button>
                  </div>
                );
              })}

              {filteredQueue.length === 0 && (
                <div className="px-5 py-16 text-center text-sm text-slate-500">
                  <CircleCheck className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 font-semibold text-slate-800">
                    No outreach tasks pending
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    All scheduled reminders for this batch are processed.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: Active Task Details & Outreach Panel */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Task Details &amp; Action Plan
            </h2>

            {selectedJob ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      ID: {selectedJob.id}
                    </span>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-[#0c4b80]">
                      {selectedJob.channel.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <p>
                      <strong>Patient ID:</strong> {selectedJob.patient_identifier}
                    </p>
                    <p>
                      <strong>Follow-Up Order:</strong>{" "}
                      {selectedJob.followup_order_id}
                    </p>
                    <p>
                      <strong>Status:</strong> {selectedJob.status}
                    </p>
                    <p>
                      <strong>Scheduled For:</strong>{" "}
                      {new Date(selectedJob.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase">
                    Protocol Instructions
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    1. Contact the patient or designated primary family caregiver.
                    <br />
                    2. Confirm target follow-up appointment attendance.
                    <br />
                    3. Screen for potential adherence barriers (financial,
                    transportation, mobility, or medication supply).
                    <br />
                    4. Log call outcome to update clinical audit log.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCallModal(selectedJob)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0c4b80] py-3 text-xs font-bold text-white shadow-sm hover:bg-[#08355c]"
                >
                  <Phone className="size-4" />
                  <span>Log Contact Attempt &amp; Barriers</span>
                </button>
              </div>
            ) : (
              <div className="mt-12 text-center text-xs text-slate-400">
                Select a task from the queue to view contact details.
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Call Outcome Logging Modal */}
      {callModalOpen && selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  Contact Outcome Recording
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Log Outreach Call
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCallModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCallOutcome} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Did patient / family answer?
                </label>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCallReached(true);
                      setCallOutcomeType("confirmed");
                    }}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold ${
                      callReached
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Patient Reached
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCallReached(false);
                      setCallOutcomeType("no_answer");
                    }}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold ${
                      !callReached
                        ? "border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-600"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    Unreachable / Voicemail
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Call Outcome
                </label>
                <select
                  value={callOutcomeType}
                  onChange={(e) => setCallOutcomeType(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
                >
                  {callReached ? (
                    <>
                      <option value="confirmed">Appointment Confirmed</option>
                      <option value="reschedule_requested">
                        Reschedule Requested
                      </option>
                      <option value="declined">Patient Declined Visit</option>
                    </>
                  ) : (
                    <>
                      <option value="no_answer">No Answer / Ringing</option>
                      <option value="voicemail_left">Left Voicemail</option>
                      <option value="wrong_number">Invalid / Wrong Number</option>
                    </>
                  )}
                </select>
              </div>

              {/* Barrier Flagging */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={barrierDetected}
                    onChange={(e) => setBarrierDetected(e.target.checked)}
                    className="size-4 rounded text-[#0c4b80]"
                  />
                  <span>Adherence Barrier Identified?</span>
                </label>
                {barrierDetected && (
                  <input
                    type="text"
                    value={barrierNotes}
                    onChange={(e) => setBarrierNotes(e.target.value)}
                    placeholder="Describe barrier (e.g. Transportation, Cost, Mobility)..."
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Staff Notes &amp; Observations
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Additional context from conversation..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCallModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOutcome}
                  className="rounded-xl bg-[#0c4b80] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-50"
                >
                  {submittingOutcome ? "Saving..." : "Save Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
