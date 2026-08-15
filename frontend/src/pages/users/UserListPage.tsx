import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserPlus, Users, ShieldCheck,
  KeyRound, Edit, UserCheck, UserX, RefreshCw,
  Phone, Mail, CheckCircle2, AlertCircle, Snowflake, Ban, Save, X
} from 'lucide-react';
import api from '../../api';
import { Layout } from '../../components/layout';
import { Card, Button, Badge, Modal, StatCard, EmptyState } from '../../components/ui';
import { User, UserRole } from '../../types';

export const UserListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Role Change state
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [confirmRoleModalOpen, setConfirmRoleModalOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    user: User;
    oldRole: UserRole;
    newRole: UserRole;
  } | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'ENGINEER' as UserRole,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    role: 'ENGINEER' as UserRole,
  });

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');

  // Notifications / feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', search, roleFilter, statusFilter, page],
    queryFn: async () => {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const res = await api.get('/users', { params });
      return res.data;
    },
  });

  const rawUsers: User[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.users)
    ? data.users
    : [];
  const pagination = data?.pagination || { page: 1, limit: 10, total: rawUsers.length, totalPages: 1 };

  // Apply client-side status filter if set
  const users = rawUsers.filter((u) => {
    const st = u.status || (u.isActive !== false ? 'ACTIVE' : 'DISABLED');
    if (statusFilter === 'ACTIVE') return st === 'ACTIVE';
    if (statusFilter === 'SUSPENDED') return st === 'SUSPENDED';
    if (statusFilter === 'DISABLED') return st === 'DISABLED';
    return true;
  });

  // Calculate statistics
  const totalCount = pagination.total || users.length;
  const superAdminCount = rawUsers.filter((u) => u.role === 'SUPER_ADMIN').length;
  const activeCount = rawUsers.filter((u) => (u.status || (u.isActive !== false ? 'ACTIVE' : 'DISABLED')) === 'ACTIVE').length;
  const suspendedCount = rawUsers.filter((u) => u.status === 'SUSPENDED').length;
  const disabledCount = rawUsers.filter((u) => (u.status || (u.isActive !== false ? 'ACTIVE' : 'DISABLED')) === 'DISABLED').length;

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users', createForm);
      showNotification(`User ${createForm.name} created successfully!`);
      setCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', role: 'ENGINEER' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to create user', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update User Details
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/users/${selectedUser.id}`, editForm);
      showNotification(`User ${selectedUser.name} updated successfully!`);
      setEditModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to update user', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Account Status Control: Active / Suspended / Disabled
  const handleUpdateStatus = async (user: User, newStatus: 'ACTIVE' | 'SUSPENDED' | 'DISABLED') => {
    try {
      await api.patch(`/users/${user.id}/status`, { status: newStatus });
      showNotification(`Status for ${user.name} changed to ${newStatus}.`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to update account status', true);
    }
  };

  // Role Selection & Confirmation
  const handleRoleSelect = (user: User, newRole: UserRole) => {
    if (newRole === user.role) {
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    } else {
      setPendingRoles((prev) => ({ ...prev, [user.id]: newRole }));
    }
  };

  const handleCancelRoleChange = (userId: string) => {
    setPendingRoles((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const handleInitiateSaveRole = (user: User) => {
    const newRole = pendingRoles[user.id];
    if (!newRole || newRole === user.role) return;
    setPendingRoleChange({ user, oldRole: user.role, newRole });
    setConfirmRoleModalOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingRoleChange) return;
    const { user, newRole } = pendingRoleChange;
    setIsSubmitting(true);
    try {
      await api.patch(`/users/${user.id}/role`, { role: newRole });
      showNotification('User role updated successfully.');
      handleCancelRoleChange(user.id);
      setConfirmRoleModalOpen(false);
      setPendingRoleChange(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to update user role', true);
      setConfirmRoleModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPasswordValue !== confirmPasswordValue) {
      showNotification('Passwords do not match', true);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.patch(`/users/${selectedUser.id}/reset-password`, {
        password: resetPasswordValue,
      });
      showNotification(`Password for ${selectedUser.name} reset successfully!`);
      setResetModalOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to reset password', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge variant="purple" dot>Super Admin</Badge>;
      case 'INVENTORY_ADMIN':
        return <Badge variant="info" dot>Inventory Manager</Badge>;
      case 'ENGINEER':
        return <Badge variant="success" dot>Engineer</Badge>;
      case 'READ_ONLY':
        return <Badge variant="default">Read Only User</Badge>;
      default:
        return <Badge variant="default">{role}</Badge>;
    }
  };

  const formatLastLogin = (lastLoginAt?: string | Date | null) => {
    if (!lastLoginAt) return <span className="text-slate-500 text-xs italic font-medium">Never</span>;
    const d = new Date(lastLoginAt);
    return (
      <span className="text-xs text-slate-800 font-mono font-semibold">
        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
        <span className="text-slate-500 font-normal">{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    );
  };

  return (
    <Layout title="User Management System">
      {/* Toast Notifications */}
      {actionSuccess && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">✕</button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-950 font-bold">✕</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Registered Users"
          value={totalCount}
          icon={Users}
          color="text-indigo-600"
        />
        <StatCard
          title="Super Administrators"
          value={superAdminCount}
          icon={ShieldCheck}
          color="text-purple-600"
        />
        <StatCard
          title="Active Accounts"
          value={activeCount}
          icon={UserCheck}
          color="text-emerald-600"
        />
        <StatCard
          title="Suspended Accounts"
          value={suspendedCount}
          icon={UserX}
          color="text-amber-600"
        />
        <StatCard
          title="Disabled Accounts"
          value={disabledCount}
          icon={Ban}
          color="text-rose-600"
        />
      </div>

      {/* Control Bar: Search & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 max-w-2xl">
          {/* Search Box */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search user by name, email, or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-48 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="INVENTORY_ADMIN">Inventory Manager</option>
            <option value="ENGINEER">Engineer</option>
            <option value="READ_ONLY">Read Only User</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-40 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="SUSPENDED">Suspended Only</option>
            <option value="DISABLED">Disabled Only</option>
          </select>
        </div>

        {/* Action Button */}
        <Button
          variant="primary"
          size="md"
          onClick={() => setCreateModalOpen(true)}
          icon={<UserPlus className="w-4 h-4" />}
          className="w-full md:w-auto"
        >
          + Add New User
        </Button>
      </div>

      {/* Users Table */}
      <Card noPadding className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
            <span className="font-semibold text-slate-700">Loading system users...</span>
          </div>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Failed to Load Users"
            description="Could not connect to the backend server or process your user request."
            action={
              <Button size="sm" variant="primary" onClick={() => refetch()}>
                Retry
              </Button>
            }
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Users Found"
            description="No user records matched your current filters."
            action={
              <Button size="sm" variant="outline" onClick={() => { setSearch(''); setRoleFilter('ALL'); setStatusFilter('ALL'); }}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm data-table">
              <thead>
                <tr>
                  <th className="px-5 py-3.5">Full Name</th>
                  <th className="px-4 py-3.5">Email / Username</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Mobile Number</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {users.map((u) => {
                  const initials = u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
                  const isFrozen = u.isActive === false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm"
                            style={{
                              background: isFrozen
                                ? 'linear-gradient(135deg,#64748b,#475569)'
                                : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            }}
                          >
                            {initials}
                          </div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                            {u.name}
                          </p>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-xs text-slate-900 font-mono font-bold">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {u.email}
                        </span>
                      </td>

                      {/* Role Dropdown with Unsaved Change Indicator & Save/Cancel buttons */}
                      <td className="px-4 py-3.5">
                        {(() => {
                          const selectedRole = pendingRoles[u.id] || u.role;
                          const isChanged = pendingRoles[u.id] && pendingRoles[u.id] !== u.role;

                          return (
                            <div className="flex items-center gap-2">
                              {formatRoleBadge(selectedRole)}
                              <select
                                value={selectedRole}
                                onChange={(e) => handleRoleSelect(u, e.target.value as UserRole)}
                                className={`text-[10px] bg-white border rounded px-1.5 py-0.5 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer ${
                                  isChanged ? 'border-amber-500 ring-2 ring-amber-500/20 text-amber-900 font-extrabold' : 'border-slate-300 text-slate-800'
                                }`}
                                title="Change User Role"
                              >
                                <option value="SUPER_ADMIN">Super Admin</option>
                                <option value="INVENTORY_ADMIN">Inventory Manager</option>
                                <option value="ENGINEER">Engineer</option>
                                <option value="READ_ONLY">Read Only</option>
                              </select>

                              {isChanged && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleInitiateSaveRole(u)}
                                    className="p-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-transform hover:scale-105 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5"
                                    title="Save Role Change"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    onClick={() => handleCancelRoleChange(u.id)}
                                    className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors flex items-center justify-center"
                                    title="Cancel Role Change"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3.5 text-xs text-slate-800 font-mono font-semibold">
                        {u.phone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unspecified</span>
                        )}
                      </td>

                      {/* Account Status Badge & Selector */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {(u.status === 'ACTIVE' || (!u.status && u.isActive !== false)) && <Badge variant="success" dot>Active</Badge>}
                          {u.status === 'SUSPENDED' && <Badge variant="warning" dot>Suspended</Badge>}
                          {(u.status === 'DISABLED' || (!u.status && u.isActive === false)) && <Badge variant="danger" dot>Disabled</Badge>}
                          <select
                            value={u.status || (u.isActive !== false ? 'ACTIVE' : 'DISABLED')}
                            onChange={(e) => handleUpdateStatus(u, e.target.value as any)}
                            className="text-[10px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-800 font-bold focus:outline-none focus:border-indigo-600 cursor-pointer"
                            title="Change User Status"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                            <option value="DISABLED">Disabled</option>
                          </select>
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatLastLogin(u.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setEditForm({ name: u.name, phone: u.phone || '', role: u.role });
                              setEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                            title="Edit User Details"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setResetPasswordValue('');
                              setConfirmPasswordValue('');
                              setResetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-600 text-slate-700 hover:text-white border border-slate-200 transition-colors"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-600 font-semibold">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} users
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-slate-800 font-bold">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* + Add New User Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Add New User Account" maxWidth="md">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Email / Username *</label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="ramesh@proactivedata.in"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Password *</label>
            <input
              type="password"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Mobile Number</label>
            <input
              type="text"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              placeholder="+91 9876543210"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Role Assignment *</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
            >
              <option value="SUPER_ADMIN">Super Admin (Full Permission)</option>
              <option value="INVENTORY_ADMIN">Inventory Manager (Add/Edit Inventory)</option>
              <option value="ENGINEER">Engineer (Dispatch &amp; Pickups)</option>
              <option value="READ_ONLY">Read Only User (View Only)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit User: ${selectedUser?.name}`} maxWidth="md">
        <form onSubmit={handleUpdateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Mobile Number</label>
            <input
              type="text"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Role Assignment *</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:border-indigo-600"
            >
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="INVENTORY_ADMIN">Inventory Manager</option>
              <option value="ENGINEER">Engineer</option>
              <option value="READ_ONLY">Read Only User</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={resetModalOpen} onClose={() => setResetModalOpen(false)} title={`Reset Password: ${selectedUser?.name}`} maxWidth="sm">
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">New Password *</label>
            <input
              type="password"
              required
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              value={confirmPasswordValue}
              onChange={(e) => setConfirmPasswordValue(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" type="button" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Role Change Modal */}
      <Modal
        isOpen={confirmRoleModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setConfirmRoleModalOpen(false);
            setPendingRoleChange(null);
          }
        }}
        title="Confirm Role Change"
        maxWidth="sm"
      >
        {pendingRoleChange && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 font-medium">
              Are you sure you want to change this user's role?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-500">User:</span>
                <span className="font-extrabold text-slate-900">{pendingRoleChange.user.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/80">
                <span className="font-bold text-slate-500">Old Role:</span>
                <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {formatRoleBadge(pendingRoleChange.oldRole)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold text-slate-500">New Role:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {formatRoleBadge(pendingRoleChange.newRole)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  setConfirmRoleModalOpen(false);
                  setPendingRoleChange(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                onClick={handleConfirmRoleChange}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export const UsersPage = UserListPage;
export default UserListPage;
