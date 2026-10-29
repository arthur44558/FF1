import React, { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { listUsers, createUser, updateUser } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Badge } from "../components/common/Badge";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import type { Role, UserCreate, UserOut, UserPatch } from "../types/api";

export const UsersScreen: React.FC = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  // Create User Modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<Role>("doctor");
  const [newDept, setNewDept] = useState("Internal Medicine");
  const [creating, setCreating] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<UserOut | null>(null);
  const [editRole, setEditRole] = useState<Role>("doctor");
  const [editActive, setEditActive] = useState(true);
  const [editReason, setEditReason] = useState("Administrative role update");
  const [updating, setUpdating] = useState(false);

  const loadUsersList = useCallback(async () => {
    if (!hasPermission("user:manage")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listUsers();
      setUsers(res);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    loadUsersList();
  }, [loadUsersList]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: UserCreate = {
        username: newUsername.trim(),
        display_name: newDisplayName.trim(),
        role: newRole,
        department: newDept.trim() || null,
      };
      await createUser(payload);
      addToast("success", `User ${newUsername} created.`, "Staff User Created");
      setShowCreate(false);
      await loadUsersList();
    } catch (err: any) {
      addToast("error", err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    try {
      const payload: UserPatch = {
        role: editRole,
        is_active: editActive,
        reason: editReason,
      };
      await updateUser(editingUser.id, payload);
      addToast("success", `User ${editingUser.username} updated.`, "User Updated");
      setEditingUser(null);
      await loadUsersList();
    } catch (err: any) {
      addToast("error", err.message || "Failed to update user");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebf3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#183d63]">Staff User Administration</h1>
          <p className="text-xs text-[#667c91] mt-0.5">
            Manage provisioned staff accounts, role permissions, and active operational status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadUsersList}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8e0e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#45627f] hover:bg-[#f7faff] transition"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0c4b80] px-4 py-2 text-xs font-bold text-white hover:bg-[#08355c] transition"
          >
            <Plus className="size-3.5" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={loadUsersList} />}

      {loading ? (
        <LoadingSpinner message="Loading user directory..." />
      ) : (
        <div className="rounded-2xl border border-[#d8e0e7] bg-white shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#eaf0f6] bg-[#f9fbfe] text-[11px] font-bold text-[#45627f] uppercase tracking-wider">
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Display Name</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f4f8]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#f8fbfe] transition">
                  <td className="py-3 px-4 font-mono font-bold text-[#183d63]">{u.username}</td>
                  <td className="py-3 px-4 font-semibold text-[#183d63]">{u.display_name}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" size="sm">
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-[#516d89]">{u.department || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant={u.is_active ? "completed" : "cancelled"} size="sm">
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(u);
                        setEditRole(u.role);
                        setEditActive(u.is_active);
                      }}
                      className="rounded-full border border-[#d8e0e7] bg-white px-3 py-1 text-xs font-semibold text-[#0c4b80] hover:bg-[#edf5fb] transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">Provision Staff User</h3>
            <p className="text-xs text-[#667c91] mb-4">
              Add a new staff member to the facility directory.
            </p>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  maxLength={160}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                >
                  <option value="doctor">Doctor</option>
                  <option value="assistant_verifier">Assistant Verifier</option>
                  <option value="followup_coordinator">Follow-up Coordinator</option>
                  <option value="clinic_supervisor">Clinic Supervisor</option>
                  <option value="system_admin">System Admin</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Department</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
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
                  {creating ? "Creating..." : "Save User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#d8e0e7]">
            <h3 className="text-sm font-bold text-[#183d63] mb-1">
              Update User: {editingUser.username}
            </h3>
            <p className="text-xs text-[#667c91] mb-4">
              Modify operational role or activation status.
            </p>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                >
                  <option value="doctor">Doctor</option>
                  <option value="assistant_verifier">Assistant Verifier</option>
                  <option value="followup_coordinator">Follow-up Coordinator</option>
                  <option value="clinic_supervisor">Clinic Supervisor</option>
                  <option value="system_admin">System Admin</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active-user"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="size-4 rounded text-[#0c4b80] focus:ring-[#0c4b80]"
                />
                <label htmlFor="active-user" className="text-xs font-bold text-[#183d63]">
                  Active Operational Status
                </label>
              </div>

              <div>
                <label className="text-xs font-bold text-[#45627f] block mb-1">Change Reason</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  required
                  minLength={3}
                  className="w-full rounded-lg border border-[#d8e0e7] px-3 py-1.5 text-xs text-[#17212b]"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={updating}
                  className="rounded-full border border-[#d8e0e7] bg-white px-4 py-1.5 text-xs font-semibold text-[#45627f]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-full bg-[#0c4b80] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#08355c] disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
