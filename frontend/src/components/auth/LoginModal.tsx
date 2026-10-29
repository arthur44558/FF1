import React, { useState } from "react";
import { Lock, Stethoscope, UserCheck, PhoneCall, ShieldAlert, Settings, Eye, X, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type { Role } from "../../types/api";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SEEDED_USERS: Array<{
  username: string;
  name: string;
  role: Role;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    username: "doctor",
    name: "Demo Doctor",
    role: "doctor",
    desc: "Records clinical decisions, amends/reschedules follow-ups, authorizes actions.",
    icon: <Stethoscope className="size-4 text-[#0c4b80]" />,
  },
  {
    username: "assistant",
    name: "Demo Assistant",
    role: "assistant_verifier",
    desc: "Uploads scans, queues processing, verifies identity & extracted clinical fields.",
    icon: <UserCheck className="size-4 text-[#25aea8]" />,
  },
  {
    username: "coordinator",
    name: "Demo Coordinator",
    role: "followup_coordinator",
    desc: "Executes manual call tasks, records call outcomes, resolves contacts.",
    icon: <PhoneCall className="size-4 text-[#c94e08]" />,
  },
  {
    username: "supervisor",
    name: "Demo Supervisor",
    role: "clinic_supervisor",
    desc: "Approves & activates policies, conducts retry reviews, monitors operations.",
    icon: <ShieldAlert className="size-4 text-[#8b5cf6]" />,
  },
  {
    username: "admin",
    name: "Demo System Admin",
    role: "system_admin",
    desc: "Manages users and facility operational settings.",
    icon: <Settings className="size-4 text-[#475569]" />,
  },
  {
    username: "auditor",
    name: "Demo Auditor",
    role: "auditor",
    desc: "Read-only access to immutable audit log, policies, and summaries.",
    icon: <Eye className="size-4 text-[#0284c7]" />,
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, onSuccess }) => {
  const { login, isLoading } = useAuth();
  const { addToast } = useToast();
  const [customUsername, setCustomUsername] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("doctor");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleLogin = async (usernameToUse: string) => {
    setError(null);
    try {
      await login(usernameToUse);
      addToast("success", `Signed in as ${usernameToUse}`, "Authentication Successful");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c2338]/50 backdrop-blur-sm animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-[#d8e0e7] max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#8b9996] hover:text-[#183d63] transition"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#0c4b80] text-white">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#183d63]">Sign In to CareTrack</h2>
            <p className="text-xs text-[#667c91]">
              Select a seeded development account or enter a custom username.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          <label className="text-xs font-bold text-[#45627f] uppercase tracking-wider block">
            Select Seeded Demo Account
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SEEDED_USERS.map((u) => {
              const isSelected = selectedUsername === u.username && !customUsername;
              return (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => {
                    setSelectedUsername(u.username);
                    setCustomUsername("");
                  }}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-[#0c4b80] bg-[#eaf4fb] ring-2 ring-[#0c4b80]/20"
                      : "border-[#e2ebf3] hover:border-[#b7d3e6] bg-white"
                  }`}
                >
                  <div className="p-1 rounded-lg bg-white border border-[#e2ebf3] shrink-0">
                    {u.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#183d63] truncate">{u.name}</p>
                    <p className="text-[10px] font-mono text-[#45627f]">{u.username}</p>
                    <p className="mt-1 text-[10px] leading-tight text-[#788ca0] line-clamp-2">
                      {u.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 border-t border-[#eaf0f6] pt-4">
          <label className="text-xs font-bold text-[#45627f] block mb-1">
            Or Custom Username
          </label>
          <input
            type="text"
            value={customUsername}
            onChange={(e) => {
              setCustomUsername(e.target.value);
              setSelectedUsername("");
            }}
            placeholder="e.g. clinic_doctor_2"
            className="w-full rounded-xl border border-[#d8e0e7] px-3.5 py-2 text-xs text-[#17212b] focus:border-[#0c4b80] focus:outline-none"
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#788ca0]">
            Development tokens have a 15-minute lifetime.
          </p>
          <button
            type="button"
            disabled={isLoading || (!selectedUsername && !customUsername)}
            onClick={() => handleLogin(customUsername.trim() || selectedUsername)}
            className="rounded-full bg-[#c94e08] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b84600] transition disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};
