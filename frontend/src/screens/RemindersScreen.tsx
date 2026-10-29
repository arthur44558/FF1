import React, { useState, useEffect, useCallback } from "react";
import {
  PhoneCall,
  MessageSquare,
  RefreshCw,
  Search,
  History,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  getReminderQueue,
  getReminder,
  recordCallOutcome,
  submitRetryReview,
} from "../api/reminders";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { EmptyState } from "../components/common/EmptyState";
import type {
  CallOutcomeIn,
  ReminderDetail,
  ReminderOut,
  RetryReviewIn,
} from "../types/api";

interface RemindersScreenProps {
  initialJobId?: string;
  initialStatus?: string;
}

const CALL_OUTCOME_OPTIONS: Array<{ value: CallOutcomeIn["result"]; label: string }> = [
  { value: "contacted_patient", label: "Contacted Patient Directly" },
  { value: "no_answer", label: "No Answer / Unreachable" },
  { value: "voicemail_left_neutral", label: "Left Neutral Voicemail" },
  { value: "wrong_number", label: "Wrong Number / Inactive Line" },
  { value: "shared_contact_blocked", label: "Shared Contact (Protected Info Withheld)" },
  { value: "requested_reschedule", label: "Patient Requested Reschedule" },
  { value: "declined_messages", label: "Patient Declined Future Reminders" },
  { value: "contact_details_invalid", label: "Contact Details Invalid" },
  { value: "escalated_to_clinician", label: "Escalated to Clinician" },
  { value: "other_review_required", label: "Other / Review Required" },
];

