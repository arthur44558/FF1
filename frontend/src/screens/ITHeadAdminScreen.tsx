import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listUsers,
  listRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  revokeUserAccess,
  restoreUserAccess,
} from "../api/auth";
import { listAuditEvents } from "../api/policies";
import type {
  AuditEventOut,
  RegistrationRequestOut,
  UserOut,
} from "../types/api";

type AccountStatus = "Active" | "Access Revoked";

interface DisplayAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  systemId: string;
  department: string;
  status: AccountStatus;
  initials: string;
}

const rolePrefix: Record<string, string> = {
  doctor: "DOC",
  Doctor: "DOC",
  assistant_verifier: "AST",
  "Assistant Doctor": "AST",
  clinic_supervisor: "HD",
  "Staff Head": "HD",
  followup_coordinator: "STF",
  Staff: "STF",
  receptionist: "RCP",
  Receptionist: "RCP",
  system_admin: "ITH",
  "IT Head": "ITH",
  auditor: "AUD",
  Auditor: "AUD",
};

function formatRoleLabel(role: string): string {
  switch (role) {
    case "doctor":
      return "Doctor";
    case "assistant_verifier":
      return "Assistant Doctor";
    case "clinic_supervisor":
      return "Staff Head";
    case "followup_coordinator":
      return "Staff";
    case "receptionist":
      return "Receptionist";
    case "system_admin":
      return "IT Head";
    case "auditor":
      return "Auditor";
    default:
      return role;
  }
}

