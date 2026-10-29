import React, { useState } from "react";
import {
  CalendarDays,
  Plus,
  LayoutDashboard,
  ScanLine,
  CalendarCheck,
  PhoneCall,
  Users,
  ShieldCheck,
  UserCog,
  LogOut,
  ChevronDown,
  Globe,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../common/Badge";
import type { Role } from "../../types/api";

export type ActiveTab =
  | "dashboard"
  | "scans"
  | "followups"
  | "reminders"
  | "patients"
  | "policies"
  | "users";

interface AppHeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onGoHome: () => void;
}

const ROLES_LIST: Array<{ role: Role; label: string; username: string }> = [
  { role: "doctor", label: "Doctor", username: "doctor" },
  { role: "assistant_verifier", label: "Assistant Verifier", username: "assistant" },
  { role: "followup_coordinator", label: "Coordinator", username: "coordinator" },
  { role: "clinic_supervisor", label: "Supervisor", username: "supervisor" },
  { role: "system_admin", label: "Admin", username: "admin" },
  { role: "auditor", label: "Auditor", username: "auditor" },
];

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  onTabChange,
  onGoHome,
}) => {
  const { user, logout, login, hasPermission } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const handleSwitchAccount = async (username: string) => {
    setRoleMenuOpen(false);
    await login(username, "CareTrack@2026");
  };

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
  }> = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-4" />,
      visible: true,
    },
    {
      id: "scans",
      label: "Scan Intake & Review",
      icon: <ScanLine className="size-4" />,
      visible: hasPermission("scan:read") || hasPermission("scan:upload"),
    },
    {
      id: "followups",
      label: "Follow-Ups",
      icon: <CalendarCheck className="size-4" />,
      visible: hasPermission("followup:read"),
    },
    {
      id: "reminders",
      label: "Reminders & Calls",
      icon: <PhoneCall className="size-4" />,
      visible: hasPermission("reminder:read_queue"),
    },
    {
      id: "patients",
      label: "Patients & Contacts",
      icon: <Users className="size-4" />,
      visible: hasPermission("patient:read"),
    },
    {
      id: "policies",
      label: "Policies & Audit",
      icon: <ShieldCheck className="size-4" />,
      visible: hasPermission("policy:read") || hasPermission("audit:read"),
    },
    {
      id: "users",
      label: "Staff Users",
      icon: <UserCog className="size-4" />,
      visible: hasPermission("user:manage"),
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#e2ebf3] bg-white shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center gap-2.5 text-left group"
          >
            <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#0c4b80] text-white">
              <CalendarDays className="size-5" strokeWidth={1.8} />
              <span className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full bg-[#0c4b80] ring-2 ring-white">
                <Plus className="size-2.5" strokeWidth={3} />
              </span>
            </span>
            <div>
              <span className="block text-base font-bold tracking-tight text-[#183d63] group-hover:text-[#0c4b80] transition">
                CareTrack
              </span>
              <span className="text-[10px] text-[#788ca0] hidden sm:block">
                Clinical Workflow
              </span>
            </div>
          </button>

          {/* Navigation tabs */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#edf5fb] text-[#0c4b80]"
                        : "text-[#516d89] hover:bg-[#f7faff] hover:text-[#183d63]"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Role switcher for quick testing */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoleMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full border border-[#d8e0e7] bg-[#f9fbfe] px-3 py-1.5 text-xs text-[#183d63] hover:bg-[#edf5fb] transition"
              title="Switch demo account"
            >
              <span className="text-[11px] text-[#788ca0] hidden md:inline">Account:</span>
              <span className="font-bold">{user?.username}</span>
              <Badge variant="outline" size="sm">
                {user?.role}
              </Badge>
              <ChevronDown className="size-3 text-[#788ca0]" />
            </button>

            {roleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-[#d8e0e7] bg-white p-2 shadow-xl z-50 animate-fade-in"
                role="menu"
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#788ca0]">
                  Switch Demo Account
                </div>
                {ROLES_LIST.map((r) => (
                  <button
                    key={r.username}
                    type="button"
                    onClick={() => handleSwitchAccount(r.username)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-left transition ${
                      user?.username === r.username
                        ? "bg-[#edf5fb] text-[#0c4b80] font-bold"
                        : "text-[#45627f] hover:bg-[#f7faff]"
                    }`}
                  >
                    <span>{r.label}</span>
                    <span className="text-[10px] font-mono text-[#788ca0]">
                      {r.username}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onGoHome}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#e2ebf3] px-3 py-1.5 text-xs font-semibold text-[#516d89] hover:bg-[#f7faff] transition"
            title="View public landing page"
          >
            <Globe className="size-3.5" />
            <span>Public Site</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="lg:hidden flex items-center overflow-x-auto border-t border-[#eaf0f6] px-4 py-1.5 gap-1 scrollbar-none">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#edf5fb] text-[#0c4b80]"
                    : "text-[#516d89] hover:bg-[#f7faff]"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
      </div>
    </header>
  );
};
