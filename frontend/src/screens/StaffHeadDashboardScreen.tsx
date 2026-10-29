import React, { useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  LogOut,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getOperationsSummary } from "../api/operations";
import { getReminderQueue, submitRetryReview } from "../api/reminders";
import { listPolicies } from "../api/policies";
import type {
  OperationsSummary,
  PolicyOut,
  ReminderOut,
} from "../types/api";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { LiveStatusPill } from "../components/common/LiveStatusPill";

type WarningCategory =
  | "Missed clinical task"
  | "Delayed documentation"
  | "Handover gap"
  | "Protocol non-compliance"
  | "Other";

interface SupervisoryWarning {
  id: string;
  staffName: string;
  category: WarningCategory;
  remarks: string;
  deadline: string;
  createdAt: string;
}

export function StaffHeadDashboardScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [retryQueue, setRetryQueue] = useState<ReminderOut[]>([]);
  const [policies, setPolicies] = useState<PolicyOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<SupervisoryWarning[]>([]);

  // Warning modal state
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningStaff, setWarningStaff] = useState("James Okafor (STF-4410)");
  const [warningCategory, setWarningCategory] =
    useState<WarningCategory>("Missed clinical task");
  const [warningRemarks, setWarningRemarks] = useState("");
  const [warningDeadline, setWarningDeadline] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  );
  const [notice, setNotice] = useState("");

  const refreshDashboard = async () => {
    try {
      setLoading(true);
      const [sumRes, queueRes, polRes] = await Promise.all([
        getOperationsSummary(),
        getReminderQueue({ status: "retry_wait", limit: 20 }),
        listPolicies(),
      ]);
      setSummary(sumRes);
      setRetryQueue(queueRes.items);
      setPolicies(polRes.items);
    } catch (err: any) {
      console.error("Failed to load supervisor dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  const { formattedLastUpdated, isRefreshing, refreshNow, refreshError } =
    useLiveRefresh({
      onRefresh: refreshDashboard,
      intervalMs: 12000,
      enabled: Boolean(user),
    });

  const handleIssueWarning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningRemarks.trim()) return;

    const newWarning: SupervisoryWarning = {
      id: `WRN-${Date.now().toString().slice(-6)}`,
      staffName: warningStaff,
      category: warningCategory,
      remarks: warningRemarks.trim(),
      deadline: warningDeadline,
      createdAt: new Date().toISOString(),
    };

    setWarnings([newWarning, ...warnings]);
    setWarningModalOpen(false);
    setWarningRemarks("");
    setNotice(`Supervisory warning issued to ${warningStaff}.`);
  };

  const handleReviewRetry = async (jobId: string, decision: "retry" | "drop" | "escalate") => {
    const reason = prompt(`Enter supervisory justification to ${decision} reminder task:`);
    if (!reason) return;

    try {
      await submitRetryReview(jobId, {
        decision: decision === "drop" ? "suppress" : "retry",
        reason,
      });
      setNotice(`Task ${jobId.slice(0, 8)}: decision '${decision}' applied.`);
      refreshDashboard();
    } catch (err: any) {
      alert("Failed to submit review: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c4b80] text-white">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900">
                  CareTrack
                </span>
                <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                  Staff Head / Operations
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Clinical Workflow Supervision &amp; Compliance Oversight
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LiveStatusPill
              lastUpdatedText={formattedLastUpdated}
              isRefreshing={isRefreshing}
              onRefresh={refreshNow}
              error={refreshError}
            />
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "HD-101"}
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

        {/* Top Header Strip with Issue Warning CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Operations &amp; Supervisory Oversight
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Real-time monitoring of follow-up queues, staff accountability,
              and policy compliance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={refreshDashboard}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setWarningModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
            >
              <FileWarning className="size-4" />
              <span>Issue Supervisory Warning</span>
            </button>
          </div>
        </div>

        {/* Operational Metrics Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">
                Total Orders
              </span>
              <Activity className="size-4" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-slate-900">
              {summary ? Object.values(summary.followups_by_status || {}).reduce((a, b) => a + b, 0) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Active hospital follow-up orders
            </p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 shadow-xs">
            <div className="flex items-center justify-between text-rose-500">
              <span className="text-xs font-bold uppercase tracking-wider">
                Overdue Tasks
              </span>
              <AlertTriangle className="size-4" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-rose-700">
              {summary?.overdue_followups ?? "—"}
            </p>
            <p className="mt-1 text-xs text-rose-600">
              Orders requiring immediate outreach
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-xs">
            <div className="flex items-center justify-between text-amber-500">
              <span className="text-xs font-bold uppercase tracking-wider">
                Contact Needed
              </span>
              <AlertCircle className="size-4" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-amber-700">
              {summary?.followups_by_status?.contact_resolution_required ?? "—"}
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Unreachable / missing primary contacts
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-xs">
            <div className="flex items-center justify-between text-blue-500">
              <span className="text-xs font-bold uppercase tracking-wider">
                Retry Queue
              </span>
              <Clock3 className="size-4" />
            </div>
            <p className="mt-3 text-2xl font-extrabold text-[#0c4b80]">
              {retryQueue.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Reminders awaiting supervisory review
            </p>
          </div>
        </div>

        {/* Retry Queue & Supervisory Warnings */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Section: Retry & Escalation Queue */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">
                Reminder Escalation &amp; Retry Review
              </h2>
              <p className="text-xs text-slate-500">
                Failed delivery attempts requiring supervisor authorization.
              </p>
            </div>

            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {retryQueue.map((job) => (
                <div key={job.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        JOB-{job.id.slice(0, 8)}
                      </span>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Patient: {job.patient_identifier} · Channel:{" "}
                        {job.channel.toUpperCase()}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Failed Attempts: {job.attempt_count}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReviewRetry(job.id, "retry")}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve Retry
                      </button>
                      <button
                        onClick={() => handleReviewRetry(job.id, "escalate")}
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Escalate
                      </button>
                      <button
                        onClick={() => handleReviewRetry(job.id, "drop")}
                        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Drop
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {retryQueue.length === 0 && (
                <div className="px-5 py-12 text-center text-xs text-slate-400">
                  <CheckCircle2 className="mx-auto size-7 text-emerald-500 mb-1" />
                  No reminder retries currently awaiting supervisor action.
                </div>
              )}
            </div>
          </section>

          {/* Section: Issued Supervisory Warnings */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-900">
                Supervisory Notice Log
              </h2>
              <p className="text-xs text-slate-500">
                Formal protocol warnings issued to coordination staff.
              </p>
            </div>

            <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {warnings.map((w) => (
                <div key={w.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900">
                      {w.staffName}
                    </span>
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      {w.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{w.remarks}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Deadline: {w.deadline}</span>
                    <span>Issued: {new Date(w.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}

              {warnings.length === 0 && (
                <div className="px-5 py-12 text-center text-xs text-slate-400">
                  No supervisory warnings issued during this session.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Active Policies Table */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              Active Hospital Policies &amp; Governance
            </h2>
            <p className="text-xs text-slate-500">
              Immutable facility reminder cadence &amp; communication rules.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Policy ID</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Max Attempts</th>
                  <th className="px-4 py-3">Active Status</th>
                  <th className="px-5 py-3 text-right">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {policies.map((pol) => (
                  <tr key={pol.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">
                      {pol.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      v{pol.version}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {pol.name || "Default Hospital Policy"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {pol.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-400">
                      {new Date(pol.effective_from || pol.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Supervisory Warning Modal */}
      {warningModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">
                  Supervisory Action
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Issue Formal Notice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWarningModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleIssueWarning} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target Staff Member
                </label>
                <select
                  value={warningStaff}
                  onChange={(e) => setWarningStaff(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                >
                  <option value="James Okafor (STF-4410)">
                    James Okafor (STF-4410) — Coordinator
                  </option>
                  <option value="Marcus Chen (AST-9021)">
                    Dr. Marcus Chen (AST-9021) — Assistant Doctor
                  </option>
                  <option value="Priya Nair (RCP-302)">
                    Priya Nair (RCP-302) — Receptionist
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Infraction Category
                </label>
                <select
                  value={warningCategory}
                  onChange={(e) => setWarningCategory(e.target.value as any)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                >
                  <option value="Missed clinical task">Missed clinical task</option>
                  <option value="Delayed documentation">Delayed documentation</option>
                  <option value="Handover gap">Handover gap</option>
                  <option value="Protocol non-compliance">
                    Protocol non-compliance
                  </option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Supervisory Remarks &amp; Justification
                </label>
                <textarea
                  required
                  rows={3}
                  value={warningRemarks}
                  onChange={(e) => setWarningRemarks(e.target.value)}
                  placeholder="Detail the audit gap and corrective action required..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Correction Deadline
                </label>
                <input
                  type="date"
                  value={warningDeadline}
                  onChange={(e) => setWarningDeadline(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWarningModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                >
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
