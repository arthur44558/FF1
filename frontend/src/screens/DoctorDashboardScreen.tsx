import React, { useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listFollowups,
  rescheduleFollowup,
  completeFollowup,
  cancelFollowup,
} from "../api/followups";
import type { FollowupOut } from "../types/api";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { LiveStatusPill } from "../components/common/LiveStatusPill";

type Section = "overview" | "logs" | "calendar" | "approvals";
type AppointmentMode = "all" | "online" | "in_person";

interface DoctorFollowupItem {
  id: string;
  patientId: string;
  patientIdentifier: string;
  patientName: string;
  initials: string;
  severity: "high" | "moderate" | "low" | "severe" | "normal";
  mode: "online" | "in_person";
  appointmentDate: string;
  status: string;
  notes: string;
  overdue: boolean;
  revision: number;
}

function dateDistance(dateKey: string): number {
  if (!dateKey) return 0;
  const target = new Date(`${dateKey}T12:00:00`).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12
  ).getTime();
  return Math.round((target - today) / 86400000);
}

function relativeDay(dateKey: string): string {
  const distance = dateDistance(dateKey);
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  if (distance === -1) return "Yesterday";
  if (distance > 1) return `In ${distance} days`;
  return `${Math.abs(distance)} days ago`;
}

function getInitials(name: string): string {
  if (!name) return "PT";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DoctorDashboardScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

  const [section, setSection] = useState<Section>("overview");
  const [modeFilter, setModeFilter] = useState<AppointmentMode>("all");
  const [search, setSearch] = useState("");
  const [followups, setFollowups] = useState<DoctorFollowupItem[]>([]);
  const [, setLoading] = useState(true);
  const [selectedFollowup, setSelectedFollowup] =
    useState<DoctorFollowupItem | null>(null);
  const [notice, setNotice] = useState("");

  // Action dialogs
  const [actionTarget, setActionTarget] = useState<DoctorFollowupItem | null>(null);
  const [actionType, setActionType] = useState<"reschedule" | "complete" | "cancel" | null>(null);
  const [actionDate, setActionDate] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  const fetchFollowups = async () => {
    try {
      setLoading(true);
      const res = await listFollowups({ limit: 100 });
      const mapped: DoctorFollowupItem[] = res.items.map((fo: FollowupOut, index: number) => {
        const dateStr = fo.scheduled_at
          ? fo.scheduled_at.split("T")[0]
          : new Date().toISOString().split("T")[0];
        const isOnline = index % 2 === 0;
        return {
          id: fo.id,
          patientId: fo.patient_id,
          patientIdentifier: fo.patient_identifier || `PT-${fo.patient_id.slice(0, 4).toUpperCase()}`,
          patientName: fo.patient_display_name || "Assigned Patient",
          initials: getInitials(fo.patient_display_name || "Assigned Patient"),
          severity: (fo.severity?.toLowerCase() as any) || "moderate",
          mode: isOnline ? "online" : "in_person",
          appointmentDate: dateStr,
          status: fo.status,
          notes: "Routine clinical assessment and medication review scheduled.",
          overdue: fo.overdue,
          revision: fo.revision,
        };
      });
      setFollowups(mapped);
    } catch (err: any) {
      console.error("Failed to load doctor followups", err);
    } finally {
      setLoading(false);
    }
  };

  const { formattedLastUpdated, isRefreshing, refreshNow, refreshError } =
    useLiveRefresh({
      onRefresh: fetchFollowups,
      intervalMs: 12000,
      enabled: Boolean(user),
    });

  const filteredFollowups = useMemo(() => {
    return followups.filter((f) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        f.patientName.toLowerCase().includes(q) ||
        f.patientIdentifier.toLowerCase().includes(q);
      const matchesMode = modeFilter === "all" || f.mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [followups, search, modeFilter]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !actionType) return;
    setProcessingAction(true);

    try {
      if (actionType === "reschedule") {
        await rescheduleFollowup(actionTarget.id, {
          scheduled_at: `${actionDate}T10:00:00Z`,
          expected_revision: actionTarget.revision,
          reason: actionReason || "Doctor clinical schedule adjustment",
        });
        setNotice(`Follow-up rescheduled for ${actionTarget.patientName}.`);
      } else if (actionType === "complete") {
        await completeFollowup(actionTarget.id, {
          outcome_category: "attended",
          completed_at: new Date().toISOString(),
        });
        setNotice(`Follow-up completed for ${actionTarget.patientName}.`);
      } else if (actionType === "cancel") {
        await cancelFollowup(actionTarget.id, {
          reason: actionReason || "Clinically no longer required.",
        });
        setNotice(`Follow-up cancelled for ${actionTarget.patientName}.`);
      }

      setActionTarget(null);
      setActionType(null);
      setActionDate("");
      setActionReason("");
      await refreshNow();
    } catch (err: any) {
      alert("Action failed: " + (err.message || "Unknown error"));
    } finally {
      setProcessingAction(false);
    }
  };

  const highSeverityCount = followups.filter((f) => f.severity === "severe" || f.severity === "high").length;
  const overdueCount = followups.filter((f) => f.overdue).length;
  const activeCount = followups.filter((f) => f.status === "active").length;

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
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-[#0c4b80]">
                  Doctor Clinical Authority
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Attending Physician Dashboard &amp; Decision Hub
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
                {user?.system_identifier || "DOC-1029"}
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          {[
            { id: "overview", label: "Clinical Overview", icon: LayoutDashboard },
            { id: "logs", label: "Patient Follow-Up Orders", icon: UsersRound },
            { id: "calendar", label: "Calendar & Schedule", icon: CalendarDays },
            { id: "approvals", label: "Assistant Requests", icon: CalendarCheck2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id as Section)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-[#0c4b80] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Section 1: Overview */}
        {section === "overview" && (
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Follow-Ups
                </span>
                <p className="mt-2 text-3xl font-extrabold text-slate-900">
                  {activeCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">Scheduled clinical orders</p>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                  High Severity Cases
                </span>
                <p className="mt-2 text-3xl font-extrabold text-rose-700">
                  {highSeverityCount}
                </p>
                <p className="mt-1 text-xs text-rose-600">Critical monitoring patients</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  Overdue Consultations
                </span>
                <p className="mt-2 text-3xl font-extrabold text-amber-700">
                  {overdueCount}
                </p>
                <p className="mt-1 text-xs text-amber-600">Past target date</p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0c4b80]">
                  Clinical Decisions
                </span>
                <p className="mt-2 text-3xl font-extrabold text-[#0c4b80]">
                  Authoritative
                </p>
                <p className="mt-1 text-xs text-slate-500">Doctor sole clinical sign-off</p>
              </div>
            </div>

            {/* Upcoming Consultations Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Upcoming Patient Consultations
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chronological list of scheduled doctor follow-ups.
                  </p>
                </div>
                <button
                  onClick={() => setSection("logs")}
                  className="text-xs font-semibold text-[#0c4b80] hover:underline"
                >
                  View All Orders &rarr;
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {followups.slice(0, 5).map((fo) => (
                  <div
                    key={fo.id}
                    className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                        {fo.initials}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {fo.patientName}
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            {fo.patientIdentifier}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{relativeDay(fo.appointmentDate)}</span>
                          <span>•</span>
                          <span className="capitalize">{fo.mode} visit</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedFollowup(fo)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Receipt Slip
                      </button>
                      <button
                        onClick={() => {
                          setActionTarget(fo);
                          setActionType("complete");
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Patient Follow-Up Orders (Logs) */}
        {section === "logs" && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient name or ID..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs outline-none focus:border-slate-400 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Mode:</span>
                <button
                  onClick={() => setModeFilter("all")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                    modeFilter === "all"
                      ? "bg-[#0c4b80] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setModeFilter("online")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                    modeFilter === "online"
                      ? "bg-[#0c4b80] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setModeFilter("in_person")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                    modeFilter === "in_person"
                      ? "bg-[#0c4b80] text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  In-Person
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Patient Details</th>
                      <th className="px-4 py-3.5">Severity</th>
                      <th className="px-4 py-3.5">Target Date</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Mode</th>
                      <th className="px-6 py-3.5 text-right">Doctor Clinical Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredFollowups.map((fo) => (
                      <tr key={fo.id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                              {fo.initials}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {fo.patientName}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">
                                {fo.patientIdentifier}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              fo.severity === "high" || fo.severity === "severe"
                                ? "bg-rose-50 text-rose-700"
                                : fo.severity === "moderate"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {fo.severity}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">
                          {fo.appointmentDate}
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {relativeDay(fo.appointmentDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                            {fo.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 capitalize text-slate-600">
                          {fo.mode}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedFollowup(fo)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Receipt
                            </button>
                            <button
                              onClick={() => {
                                setActionTarget(fo);
                                setActionType("reschedule");
                                setActionDate(fo.appointmentDate);
                              }}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-[#0c4b80] hover:bg-blue-100"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => {
                                setActionTarget(fo);
                                setActionType("complete");
                              }}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                            >
                              Sign Off
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredFollowups.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          No follow-up orders match the current criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Calendar Distance View */}
        {section === "calendar" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Timeline &amp; Day Distance Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clinical appointments organized by proximity to today.
              </p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {["Today", "Tomorrow", "Next 7 Days"].map((bucket, idx) => (
                  <div
                    key={bucket}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                  >
                    <span className="text-xs font-bold text-slate-900 uppercase">
                      {bucket}
                    </span>
                    <div className="mt-3 space-y-2">
                      {followups
                        .slice(idx * 3, idx * 3 + 3)
                        .map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-2xs"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-900">
                                {f.patientName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {f.patientIdentifier}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Date: {f.appointmentDate} · Mode: {f.mode}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Approvals */}
        {section === "approvals" && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Assistant Doctor Verification Requests
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review proposed follow-up orders submitted by assistant doctors.
                Doctor authorization is clinically mandatory.
              </p>

              <div className="mt-6 divide-y divide-slate-100">
                {followups.slice(0, 3).map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {f.patientName}
                        </span>
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          Pending Doctor Authorization
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Proposed Follow-Up: {f.appointmentDate} · Severity:{" "}
                        {f.severity}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActionTarget(f);
                          setActionType("complete");
                        }}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Authorize Order
                      </button>
                      <button
                        onClick={() => {
                          setActionTarget(f);
                          setActionType("reschedule");
                          setActionDate(f.appointmentDate);
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Revise Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Patient Receipt Modal */}
      {selectedFollowup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
                  {selectedFollowup.initials}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Patient Consultation Receipt
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authoritative Hospital Clinical Record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFollowup(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">Follow-Up ID</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedFollowup.id}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">Patient Identifier</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedFollowup.patientIdentifier}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">Patient Name</span>
                <span className="font-semibold text-slate-900">
                  {selectedFollowup.patientName}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">Scheduled Date</span>
                <span className="font-semibold text-slate-900">
                  {selectedFollowup.appointmentDate} (
                  {relativeDay(selectedFollowup.appointmentDate)})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-400">Clinical Severity</span>
                <span className="font-bold uppercase text-slate-900">
                  {selectedFollowup.severity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Order Revision</span>
                <span className="font-semibold text-slate-900">
                  Rev. {selectedFollowup.revision}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedFollowup(null)}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Action Modal: Reschedule / Complete / Cancel */}
      {actionTarget && actionType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0c4b80]">
                  Clinical Order Decision
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900 capitalize">
                  {actionType} Follow-Up
                </h3>
              </div>
              <button
                onClick={() => setActionTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteAction} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Patient: <strong>{actionTarget.patientName}</strong> (
                {actionTarget.patientIdentifier})
              </p>

              {actionType === "reschedule" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    New Target Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={actionDate}
                    onChange={(e) => setActionDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Doctor's Clinical Notes / Justification
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Record physician clinical justification..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActionTarget(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className="rounded-xl bg-[#0c4b80] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#08355c] disabled:opacity-50"
                >
                  {processingAction ? "Processing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
