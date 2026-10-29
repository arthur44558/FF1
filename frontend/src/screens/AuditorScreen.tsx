import { useState } from "react";
import {
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listAuditEvents } from "../api/policies";
import type { AuditEventOut } from "../types/api";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { LiveStatusPill } from "../components/common/LiveStatusPill";

export function AuditorScreen({ onGoHome }: { onGoHome?: () => void }) {
  const { user, logout } = useAuth();

  const [logs, setLogs] = useState<AuditEventOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const events = await listAuditEvents({ limit: 100 });
      setLogs(events.items);
    } catch (err: any) {
      console.error("Failed to load auditor data", err);
    } finally {
      setLoading(false);
    }
  };

  const { formattedLastUpdated, isRefreshing, refreshNow, refreshError } =
    useLiveRefresh({
      onRefresh: loadData,
      intervalMs: 12000,
      enabled: Boolean(user),
    });

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      log.action.toLowerCase().includes(q) ||
      log.entity_type.toLowerCase().includes(q) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(q));

    const matchesEntity =
      entityFilter === "all" || log.entity_type === entityFilter;

    return matchesSearch && matchesEntity;
  });

  const uniqueEntities = Array.from(new Set(logs.map((l) => l.entity_type)));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-16">
      {/* Top Banner / Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0c4b80] text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-slate-900">
                  CareTrack
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Compliance &amp; Audit
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Authoritative System Governance &amp; Traceability
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
                {user?.system_identifier || "AUD-001"}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Hospital Compliance &amp; Immutable Audit Trail
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Read-only inspection of all clinical decisions, outreach events,
              and security operations.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Audit Log</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action or entity..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="all">All Entity Types</option>
              {uniqueEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Event ID</th>
                  <th className="px-4 py-3.5">Action Executed</th>
                  <th className="px-4 py-3.5">Entity Type</th>
                  <th className="px-4 py-3.5">Entity ID</th>
                  <th className="px-4 py-3.5">Actor User</th>
                  <th className="px-6 py-3.5 text-right">Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {log.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 uppercase">
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-600">
                      {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : "—"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {log.actor_user_id ? `${log.actor_user_id.slice(0, 8)}...` : "System / Public"}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {new Date(log.occurred_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No audit events match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
