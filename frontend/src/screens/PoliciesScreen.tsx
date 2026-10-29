import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
} from "lucide-react";
import {
  listPolicies,
  createPolicy,
  approvePolicy,
  activatePolicy,
  listAuditEvents,
} from "../api/policies";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import type { AuditEventOut, PolicyConfig, PolicyOut } from "../types/api";

export const PoliciesScreen: React.FC = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<"policies" | "audit">("policies");

  // Policies state
  const [policies, setPolicies] = useState<PolicyOut[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [policyError, setPolicyError] = useState<any>(null);

  // Audit state
  const [auditEvents, setAuditEvents] = useState<AuditEventOut[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<any>(null);
  const [auditEntityFilter, setAuditEntityFilter] = useState("");

  // Approve Modal
  const [approvePolicyId, setApprovePolicyId] = useState<string | null>(null);
  const [approvalRef, setApprovalRef] = useState("CLINIC-OVERSIGHT-REF-2026-001");
  const [approving, setApproving] = useState(false);

  // Create Policy Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [policyName, setPolicyName] = useState("clinic-follow-up");
  const [creating, setCreating] = useState(false);

  const loadPoliciesList = useCallback(async () => {
    if (!hasPermission("policy:read")) return;
    setLoadingPolicies(true);
    setPolicyError(null);
    try {
      const res = await listPolicies();
      setPolicies(res.items);
    } catch (err: any) {
      setPolicyError(err);
    } finally {
      setLoadingPolicies(false);
    }
  }, [hasPermission]);

  const loadAuditList = useCallback(async () => {
    if (!hasPermission("audit:read")) return;
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await listAuditEvents({
        entity_type: auditEntityFilter || undefined,
        limit: 100,
      });
      setAuditEvents(res.items);
    } catch (err: any) {
      setAuditError(err);
    } finally {
      setLoadingAudit(false);
    }
  }, [hasPermission, auditEntityFilter]);

  useEffect(() => {
    if (activeTab === "policies") {
      loadPoliciesList();
    } else {
      loadAuditList();
    }
  }, [activeTab, loadPoliciesList, loadAuditList]);

  // Handle Approve Policy (Supervisor)
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvePolicyId) return;
    setApproving(true);
    try {
      await approvePolicy(approvePolicyId, { approval_reference: approvalRef.trim() });
      addToast("success", "Policy approved.", "Supervisor Approval Recorded");
      setApprovePolicyId(null);
      await loadPoliciesList();
    } catch (err: any) {
      addToast("error", err.message || "Failed to approve policy");
    } finally {
      setApproving(false);
    }
  };

  // Handle Activate Policy (Supervisor)
  const handleActivate = async (id: string) => {
    try {
      await activatePolicy(id);
      addToast("success", "Policy activated for new follow-up schedules.", "Policy Active");
      await loadPoliciesList();
    } catch (err: any) {
      addToast("error", err.message || "Failed to activate policy");
    }
  };

  // Handle Create Draft Policy
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const config: PolicyConfig = {
        timezone: "Asia/Kolkata",
        fractions: [0.29, 0.57, 0.79, 0.86, 0.93],
        actions: {
          normal: ["message", "message", "message", "message", "message"],
          moderate: ["message", "message", "call", "call", "call"],
          severe: ["call", "call", "call", "call", "call"],
        },
        severe_initial_message: true,
        message_channel: "sms",
        template_id: "appointment_reminder_v1",
        call_script_id: "neutral_follow_up_v1",
        allowed_start: "09:00",
        allowed_end: "17:00",
        allow_shared_neutral_messages: false,
        short_interval_action: "call_task",
        overdue_priority_by_severity: false,
        provider_policy_reviewed: false,
        message_content_approval_reference: null,
      };

      await createPolicy({ name: policyName.trim(), config });
      addToast("success", "Draft policy version created.", "Draft Saved");
      setShowCreateModal(false);
      await loadPoliciesList();
    } catch (err: any) {
      addToast("error", err.message || "Failed to create policy");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Policies &amp; Immutable Audit Trail</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Versioned reminder policies and append-only database audit logs. Policy changes require supervisor sign-off and reference.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-[#edf5fb] p-1 border border-[#d8e0e7]">
            <button
              type="button"
              onClick={() => setActiveTab("policies")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "policies"
                  ? "bg-[#0c4b80] text-white shadow-xs"
                  : "text-[#516d89] hover:text-[#183d63]"
              }`}
            >
              Policies
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === "audit"
                  ? "bg-[#0c4b80] text-white shadow-xs"
                  : "text-[#516d89] hover:text-[#183d63]"
              }`}
            >
              Audit Log
            </button>
          </div>

          {activeTab === "policies" && hasPermission("policy:create") && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0c4b80] px-4 py-2 text-xs font-bold text-white hover:bg-[#08355c] transition"
            >
              <Plus className="size-3.5" />
              <span>New Policy Draft</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === "policies" ? (
        <div className="space-y-4">
          {policyError && <ErrorBanner error={policyError} onRetry={loadPoliciesList} />}

          {loadingPolicies ? (
            <LoadingSpinner message="Loading policies..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-5 shadow-xs bg-white space-y-3 ${
                    p.is_active ? "border-[#25aea8] ring-2 ring-[#25aea8]/20" : "border-[#d8e0e7]"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#eaf0f6]">
                    <div>
                      <h3 className="text-sm font-bold text-[#183d63]">
                        {p.name} (Version {p.version})
                      </h3>
                      <p className="text-[11px] text-[#788ca0]">
                        Created: {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={p.is_active ? "completed" : p.approved_at ? "info" : "moderate"}>
                      {p.is_active ? "Active" : p.approved_at ? "Approved" : "Draft"}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#788ca0]">Channel:</span>
                      <span className="font-bold text-[#183d63]">
                        {p.config?.message_channel?.toUpperCase() || "SMS"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#788ca0]">Fractions:</span>
                      <span className="font-mono text-[11px] text-[#516d89]">
                        {(p.config?.fractions || []).join(", ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#788ca0]">Approval Reference:</span>
                      <span className="text-[#183d63] font-medium">
                        {p.approval_reference || "Pending Approval"}
                      </span>
                    </div>
                  </div>

                  {/* Supervisor Actions */}
                  <div className="pt-3 border-t border-[#edf4fa] flex flex-wrap gap-2 justify-end">
                    {!p.approved_at && hasPermission("policy:approve") && (
                      <button
                        type="button"
                        onClick={() => setApprovePolicyId(p.id)}
                        className="rounded-full bg-[#0c4b80] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#08355c] transition"
                      >
                        Approve Draft
                      </button>
                    )}

                    {p.approved_at && !p.is_active && hasPermission("policy:activate") && (
                      <button
                        type="button"
                        onClick={() => handleActivate(p.id)}
                        className="rounded-full bg-[#157347] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[#0e5c36] transition"
                      >
                        Activate Policy
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Audit Log Tab */
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-[#d8e0e7]">
            <Search className="size-4 text-[#788ca0]" />
            <input
              type="text"
              value={auditEntityFilter}
              onChange={(e) => setAuditEntityFilter(e.target.value)}
              placeholder="Filter by entity type (e.g. followup_order, scan_document, patient_contact)..."
              className="flex-1 text-xs text-[#17212b] border-none focus:outline-none"
            />
            <button
              type="button"
              onClick={loadAuditList}
              className="rounded-lg bg-[#0c4b80] px-3 py-1 text-xs font-semibold text-white"
            >
              Filter
            </button>
          </div>

          {auditError && <ErrorBanner error={auditError} onRetry={loadAuditList} />}

          {loadingAudit ? (
            <LoadingSpinner message="Loading audit events..." />
          ) : (
            <div className="rounded-2xl border border-[#d8e0e7] bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#eaf0f6] bg-[#f9fbfe] text-[11px] font-bold text-[#45627f] uppercase tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Entity Type</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f4f8]">
                    {auditEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#f8fbfe] transition">
                        <td className="py-3 px-4 text-[#516d89]">
                          {new Date(ev.occurred_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#0c4b80]">
                          {ev.action}
                        </td>
                        <td className="py-3 px-4 text-[#45627f]">{ev.entity_type}</td>
                        <td className="py-3 px-4 text-[#788ca0] font-mono text-[11px]">
                          {ev.actor_type}
                        </td>
                        <td className="py-3 px-4 text-[#183d63] max-w-xs truncate">
                          {ev.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Approve Policy Modal */}
      {approvePolicyId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Supervisor Policy Approval</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Enter formal clinic oversight approval reference. Policies are immutable once approved.
            </p>

            <form onSubmit={handleApprove} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Approval Reference
                </label>
                <input
                  type="text"
                  value={approvalRef}
                  onChange={(e) => setApprovalRef(e.target.value)}
                  required
                  minLength={3}
                  placeholder="e.g. CLINIC-POLICY-REV-2026-A"
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setApprovePolicyId(null)}
                  disabled={approving}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {approving ? "Approving..." : "Confirm Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Policy Draft Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Create Policy Draft</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Creates a new draft version. Must be approved by a clinic supervisor before activation.
            </p>

            <form onSubmit={handleCreateDraft} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">
                  Policy Name
                </label>
                <input
                  type="text"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
