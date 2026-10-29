import React, { useEffect, useState, useCallback } from "react";
import {
  CalendarX2,
  CalendarCheck2,
  Clock,
  PhoneCall,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { getOperationsSummary } from "../api/operations";
import { listFollowups } from "../api/followups";
import { getReminderQueue } from "../api/reminders";
import { useAuth } from "../context/AuthContext";
import { Badge } from "../components/common/Badge";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorBanner } from "../components/common/ErrorBanner";
import type {
  FollowupOut,
  OperationsSummary,
  ReminderOut,
} from "../types/api";

interface DashboardScreenProps {
  onNavigate: (tab: any, params?: any) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [overdueFollowups, setOverdueFollowups] = useState<FollowupOut[]>([]);
  const [callTasks, setCallTasks] = useState<ReminderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promises: Promise<any>[] = [];

      if (hasPermission("operations:read")) {
        promises.push(getOperationsSummary().catch(() => null));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (hasPermission("followup:read")) {
        promises.push(
          listFollowups({ overdue: true, limit: 5 }).catch(() => ({ items: [] }))
        );
      } else {
        promises.push(Promise.resolve({ items: [] }));
      }

      if (hasPermission("reminder:read_queue")) {
        promises.push(
          getReminderQueue({ status: "call_task_open", limit: 5 }).catch(() => ({
            items: [],
          }))
        );
      } else {
        promises.push(Promise.resolve({ items: [] }));
      }

      const [summaryRes, followupsRes, remindersRes] = await Promise.all(promises);

      setSummary(summaryRes);
      setOverdueFollowups(followupsRes?.items || []);
      setCallTasks(remindersRes?.items || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !summary) {
    return <LoadingSpinner message="Loading clinic operations and queue..." />;
  }

  const activeFollowupsCount =
    (summary?.followups_by_status?.active || 0) +
    (summary?.followups_by_status?.contact_resolution_required || 0);

  const completedFollowupsCount = summary?.followups_by_status?.completed || 0;
  const overdueCount = summary?.overdue_followups || 0;
  const contactResolutionCount =
    summary?.followups_by_status?.contact_resolution_required || 0;
  const scansNeedsReview = summary?.scans_by_processing_status?.needs_review || 0;
  const scansFailed = summary?.scans_by_processing_status?.processing_failed || 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#0c4b80] to-[#183d63] p-6 text-white shadow-md">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#25aea8]">
            Local Clinic Operations
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-1">
            Welcome, {user?.display_name || user?.username}
          </h1>
          <p className="text-xs text-[#d9e6f2] mt-1 max-w-xl">
            Real-time follow-up coordination dashboard. Follow-up completion is evidence-based and reminders strictly observe patient consent and verification gates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={loadDashboard} />}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Follow-ups */}
        <div className="rounded-2xl border border-[#d8e0e7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667c91]">Active Follow-Ups</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#ebf8ff] text-[#0c4b80]">
              <CalendarCheck2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#183d63]">{activeFollowupsCount}</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-[#788ca0]">
            <span>Completed: {completedFollowupsCount}</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff8f8] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#991b1b]">Overdue Follow-Ups</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#fee2e2] text-[#dc2626]">
              <CalendarX2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#991b1b]">{overdueCount}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#dc2626] font-medium">
            <AlertTriangle className="size-3" />
            <span>Action required</span>
          </div>
        </div>

        {/* Pending Contact Resolution */}
        <div className="rounded-2xl border border-[#fcd38d] bg-[#fffcf4] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#975a16]">Contact Resolution</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#fef3c7] text-[#d97706]">
              <ShieldAlert className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#975a16]">{contactResolutionCount}</p>
          <div className="mt-2 text-[11px] text-[#975a16]">
            <span>Missing verified route</span>
          </div>
        </div>

        {/* Scans Awaiting Review */}
        <div className="rounded-2xl border border-[#d8e0e7] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#667c91]">Scans In Review</span>
            <div className="grid size-8 place-items-center rounded-xl bg-[#eaf4fb] text-[#0c4b80]">
              <ScanLine className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#183d63]">{scansNeedsReview}</p>
          <div className="mt-2 text-[11px] text-[#667c91]">
            <span>Failed closed: {scansFailed}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Urgent Follow-Ups & Open Manual Call Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Follow-ups */}
        <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
            <div className="flex items-center gap-2">
              <CalendarX2 className="size-4 text-[#dc2626]" />
              <h2 className="text-sm font-bold text-[#183d63]">Overdue Follow-Ups</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("followups", { overdue: true })}
              className="text-xs font-bold text-[#0c4b80] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          <div className="divide-y divide-[#f0f4f8] mt-2">
            {overdueFollowups.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#788ca0]">
                No overdue follow-ups at this time. All cases are within window.
              </p>
            ) : (
              overdueFollowups.map((fo) => (
                <div
                  key={fo.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-[#f9fbfe] px-2 rounded-lg transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#183d63]">
                        {fo.patient_identifier}
                      </span>
                      {fo.patient_display_name && (
                        <span className="text-xs text-[#516d89] truncate">
                          ({fo.patient_display_name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#788ca0]">
                      <Clock className="size-3" />
                      <span>
                        Due:{" "}
                        {fo.scheduled_at
                          ? new Date(fo.scheduled_at).toLocaleDateString()
                          : "Unscheduled"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={fo.severity || "default"} size="sm">
                      {fo.severity}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => onNavigate("followups", { selectedId: fo.id })}
                      className="rounded-full bg-[#0c4b80] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#08355c] transition"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open Call Tasks */}
        <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#eaf0f6]">
            <div className="flex items-center gap-2">
              <PhoneCall className="size-4 text-[#c94e08]" />
              <h2 className="text-sm font-bold text-[#183d63]">Staff Call Tasks (Manual Stage)</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("reminders", { status: "call_task_open" })}
              className="text-xs font-bold text-[#c94e08] hover:underline flex items-center gap-1"
            >
              <span>View Queue</span>
              <ArrowRight className="size-3" />
            </button>
          </div>

          <div className="divide-y divide-[#f0f4f8] mt-2">
            {callTasks.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#788ca0]">
                No open manual call tasks pending staff contact.
              </p>
            ) : (
              callTasks.map((task) => (
                <div
                  key={task.id}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-[#f9fbfe] px-2 rounded-lg transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#183d63]">
                        {task.patient_identifier}
                      </span>
                      <span className="text-[11px] font-mono text-[#788ca0]">
                        {task.masked_contact || "No phone"}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#788ca0] mt-1">
                      Script: <span className="font-medium text-[#45627f]">{task.script_id || "neutral_follow_up_v1"}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("reminders", { selectedJobId: task.id })}
                    className="rounded-full bg-[#c94e08] px-3.5 py-1 text-[11px] font-semibold text-white hover:bg-[#b84600] transition"
                  >
                    Call & Record
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Launchpad based on role */}
      <div className="rounded-2xl border border-[#d8e0e7] bg-white p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#788ca0] mb-3">
          Clinical Actions for {user?.role}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(hasPermission("scan:upload") || hasPermission("scan:verify")) && (
            <button
              type="button"
              onClick={() => onNavigate("scans")}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#e2ebf3] hover:border-[#0c4b80] hover:bg-[#f7faff] transition text-left"
            >
              <div className="p-2 rounded-lg bg-[#edf5fb] text-[#0c4b80]">
                <ScanLine className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#183d63]">Scan Intake & Review</p>
                <p className="text-[11px] text-[#788ca0]">Upload or verify clinic OMR/OCR scans</p>
              </div>
            </button>
          )}

          {hasPermission("patient:read") && (
            <button
              type="button"
              onClick={() => onNavigate("patients")}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#e2ebf3] hover:border-[#0c4b80] hover:bg-[#f7faff] transition text-left"
            >
              <div className="p-2 rounded-lg bg-[#edf5fb] text-[#0c4b80]">
                <UserCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#183d63]">Patient & Contacts</p>
                <p className="text-[11px] text-[#788ca0]">Lookup patient, register encounters & consent</p>
              </div>
            </button>
          )}

          {hasPermission("followup:read") && (
            <button
              type="button"
              onClick={() => onNavigate("followups")}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-[#e2ebf3] hover:border-[#0c4b80] hover:bg-[#f7faff] transition text-left"
            >
              <div className="p-2 rounded-lg bg-[#edf5fb] text-[#0c4b80]">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#183d63]">Follow-Up Orders</p>
                <p className="text-[11px] text-[#788ca0]">Inspect timelines, amendments & completions</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
