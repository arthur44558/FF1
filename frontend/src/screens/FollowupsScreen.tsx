import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Filter,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import {
  listFollowups,
  getFollowup,
  amendFollowup,
  rescheduleFollowup,
  completeFollowup,
  cancelFollowup,
  resolveFollowupContact,
  supersedeFollowup,
} from "../api/followups";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { EmptyState } from "../components/common/EmptyState";
import type {
  CancelIn,
  CompleteIn,
  ContactResolveIn,
  FollowupAmendmentIn,
  FollowupDetail,
  FollowupOut,
  RescheduleIn,
  Severity,
  SupersedeIn,
} from "../types/api";

interface FollowupsScreenProps {
  initialSelectedId?: string;
  initialOverdue?: boolean;
}

export const FollowupsScreen: React.FC<FollowupsScreenProps> = ({
  initialSelectedId,
  initialOverdue,
}) => {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();

  const [followups, setFollowups] = useState<FollowupOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [overdueFilter, setOverdueFilter] = useState<boolean | undefined>(
    initialOverdue ? true : undefined
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Detail Modal
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || null);
  const [detailData, setDetailData] = useState<FollowupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action Dialog States
  const [actionType, setActionType] = useState<
    "amend" | "reschedule" | "complete" | "cancel" | "resolve-contact" | "supersede" | null
  >(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Action Form Inputs
  const [amendSeverity, setAmendSeverity] = useState<Severity>("normal");
  const [amendDate, setAmendDate] = useState("");
  const [amendReason, setAmendReason] = useState("");

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  const [completeOutcome, setCompleteOutcome] = useState("attended_visit");
  const [completeDate, setCompleteDate] = useState("");

  const [cancelReason, setCancelReason] = useState("");
  const [resolveReason, setResolveReason] = useState("Verified telephone contact registered and opted in");

  const [supersedeId, setSupersedeId] = useState("");
  const [supersedeReason, setSupersedeReason] = useState("");

  const loadFollowupsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFollowups({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        overdue: overdueFilter,
        limit: 100,
      });
      setFollowups(res.items);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, overdueFilter]);

  useEffect(() => {
    loadFollowupsList();
  }, [loadFollowupsList]);

  const loadFollowupDetails = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await getFollowup(id);
      setDetailData(res);
      // Pre-fill fields for actions
      if (res.followup.severity) setAmendSeverity(res.followup.severity);
      if (res.followup.scheduled_at) {
        const d = new Date(res.followup.scheduled_at).toISOString().slice(0, 16);
        setAmendDate(d);
        setRescheduleDate(d);
      }
    } catch (err: any) {
      addToast("error", err.message || "Failed to load follow-up details");
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (selectedId) {
      loadFollowupDetails(selectedId);
    } else {
      setDetailData(null);
    }
  }, [selectedId, loadFollowupDetails]);

  // Execute Action
  const handleExecuteAction = async () => {
    if (!detailData) return;
    const fo = detailData.followup;
    setActionSubmitting(true);
    try {
      if (actionType === "amend") {
        const payload: FollowupAmendmentIn = {
          severity: amendSeverity,
          scheduled_at: new Date(amendDate).toISOString(),
          expected_revision: fo.revision,
          reason: amendReason,
        };
        await amendFollowup(fo.id, payload);
        addToast("success", "Follow-up amended successfully.", "Amendment Recorded");
      } else if (actionType === "reschedule") {
        const payload: RescheduleIn = {
          scheduled_at: new Date(rescheduleDate).toISOString(),
          expected_revision: fo.revision,
          reason: rescheduleReason,
        };
        await rescheduleFollowup(fo.id, payload);
        addToast("success", "Follow-up appointment rescheduled.", "Reschedule Success");
      } else if (actionType === "complete") {
        const payload: CompleteIn = {
          outcome_category: completeOutcome,
          completed_at: completeDate ? new Date(completeDate).toISOString() : null,
        };
        await completeFollowup(fo.id, payload);
        addToast("success", "Follow-up order marked completed.", "Clinical Completion");
      } else if (actionType === "cancel") {
        const payload: CancelIn = {
          reason: cancelReason,
        };
        await cancelFollowup(fo.id, payload);
        addToast("info", "Follow-up order cancelled.", "Order Cancelled");
      } else if (actionType === "resolve-contact") {
        const payload: ContactResolveIn = {
          reason: resolveReason,
        };
        await resolveFollowupContact(fo.id, payload);
        addToast("success", "Contact resolution completed.", "Status Active");
      } else if (actionType === "supersede") {
        const payload: SupersedeIn = {
          replacement_followup_id: supersedeId,
          reason: supersedeReason,
        };
        await supersedeFollowup(fo.id, payload);
        addToast("info", "Follow-up superseded by replacement order.", "Order Superseded");
      }

      setActionType(null);
      await loadFollowupDetails(fo.id);
      await loadFollowupsList();
    } catch (err: any) {
      addToast("error", err.message || "Action failed");
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredFollowups = followups.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.patient_identifier.toLowerCase().includes(q) ||
      (f.patient_display_name && f.patient_display_name.toLowerCase().includes(q)) ||
      f.external_encounter_identifier.toLowerCase().includes(q)
    );
  });

  const isAuthoringDoctor =
    user?.role === "doctor" && detailData?.followup.clinician_user_id === user.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Follow-Up Management</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Active follow-up orders, reminder schedules, and clinical lifecycle actions. Completion requires validated return visit evidence.
          </p>
        </div>
        <button
          type="button"
          onClick={loadFollowupsList}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e0e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <ErrorBanner error={error} onRetry={loadFollowupsList} />}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-[#d8e0e7] shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 text-[#788ca0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient ID, name, encounter..."
            className="w-full rounded-xl border border-[#d8e0e7] pl-9 pr-3.5 py-1.5 text-xs text-[#17212b] focus:border-[#0c4b80] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[#788ca0]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="contact_resolution_required">Contact Resolution Required</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="superseded">Superseded</option>
            <option value="not_required">Not Required</option>
          </select>
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-xl border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
        >
          <option value="">All Severities</option>
          <option value="normal">Normal</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
        </select>

        <button
          type="button"
          onClick={() => setOverdueFilter((prev) => (prev ? undefined : true))}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
            overdueFilter
              ? "bg-[#fee2e2] text-[#dc2626] border-[#fca5a5]"
              : "bg-white text-[#516d89] border-[#d8e0e7] hover:bg-[#f7faff]"
          }`}
        >
          {overdueFilter ? "✓ Overdue Only" : "Overdue Only"}
        </button>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-[#d8e0e7] bg-white shadow-xs overflow-hidden">
        {loading && followups.length === 0 ? (
          <LoadingSpinner message="Loading follow-up orders..." />
        ) : filteredFollowups.length === 0 ? (
          <EmptyState
            title="No Follow-Up Orders Found"
            description="No follow-up orders matched your filters. Verify a new scan or adjust search criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#eaf0f6] bg-[#f9fbfe] text-[11px] font-bold text-[#45627f] uppercase tracking-wider">
                  <th className="py-3 px-4">Patient Identifier</th>
                  <th className="py-3 px-4">Encounter</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f4f8]">
                {filteredFollowups.map((fo) => (
                  <tr
                    key={fo.id}
                    className={`hover:bg-[#f8fbfe] transition ${
                      fo.overdue ? "bg-[#fff8f8]" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-[#183d63]">
                        {fo.patient_identifier}
                      </div>
                      {fo.patient_display_name && (
                        <div className="text-[11px] text-[#788ca0] truncate max-w-[180px]">
                          {fo.patient_display_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#516d89]">
                      {fo.external_encounter_identifier}
                    </td>
                    <td className="py-3.5 px-4">
                      {fo.severity ? (
                        <Badge variant={fo.severity} size="sm">
                          {fo.severity}
                        </Badge>
                      ) : (
                        <span className="text-[#788ca0]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-[#788ca0]" />
                        <span className={fo.overdue ? "font-bold text-[#dc2626]" : "text-[#183d63]"}>
                          {fo.scheduled_at
                            ? new Date(fo.scheduled_at).toLocaleDateString()
                            : "No date"}
                        </span>
                        {fo.overdue && (
                          <Badge variant="severe" size="sm">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          fo.status === "active"
                            ? "active"
                            : fo.status === "completed"
                            ? "completed"
                            : fo.status === "contact_resolution_required"
                            ? "moderate"
                            : "default"
                        }
                        size="sm"
                      >
                        {fo.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(fo.id)}
                        className="rounded-full bg-[#0c4b80] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#08355c] transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Follow-up Detail Modal / Drawer */}
      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c2338]/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7] max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="absolute right-4 top-4 text-[#8b9996] hover:text-[#183d63] transition"
            >
              <XCircle className="size-5" />
            </button>

            {detailLoading || !detailData ? (
              <LoadingSpinner message="Loading order details and schedule..." />
            ) : (
              <div className="space-y-6">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-[#eaf0f6] pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#788ca0]">
                      Follow-up Order
                    </span>
                    <h2 className="text-lg font-bold text-[#183d63] flex items-center gap-2">
                      <span>{detailData.followup.patient_identifier}</span>
                      <Badge variant={detailData.followup.severity || "default"}>
                        {detailData.followup.severity || "N/A"}
                      </Badge>
                    </h2>
                    <p className="text-xs text-[#667c91]">
                      Encounter: <span className="font-mono">{detailData.followup.external_encounter_identifier}</span> | Revision: {detailData.followup.revision}
                    </p>
                  </div>
                  <Badge
                    variant={
                      detailData.followup.status === "active"
                        ? "active"
                        : detailData.followup.status === "completed"
                        ? "completed"
                        : "default"
                    }
                  >
                    {detailData.followup.status}
                  </Badge>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#f8fbfe] p-4 rounded-xl border border-[#e2ebf3]">
                  <div>
                    <span className="text-[#788ca0] block">Scheduled At:</span>
                    <span className="font-bold text-[#183d63]">
                      {detailData.followup.scheduled_at
                        ? new Date(detailData.followup.scheduled_at).toLocaleString()
                        : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#788ca0] block">Contact Status:</span>
                    <span className="font-medium text-[#183d63]">
                      {detailData.followup.contact_resolution_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#788ca0] block">Activated At:</span>
                    <span className="text-[#516d89]">
                      {detailData.followup.activated_at
                        ? new Date(detailData.followup.activated_at).toLocaleString()
                        : "Not activated"}
                    </span>
                  </div>
                </div>

                {/* Permitted Lifecycle Action Buttons */}
                <div className="rounded-xl border border-[#d8e0e7] p-4 bg-[#fafcff]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#45627f] mb-3">
                    Authorized Lifecycle Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {/* Amend (Doctor who authored) */}
                    {hasPermission("followup:amend") && isAuthoringDoctor && (
                      <button
                        type="button"
                        onClick={() => setActionType("amend")}
                        className="rounded-full bg-[#0c4b80] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#08355c] transition"
                      >
                        Amend Severity / Date
                      </button>
                    )}

                    {/* Reschedule (Doctor who authored) */}
                    {hasPermission("followup:amend") && isAuthoringDoctor && (
                      <button
                        type="button"
                        onClick={() => setActionType("reschedule")}
                        className="rounded-full border border-[#0c4b80] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0c4b80] hover:bg-[#edf5fb] transition"
                      >
                        Reschedule Appointment
                      </button>
                    )}

                    {/* Complete (Doctor who authored, Coordinator, Supervisor) */}
                    {hasPermission("followup:complete") && (
                      <button
                        type="button"
                        onClick={() => setActionType("complete")}
                        className="rounded-full bg-[#157347] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0e5c36] transition"
                      >
                        Mark Completed (Evidence-Based)
                      </button>
                    )}

                    {/* Resolve Contact (Coordinator / Supervisor) */}
                    {hasPermission("contact:resolve") &&
                      detailData.followup.status === "contact_resolution_required" && (
                        <button
                          type="button"
                          onClick={() => setActionType("resolve-contact")}
                          className="rounded-full bg-[#c94e08] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#b84600] transition"
                        >
                          Resolve Contact Gate
                        </button>
                      )}

                    {/* Cancel (Doctor who authored, Supervisor) */}
                    {hasPermission("followup:cancel") && (
                      <button
                        type="button"
                        onClick={() => setActionType("cancel")}
                        className="rounded-full border border-red-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                      >
                        Cancel Order
                      </button>
                    )}

                    {/* Supersede (Doctor who authored) */}
                    {hasPermission("followup:amend") && isAuthoringDoctor && (
                      <button
                        type="button"
                        onClick={() => setActionType("supersede")}
                        className="rounded-full border border-[#788ca0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
                      >
                        Supersede with New Order
                      </button>
                    )}
                  </div>
                </div>

                {/* Generated Schedule Timeline */}
                <div>
                  <h3 className="text-xs font-bold text-[#183d63] mb-2 flex items-center justify-between">
                    <span>Reminder Schedule (Policy Driven)</span>
                    <span className="text-[11px] font-normal text-[#788ca0]">
                      {detailData.schedule.length} job(s)
                    </span>
                  </h3>
                  {detailData.schedule.length === 0 ? (
                    <p className="text-xs text-[#788ca0] italic p-3 bg-gray-50 rounded-lg">
                      No reminder schedule created (e.g. follow-up not required or pending activation).
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detailData.schedule.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2ebf3] bg-[#fdfefe] text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="grid size-6 place-items-center rounded-full bg-[#edf5fb] text-[#0c4b80] font-bold text-[11px]">
                              {job.sequence_no}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#183d63] uppercase">
                                  {job.action_kind}
                                </span>
                                <span className="text-[11px] text-[#788ca0]">
                                  via {job.channel}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#667c91]">
                                Scheduled: {new Date(job.scheduled_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {job.suppression_reason && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                {job.suppression_reason}
                              </span>
                            )}
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit History Log */}
                <div>
                  <h3 className="text-xs font-bold text-[#183d63] mb-2">Order Audit History</h3>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs divide-y divide-[#f0f4f8]">
                    {detailData.audit_history.map((ev) => (
                      <div key={ev.id} className="pt-1.5 first:pt-0">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-[#0c4b80]">{ev.action}</span>
                          <span className="text-[#788ca0]">
                            {new Date(ev.occurred_at).toLocaleString()}
                          </span>
                        </div>
                        {ev.reason && (
                          <p className="text-[11px] text-[#516d89]">Reason: {ev.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Dialog Form Modal */}
      {actionType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1 capitalize">
              {actionType.replace("-", " ")} Follow-Up
            </h3>
            <p className="text-xs text-[#667c91] mb-4">
              Enter required validation fields according to clinic governance.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteAction();
              }}
              className="space-y-3.5"
            >
              {actionType === "amend" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      New Severity
                    </label>
                    <select
                      value={amendSeverity}
                      onChange={(e) => setAmendSeverity(e.target.value as Severity)}
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    >
                      <option value="normal">Normal</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      New Scheduled Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={amendDate}
                      onChange={(e) => setAmendDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Amendment Reason
                    </label>
                    <input
                      type="text"
                      value={amendReason}
                      onChange={(e) => setAmendReason(e.target.value)}
                      required
                      minLength={3}
                      placeholder="e.g. Clinical assessment adjusted"
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                </>
              )}

              {actionType === "reschedule" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      New Appointment Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Reschedule Reason
                    </label>
                    <input
                      type="text"
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      required
                      minLength={3}
                      placeholder="e.g. Patient requested appointment shift"
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                </>
              )}

              {actionType === "complete" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Completion Outcome Category
                    </label>
                    <select
                      value={completeOutcome}
                      onChange={(e) => setCompleteOutcome(e.target.value)}
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    >
                      <option value="attended_visit">Patient Attended Return Visit</option>
                      <option value="staff_confirmed">Staff Confirmed Offsite Resolution</option>
                      <option value="clinical_review">Clinician Authoritative Completion</option>
                      <option value="external_care">Transferred to External Facility</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Completed At (optional, defaults to now)
                    </label>
                    <input
                      type="datetime-local"
                      value={completeDate}
                      onChange={(e) => setCompleteDate(e.target.value)}
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                </>
              )}

              {actionType === "cancel" && (
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Cancellation Reason
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                    minLength={3}
                    placeholder="e.g. Order cancelled by clinician due to duplicate entry"
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>
              )}

              {actionType === "resolve-contact" && (
                <div>
                  <label className="text-xs font-bold text-[#45627f] block mb-1">
                    Contact Resolution Justification
                  </label>
                  <input
                    type="text"
                    value={resolveReason}
                    onChange={(e) => setResolveReason(e.target.value)}
                    required
                    minLength={3}
                    className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                  />
                </div>
              )}

              {actionType === "supersede" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Replacement Follow-Up Order UUID
                    </label>
                    <input
                      type="text"
                      value={supersedeId}
                      onChange={(e) => setSupersedeId(e.target.value)}
                      required
                      placeholder="e.g. c8f1..."
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#45627f] block mb-1">
                      Supersession Reason
                    </label>
                    <input
                      type="text"
                      value={supersedeReason}
                      onChange={(e) => setSupersedeReason(e.target.value)}
                      required
                      minLength={3}
                      className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                    />
                  </div>
                </>
              )}

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  disabled={actionSubmitting}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="rounded-full bg-[#c94e08] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#b84600] disabled:opacity-50"
                >
                  {actionSubmitting ? "Executing..." : "Confirm Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
