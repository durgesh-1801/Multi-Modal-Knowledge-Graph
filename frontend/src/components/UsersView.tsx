import React, { useState } from 'react';
import { Role, User, UserStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { useUsers, useCreateUser, useUpdateUserRole, useUpdateUserStatus, useDeleteUser } from '../hooks/useUsers';
import { Toast, useToast } from './Toast';
import { getErrorMessage } from '../lib/api';

export const UsersView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast, showToast, dismissToast } = useToast();

  // ── Real API data ───────────────────────────────────────────────────────────
  const { data: users = [], isLoading, error, refetch } = useUsers();
  const { mutateAsync: createUser, isPending: isCreating } = useCreateUser();
  const { mutateAsync: updateRole } = useUpdateUserRole();
  const { mutateAsync: updateStatus } = useUpdateUserStatus();
  const { mutateAsync: deleteUser } = useDeleteUser();

  // ── Invite modal state ──────────────────────────────────────────────────────
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('COMPLIANCE_OFFICER');

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName || !newPassword) return;
    try {
      await createUser({ email: newEmail, name: newName, role: newRole, password: newPassword });
      showToast(`User ${newEmail} created successfully.`, 'success');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('COMPLIANCE_OFFICER');
      setShowInviteModal(false);
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleRoleChange = async (userId: string, targetRole: Role) => {
    // Prevent changing own role
    if (userId === currentUser?.id) {
      showToast('You cannot change your own role.', 'warning');
      return;
    }
    try {
      await updateRole({ userId, role: targetRole });
      showToast('Role updated successfully.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: UserStatus) => {
    if (userId === currentUser?.id) {
      showToast('You cannot change your own account status.', 'warning');
      return;
    }
    const nextStatus: UserStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateStatus({ userId, status: nextStatus });
      showToast(`User status updated to ${nextStatus}.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      showToast('You cannot delete your own account.', 'warning');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${userName}?`)) return;
    try {
      await deleteUser(userId);
      showToast(`User ${userName} deleted.`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'COMPLIANCE_OFFICER': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'AUDITOR': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-widest bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 w-fit mb-2">
            <span className="material-symbols-outlined text-sm">shield_person</span>
            Admin Access Only
          </div>
          <h2 className="text-xl font-bold text-slate-900">User & Access Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage enterprise team accounts, invite compliance personnel, assign RBAC roles, and toggle access status.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Invite New User
        </button>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            All Registered Directory Users ({users.length})
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Strict RBAC Enforced</span>
            <button onClick={() => refetch()} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer" title="Refresh">
              <span className="material-symbols-outlined text-sm text-slate-400">refresh</span>
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error_outline</span>
            <p className="text-sm font-semibold text-slate-700 mb-1">Failed to load users</p>
            <p className="text-xs text-slate-500 mb-4">Check that the backend is running.</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl cursor-pointer">
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="px-6 py-3.5">User</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(users || []).map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                        {(u.name || u.email || 'U').split(' ').map((n) => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{u.name || 'User'}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border bg-white focus:outline-none cursor-pointer ${getRoleBadge(u.role as Role)}`}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="COMPLIANCE_OFFICER">COMPLIANCE OFFICER</option>
                        <option value="AUDITOR">AUDITOR</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.status as UserStatus)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {u.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Delete User Account"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900">Invite User to Enterprise RBAC</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Jane Smith"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jane.smith@enterprise.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-semibold cursor-pointer"
                >
                  <option value="ADMIN">ADMIN (Full Control)</option>
                  <option value="COMPLIANCE_OFFICER">COMPLIANCE OFFICER (Ingest & RAG)</option>
                  <option value="AUDITOR">AUDITOR (Read-Only Inspection)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isCreating ? 'Creating…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