function getInitials(name: string): string {
  if (!name) return "CT";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "purple";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    purple: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ITHeadAdminScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"accounts" | "requests" | "logs">("accounts");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accounts, setAccounts] = useState<DisplayAccount[]>([]);
  const [requests, setRequests] = useState<RegistrationRequestOut[]>([]);
  const [logs, setLogs] = useState<AuditEventOut[]>([]);
  const [, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [revokeTarget, setRevokeTarget] = useState<DisplayAccount | null>(null);
  const [approveTarget, setApproveTarget] = useState<RegistrationRequestOut | null>(null);
  const [reason, setReason] = useState("");
  const [allottedId, setAllottedId] = useState("");
  const [notice, setNotice] = useState("");

  const refreshData = async () => {
    try {
      setLoading(true);
      const [usersData, requestsData, auditData] = await Promise.all([
        listUsers(),
        listRegistrationRequests(),
        listAuditEvents({ limit: 50 }),
      ]);

      const displayAccounts: DisplayAccount[] = usersData.map((u: UserOut) => ({
        id: u.id,
        name: u.username,
        email: u.work_email || `${u.username.toLowerCase().replace(/\s+/g, ".")}@caretrack.health`,
        role: formatRoleLabel(u.role),
        systemId: u.system_identifier || `USR-${u.id.slice(0, 4).toUpperCase()}`,
        department: u.facility_id ? "CareTrack Hospital" : "Clinical Ops",
        status: u.is_active && u.status === "active" ? "Active" : "Access Revoked",
        initials: getInitials(u.username),
      }));

      setAccounts(displayAccounts);
      setRequests(requestsData);
      setLogs(auditData.items);
    } catch (err: any) {
      console.error("Failed to load IT admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const query = search.toLowerCase();
      const matchesQuery =
        !query ||
        `${account.name} ${account.email} ${account.systemId}`
          .toLowerCase()
          .includes(query);
      const matchesRole =
        roleFilter === "All roles" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "All status" || account.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [accounts, roleFilter, search, statusFilter]);

  const openApproval = (request: RegistrationRequestOut) => {
    setApproveTarget(request);
    const prefix = rolePrefix[request.requested_role] || "USR";
    setAllottedId(`${prefix}-${Math.floor(1000 + Math.random() * 8999)}`);
  };

  const handleRevoke = async () => {
    if (!revokeTarget || !reason.trim()) return;
    try {
      await revokeUserAccess(revokeTarget.id);
      setNotice(`Access revoked for ${revokeTarget.name}`);
      setRevokeTarget(null);
      setReason("");
      refreshData();
    } catch (err: any) {
      alert("Failed to revoke access: " + (err.message || "Unknown error"));
    }
  };

  const handleRestore = async (account: DisplayAccount) => {
    try {
      await restoreUserAccess(account.id);
      setNotice(`Access restored for ${account.name}`);
      refreshData();
    } catch (err: any) {
      alert("Failed to restore access: " + (err.message || "Unknown error"));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget || !allottedId.trim()) return;
    try {
      await approveRegistrationRequest(approveTarget.id);
      setNotice(`${approveTarget.full_name} is now active with ID ${allottedId.trim().toUpperCase()}`);
      setApproveTarget(null);
      setTab("accounts");
      refreshData();
    } catch (err: any) {
      alert("Failed to approve request: " + (err.message || "Unknown error"));
    }
  };

  const handleReject = async (request: RegistrationRequestOut) => {
    const rejectReason = prompt("Reason for rejection:") || "Administrative decision";
    try {
      await rejectRegistrationRequest(request.id, rejectReason);
      setNotice(`Request from ${request.full_name} rejected`);
      refreshData();
    } catch (err: any) {
      alert("Failed to reject request: " + (err.message || "Unknown error"));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12 lg:py-8">
        {/* Top Header */}
        <header className="flex flex-col gap-6 border-b border-slate-200 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex items-center gap-3.5">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Open access menu"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Menu className="size-5" />
            </button>
            {menuOpen && (
              <div
                className="absolute left-0 top-14 z-40 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
                role="menu"
              >
                <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Access control
                </p>
                <button
                  role="menuitem"
                  onClick={() => {
                    setTab("accounts");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <UserRound className="mt-0.5 size-4 text-slate-500" />
                  <span>
                    <strong className="block text-xs font-semibold text-slate-800">
                      Current accounts
                    </strong>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      Review users and revoke access
                    </span>
                  </span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setTab("requests");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <ClipboardCheck className="mt-0.5 size-4 text-slate-500" />
                  <span>
                    <strong className="block text-xs font-semibold text-slate-800">
                      Approve access requests ({requests.length})
                    </strong>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      Review new account request logs
                    </span>
                  </span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setTab("logs");
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <FileCheck2 className="mt-0.5 size-4 text-slate-500" />
                  <span>
                    <strong className="block text-xs font-semibold text-slate-800">
                      Activity logs
                    </strong>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      See recent actions by all users
                    </span>
                  </span>
                </button>
              </div>
            )}
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                CareTrack / Security control
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                IT Head — Account Management &amp; Security Control
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              <span className="font-mono font-bold text-slate-900">
                {user?.system_identifier || "ITH-001"}
              </span>
              <span className="text-slate-400">|</span>
              <span>{user?.username}</span>
            </div>
            {onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Landing Page
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Section Heading & Subnav */}
        <section className="flex flex-col gap-1 pb-6 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">
              Workspace /{" "}
              {tab === "accounts"
                ? "Access control"
                : tab === "requests"
                ? "Provisioning queue"
                : "Audit trail"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {tab === "accounts"
                ? "Current accounts"
                : tab === "requests"
                ? `New account requests (${requests.length})`
                : "Activity logs"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "accounts"
                ? "Review active identities and manage system access across CareTrack."
                : tab === "requests"
                ? "Verify registration details and provision secure system identities."
                : "Review recent actions across every CareTrack user and role."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="size-2 rounded-full bg-emerald-500" /> System operational{" "}
            <span className="mx-1 text-slate-300">•</span> Authoritative FastAPI Backend
          </div>
        </section>

        {notice && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              {notice}
            </span>
            <button
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Main Content by Tab */}
        {tab === "logs" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent actions &amp; audit events
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Immutable event log recorded by FastAPI security engine.
                </p>
              </div>
              <Badge tone="green">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Live audit trail
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Event ID</th>
                    <th className="px-4 py-3.5 font-semibold">Action</th>
                    <th className="px-4 py-3.5 font-semibold">Entity</th>
                    <th className="px-4 py-3.5 font-semibold">Entity ID</th>
                    <th className="px-4 py-3.5 font-semibold">Actor ID</th>
                    <th className="px-5 py-3.5 font-semibold">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">
                        {log.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-900">{log.action}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {log.entity_type}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                        {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600">
                        {log.actor_user_id ? `${log.actor_user_id.slice(0, 8)}...` : "Public / System"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {new Date(log.occurred_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === "accounts" ? (
          <>
            <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_180px_180px]">
              <label className="relative block">
                <span className="sr-only">Search accounts</span>
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or system ID"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </label>
              <label className="relative">
                <span className="sr-only">Filter by role</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-600 outline-none focus:border-slate-400"
                >
                  <option>All roles</option>
                  <option>Doctor</option>
                  <option>Assistant Doctor</option>
                  <option>Staff Head</option>
                  <option>Staff</option>
                  <option>Receptionist</option>
                  <option>IT Head</option>
                  <option>Auditor</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              </label>
              <label className="relative">
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-600 outline-none focus:border-slate-400"
                >
                  <option>All status</option>
                  <option>Active</option>
                  <option>Access Revoked</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Identity directory
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {filteredAccounts.length} of {accounts.length} accounts shown
                  </p>
                </div>
                <Badge tone="green">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Live directory
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">User / work email</th>
                      <th className="px-4 py-3.5 font-semibold">Role</th>
                      <th className="px-4 py-3.5 font-semibold">System ID</th>
                      <th className="px-4 py-3.5 font-semibold">Department / specialty</th>
                      <th className="px-4 py-3.5 font-semibold">Access status</th>
                      <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
                              {account.initials}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {account.name}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {account.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            tone={
                              account.role === "Doctor"
                                ? "purple"
                                : account.role === "IT Head"
                                ? "amber"
                                : "neutral"
                            }
                          >
                            {account.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-600">
                          {account.systemId}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {account.department}
                        </td>
                        <td className="px-4 py-4">
                          {account.status === "Active" ? (
                            <Badge tone="green">
                              <Check className="size-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge tone="red">
                              <XCircle className="size-3" />
                              Access Revoked
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {account.status === "Active" ? (
                            <button
                              onClick={() => setRevokeTarget(account)}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                            >
                              Revoke access
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(account)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Restore access
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                          No accounts match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* Tab: Requests Queue */
          <div className="grid gap-4">
            {requests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-500" />
                <h3 className="mt-3 font-semibold text-slate-900">Queue is clear</h3>
                <p className="mt-1 text-sm text-slate-500">
                  There are no pending account registration requests.
                </p>
              </div>
            ) : (
              requests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                        {getInitials(request.full_name)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {request.full_name}
                          </h3>
                          {request.certification_agreed ? (
                            <Badge tone="green">
                              <FileCheck2 className="size-3" />
                              Certified Authorization
                            </Badge>
                          ) : (
                            <Badge tone="amber">
                              <AlertTriangle className="size-3" />
                              Pending review
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {request.work_email}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                          <span>
                            <strong className="font-semibold text-slate-700">
                              Requested role:
                            </strong>{" "}
                            {formatRoleLabel(request.requested_role)}
                          </span>
                          <span>
                            <strong className="font-semibold text-slate-700">
                              Department:
                            </strong>{" "}
                            {request.department}
                          </span>
                          <span>
                            <strong className="font-semibold text-slate-700">
                              Submitted:
                            </strong>{" "}
                            {new Date(request.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 pt-4 xl:border-0 xl:pt-0">
                      <button
                        onClick={() => openApproval(request)}
                        className="flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Allot ID &amp; approve <ArrowRight className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleReject(request)}
                        className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        <footer className="mt-10 flex items-center justify-between border-t border-slate-200 pt-5 text-[11px] text-slate-400">
          <span>
            CareTrack Platform <span className="mx-1">•</span> Security operations
          </span>
          <span className="flex items-center gap-1.5">
            <ClipboardCheck className="size-3.5" /> All administrative actions are audit logged
          </span>
        </footer>
      </div>

      {/* Revoke Modal */}
      {revokeTarget && (
        <Modal
          eyebrow="Access control / Confirmation"
          title="Revoke account access"
          onClose={() => {
            setRevokeTarget(null);
            setReason("");
          }}
        >
          <div className="mt-5 rounded-lg bg-rose-50 p-3.5 text-sm text-rose-800">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                You are revoking access for <strong>{revokeTarget.name}</strong> (
                {revokeTarget.systemId}). This will immediately disable their CareTrack sign-in.
              </p>
            </div>
          </div>
          <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="reason">
            Reason for revocation <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter a clear reason for the audit log..."
            rows={4}
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => {
                setRevokeTarget(null);
                setReason("");
              }}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={!reason.trim()}
              onClick={handleRevoke}
              className="rounded-lg bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-rose-700"
            >
              Confirm revoke
            </button>
          </div>
        </Modal>
      )}

      {/* Approve Modal */}
      {approveTarget && (
        <Modal
          eyebrow="Provisioning / New identity"
          title="Allot system ID & approve"
          onClose={() => setApproveTarget(null)}
        >
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Assign a unique identity to{" "}
            <strong className="text-slate-800">{approveTarget.full_name}</strong>. They
            will be able to sign in as soon as the account is activated.
          </p>
          <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="system-id">
            Generated Unique ID
          </label>
          <div className="relative mt-2">
            <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="system-id"
              value={allottedId}
              onChange={(e) => setAllottedId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 font-mono text-sm uppercase outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Format: {rolePrefix[approveTarget.requested_role] || "USR"}-XXXX · ID can be edited before approval.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setApproveTarget(null)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={!allottedId.trim()}
              onClick={handleApprove}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-emerald-700"
            >
              <Check className="size-4" />
              Approve &amp; activate
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