export const RemindersScreen: React.FC<RemindersScreenProps> = ({
  initialJobId,
  initialStatus,
}) => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [queue, setQueue] = useState<ReminderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus || "");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Detail Modal
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId || null);
  const [detailData, setDetailData] = useState<ReminderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Call Outcome Modal
  const [showCallModal, setShowCallModal] = useState(false);
  const [callResult, setCallResult] = useState<CallOutcomeIn["result"]>("contacted_patient");
  const [callNotes, setCallNotes] = useState("");
  const [callSubmitting, setCallSubmitting] = useState(false);

  // Retry Review Modal (Supervisor)
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [retryDecision, setRetryDecision] = useState<"retry" | "suppress">("retry");
  const [retryReason, setRetryReason] = useState("");
  const [confirmedNotSent, setConfirmedNotSent] = useState(false);
  const [retrySubmitting, setRetrySubmitting] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReminderQueue({
        status: statusFilter || undefined,
        limit: 100,
      });
      setQueue(res.items);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const loadJobDetails = useCallback(async (jobId: string) => {
    setDetailLoading(true);
    try {
      const res = await getReminder(jobId);
      setDetailData(res);
    } catch (err: any) {
      addToast("error", err.message || "Failed to load reminder job");
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (selectedJobId) {
      loadJobDetails(selectedJobId);
    } else {
      setDetailData(null);
    }
  }, [selectedJobId, loadJobDetails]);

  // Submit Call Outcome
  const handleSubmitCallOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;
    setCallSubmitting(true);
    try {
      const payload: CallOutcomeIn = {
        result: callResult,
        safe_result_notes: callNotes.trim() || null,
        occurred_at: new Date().toISOString(),
      };
      await recordCallOutcome(selectedJobId, payload);
      addToast("success", `Call outcome recorded: ${callResult}`, "Staff Task Completed");
      setShowCallModal(false);
      await loadJobDetails(selectedJobId);
      await loadQueue();
    } catch (err: any) {
      addToast("error", err.message || "Failed to record call outcome");
    } finally {
      setCallSubmitting(false);
    }
  };

  // Submit Retry Review (Supervisor)
  const handleSubmitRetryReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId) return;
    setRetrySubmitting(true);
    try {
      const payload: RetryReviewIn = {
        decision: retryDecision,
        reason: retryReason,
        confirmed_not_sent: confirmedNotSent,
      };
      await submitRetryReview(selectedJobId, payload);
      addToast("success", `Retry review decision: ${retryDecision}`, "Review Recorded");
      setShowRetryModal(false);
      await loadJobDetails(selectedJobId);
      await loadQueue();
    } catch (err: any) {
      addToast("error", err.message || "Failed to submit retry review");
    } finally {
      setRetrySubmitting(false);
    }
  };

  const filteredQueue = queue.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.patient_identifier.toLowerCase().includes(q) ||
      (job.patient_display_name && job.patient_display_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Reminder Queue &amp; Communications</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Durable reminder jobs. Automated SMS stage is background-dispatched; manual telephone calls are human staff tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e0e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Queue
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={loadQueue} />}

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#d8e0e7] shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === ""
                ? "bg-[#0c4b80] text-white"
                : "bg-[#edf5fb] text-[#516d89] hover:bg-[#e2ebf3]"
            }`}
          >
            Due Actionable
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("call_task_open")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === "call_task_open"
                ? "bg-[#c94e08] text-white"
                : "bg-[#fff7e6] text-[#c94e08] hover:bg-[#fee7cc]"
            }`}
          >
            <PhoneCall className="size-3" />
            <span>Open Call Tasks</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("scheduled")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "scheduled"
                ? "bg-[#0c4b80] text-white"
                : "bg-[#edf5fb] text-[#516d89] hover:bg-[#e2ebf3]"
            }`}
          >
            Scheduled
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "completed"
                ? "bg-[#157347] text-white"
                : "bg-[#edf5fb] text-[#516d89] hover:bg-[#e2ebf3]"
            }`}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("suppressed")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "suppressed"
                ? "bg-[#45627f] text-white"
                : "bg-[#edf5fb] text-[#516d89] hover:bg-[#e2ebf3]"
            }`}
          >
            Suppressed
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("retry_wait")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "retry_wait"
                ? "bg-[#975a16] text-white"
                : "bg-[#edf5fb] text-[#516d89] hover:bg-[#e2ebf3]"
            }`}
          >
            Retry Wait
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="size-4 text-[#788ca0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient..."
            className="w-full rounded-xl border border-[#d8e0e7] pl-9 pr-3.5 py-1.5 text-xs text-[#17212b] focus:border-[#0c4b80] focus:outline-none"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl border border-[#d8e0e7] bg-white shadow-xs overflow-hidden">
        {loading && queue.length === 0 ? (
          <LoadingSpinner message="Loading reminder queue..." />
        ) : filteredQueue.length === 0 ? (
          <EmptyState
            title="No Reminder Jobs In This View"
            description="All scheduled reminders in this category have been processed or none are currently queued."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#eaf0f6] bg-[#f9fbfe] text-[11px] font-bold text-[#45627f] uppercase tracking-wider">
                  <th className="py-3 px-4">Seq #</th>
                  <th className="py-3 px-4">Patient Identifier</th>
                  <th className="py-3 px-4">Action Kind / Channel</th>
                  <th className="py-3 px-4">Contact (Masked)</th>
                  <th className="py-3 px-4">Scheduled For</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f8]">
                {filteredQueue.map((job) => (
                  <tr key={job.id} className="hover:bg-[#f8fbfe] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#788ca0]">
                      #{job.sequence_no}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-[#183d63]">
                        {job.patient_identifier}
                      </div>
                      {job.patient_display_name && (
                        <div className="text-[11px] text-[#788ca0]">
                          {job.patient_display_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {job.action_kind === "call" ? (
                          <PhoneCall className="size-3.5 text-[#c94e08]" />
                        ) : (
                          <MessageSquare className="size-3.5 text-[#0c4b80]" />
                        )}
                        <span className="font-bold text-[#183d63] uppercase text-[11px]">
                          {job.action_kind}
                        </span>
                        <span className="text-[#788ca0]">({job.channel})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#516d89]">
                      {job.masked_contact || "No contact"}
                    </td>
                    <td className="py-3 px-4 text-[#516d89]">
                      {new Date(job.scheduled_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "completed"
                              : job.status === "call_task_open"
                              ? "moderate"
                              : job.status === "suppressed"
                              ? "default"
                              : "active"
                          }
                          size="sm"
                        >
                          {job.status}
                        </Badge>
                        {job.suppression_reason && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            {job.suppression_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {job.status === "call_task_open" && hasPermission("reminder:record_call") ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setShowCallModal(true);
                          }}
                          className="rounded-full bg-[#c94e08] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#b84600] transition"
                        >
                          Record Call
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedJobId(job.id)}
                          className="rounded-full bg-[#0c4b80] px-3 py-1 text-xs font-semibold text-white hover:bg-[#08355c] transition"
                        >
                          Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reminder Detail & Attempt History Modal */}
      {selectedJobId && !showCallModal && !showRetryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c2338]/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7] max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedJobId(null)}
              className="absolute right-4 top-4 text-[#8b9996] hover:text-[#183d63] transition"
            >
              <XCircle className="size-5" />
            </button>

            {detailLoading || !detailData ? (
              <LoadingSpinner message="Loading job history..." />
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#eaf0f6] pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#788ca0]">
                      Reminder Job Details
                    </span>
                    <h2 className="text-base font-bold text-[#183d63]">
                      #{detailData.reminder.sequence_no} — {detailData.reminder.action_kind.toUpperCase()} via {detailData.reminder.channel}
                    </h2>
                  </div>
                  <Badge variant={detailData.reminder.status === "completed" ? "completed" : "outline"}>
                    {detailData.reminder.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-[#f8fbfe] p-3.5 rounded-xl border border-[#e2ebf3]">
                  <div>
                    <span className="text-[#788ca0] block">Patient:</span>
                    <span className="font-mono font-bold text-[#183d63]">
                      {detailData.reminder.patient_identifier}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#788ca0] block">Masked Contact:</span>
                    <span className="font-mono text-[#516d89]">
                      {detailData.reminder.masked_contact || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#788ca0] block">Script Identifier:</span>
                    <span className="font-mono text-[#516d89]">
                      {detailData.reminder.script_id || "neutral_follow_up_v1"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#788ca0] block">Attempts:</span>
                    <span className="font-bold text-[#183d63]">
                      {detailData.reminder.attempt_count}
                    </span>
                  </div>
                </div>

                {/* Supervisor Retry Review Button */}
                {hasPermission("reminder:retry_review") &&
                  (detailData.reminder.status === "retry_wait" ||
                    detailData.reminder.status === "send_unknown" ||
                    detailData.reminder.status === "failed") && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
                      <span className="text-xs text-amber-800">
                        This job is pending supervisor retry review.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRetryModal(true)}
                        className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition"
                      >
                        Conduct Retry Review
                      </button>
                    </div>
                  )}

                {/* Attempt History */}
                <div>
                  <h3 className="text-xs font-bold text-[#183d63] mb-2 flex items-center gap-1.5">
                    <History className="size-3.5" />
                    <span>Communication Attempt Log</span>
                  </h3>
                  {detailData.attempts.length === 0 ? (
                    <p className="text-xs text-[#788ca0] italic p-3 bg-gray-50 rounded-lg">
                      No communication attempts recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {detailData.attempts.map((att) => (
                        <div
                          key={att.attempt_no}
                          className="p-3 rounded-lg border border-[#e2ebf3] bg-[#fafcff]"
                        >
                          <div className="flex justify-between font-semibold text-[#183d63]">
                            <span>Attempt #{att.attempt_no} ({att.channel})</span>
                            <span className="text-[#0c4b80]">{att.result}</span>
                          </div>
                          <div className="text-[11px] text-[#788ca0] mt-1 flex justify-between">
                            <span>Started: {new Date(att.started_at).toLocaleString()}</span>
                            {att.finished_at && (
                              <span>Finished: {new Date(att.finished_at).toLocaleString()}</span>
                            )}
                          </div>
                          {att.error_code && (
                            <p className="text-[11px] text-red-600 mt-1">Error: {att.error_code}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Call Outcome Modal */}
      {showCallModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#eaf0f6]">
              <PhoneCall className="size-4 text-[#c94e08]" />
              <h3 className="text-sm font-bold text-[#183d63]">Record Manual Phone Call Outcome</h3>
            </div>
            <p className="text-xs text-[#667c91] mt-2 mb-4">
              Enter the neutral staff call outcome according to clinical communication standards. Never enter private medical diagnoses in result notes.
            </p>

            <form onSubmit={handleSubmitCallOutcome} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Call Result (Standard Clinic Enum)
                </label>
                <select
                  value={callResult}
                  onChange={(e) => setCallResult(e.target.value as any)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-2 text-xs text-[#17212b]"
                >
                  {CALL_OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Safe Result Notes (Masked/De-identified only)
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. Spoke to patient, confirmed aware of scheduled follow-up window"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-2 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCallModal(false)}
                  disabled={callSubmitting}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={callSubmitting}
                  className="rounded-full bg-[#c94e08] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#b84600] disabled:opacity-50"
                >
                  {callSubmitting ? "Saving..." : "Save Call Outcome"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supervisor Retry Review Modal */}
      {showRetryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#eaf0f6]">
              <ShieldAlert className="size-4 text-amber-600" />
              <h3 className="text-sm font-bold text-[#183d63]">Supervisor Retry Review</h3>
            </div>
            <p className="text-xs text-[#667c91] mt-2 mb-4">
              Authorize a single safe retry or suppress to prevent duplicate patient messaging.
            </p>

            <form onSubmit={handleSubmitRetryReview} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Supervisor Decision
                </label>
                <select
                  value={retryDecision}
                  onChange={(e) => setRetryDecision(e.target.value as any)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-2 text-xs text-[#17212b]"
                >
                  <option value="retry">Retry Dispatch</option>
                  <option value="suppress">Suppress (Do Not Send)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="not-sent"
                  checked={confirmedNotSent}
                  onChange={(e) => setConfirmedNotSent(e.target.checked)}
                  className="size-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="not-sent" className="text-xs font-bold text-[#183d63]">
                  Confirmed provider did not transmit message
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Review Justification Reason
                </label>
                <input
                  type="text"
                  value={retryReason}
                  onChange={(e) => setRetryReason(e.target.value)}
                  required
                  minLength={3}
                  placeholder="e.g. Verified with telecom provider; line temporary fail"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRetryModal(false)}
                  disabled={retrySubmitting}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retrySubmitting}
                  className="rounded-full bg-amber-600 px-5 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {retrySubmitting ? "Submitting..." : "Authorize Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
