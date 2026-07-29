import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, UserPlus, Users, ShieldCheck,
  KeyRound, Edit, UserCheck, UserX, RefreshCw,
  Phone, Mail, CheckCircle2, AlertCircle, Snowflake, Ban
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
    if (statusFilter === 'ACTIVE') return u.isActive !== false;
    if (statusFilter === 'FROZEN' || statusFilter === 'INACTIVE') return u.isActive === false;
    return true;
  });

  // Calculate statistics
  const totalCount = pagination.total || users.length;
  const superAdminCount = rawUsers.filter((u) => u.role === 'SUPER_ADMIN').length;
  const activeCount = rawUsers.filter((u) => u.isActive !== false).length;
  const frozenCount = rawUsers.filter((u) => u.isActive === false).length;

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
    if (!createForm.name || !createForm.email || !createForm.password) {
      showNotification('Please fill in all required fields.', true);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/users', createForm);
      showNotification(`User "${createForm.name}" created successfully!`);
      setCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', phone: '', role: 'ENGINEER' });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to create user', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit User
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      phone: user.phone || '',
      role: user.role,
    });
    setEditModalOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await api.patch(`/users/${selectedUser.id}`, editForm);
      showNotification(`User "${editForm.name}" updated successfully!`);
      setEditModalOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Failed to update user', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active / Freeze / Inactive status
  const handleSetStatus = async (user: User, targetActive: boolean, actionLabel: string) => {
    if (!window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} account for "${user.name}"?`)) {
      return;
    }

    try {
      await api.patch(`/users/${user.id}/status`, { isActive: targetActive });
      showNotification(`Account for ${user.name} is now ${actionLabel}.`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      showNotification(err.response?.data?.message || `Failed to update status`, true);
    }
  };

  // Reset Password
  const openResetModal = (user: User) => {
    setSelectedUser(user);
    setResetPasswordValue('');
    setConfirmPasswordValue('');
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (resetPasswordValue.length < 6) {
      showNotification('Password must be at least 6 characters long.', true);
      return;
    }
    if (resetPasswordValue !== confirmPasswordValue) {
      showNotification('Passwords do not match.', true);
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
    if (!lastLoginAt) return <span className="text-slate-500 text-xs italic">Never</span>;
    const d = new Date(lastLoginAt);
    return (
      <span className="text-xs text-slate-300 font-mono">
        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
        <span className="text-slate-500">{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      </span>
    );
  };

  return (
    <Layout title="User Management System">
      {/* Toast Notifications */}
      {actionSuccess && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Registered Users"
          value={totalCount}
          icon={Users}
          color="text-indigo-400"
          bg="linear-gradient(135deg,rgba(99,102,241,0.1) 0%,rgba(79,70,229,0.05) 100%)"
        />
        <StatCard
          title="Super Administrators"
          value={superAdminCount}
          icon={ShieldCheck}
          color="text-purple-400"
          bg="linear-gradient(135deg,rgba(139,92,246,0.1) 0%,rgba(124,58,237,0.05) 100%)"
        />
        <StatCard
          title="Active Accounts"
          value={activeCount}
          icon={UserCheck}
          color="text-emerald-400"
          bg="linear-gradient(135deg,rgba(16,185,129,0.1) 0%,rgba(5,150,105,0.05) 100%)"
        />
        <StatCard
          title="Frozen / Inactive Accounts"
          value={frozenCount}
          icon={UserX}
          color="text-rose-400"
          bg="linear-gradient(135deg,rgba(239,68,68,0.1) 0%,rgba(220,38,38,0.05) 100%)"
        />
      </div>

      {/* Control bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="w-full sm:w-48 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
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
            className="w-full sm:w-40 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="FROZEN">Frozen / Inactive</option>
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
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            Loading system users...
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
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
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
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const initials = u.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
                  const isFrozen = u.isActive === false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                            style={{
                              background: isFrozen
                                ? 'linear-gradient(135deg,#64748b,#475569)'
                                : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            }}
                          >
                            {initials}
                          </div>
                          <p className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {u.name}
                          </p>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-xs text-slate-300 font-mono">
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-500" />
                          {u.email}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatRoleBadge(u.role)}
                      </td>

                      {/* Mobile Number */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-400">
                        {u.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {u.phone}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isFrozen ? (
                          <Badge variant="danger" dot>Frozen / Inactive</Badge>
                        ) : (
                          <Badge variant="success" dot>Active</Badge>
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {formatLastLogin(u.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit User Button */}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openEditModal(u)}
                            title="Edit User Details"
                          >
                            <Edit className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>

                          {/* Reset Password Button */}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => openResetModal(u)}
                            title="Reset Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Reset Pass</span>
                          </Button>

                          {/* Account Status Control: Freeze / Activate */}
                          {isFrozen ? (
                            <Button
                              variant="success"
                              size="xs"
                              onClick={() => handleSetStatus(u, true, 'Active')}
                              title="Activate Account"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleSetStatus(u, false, 'Frozen')}
                              title="Freeze / Inactivate Account"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Freeze</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-slate-800/80 flex items-center justify-between bg-slate-900/40">
            <span className="text-xs text-slate-400">
              Showing page <strong className="text-white">{pagination.page}</strong> of <strong className="text-white">{pagination.totalPages}</strong> ({pagination.total} users)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="xs"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="xs"
                disabled={!pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* CREATE NEW USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="+ Add New User Account"
        subtitle="Add a new member to the Spare Management System."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
            <input
              type="email"
              required
              placeholder="user@proactivedata.in"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
            <input
              type="text"
              placeholder="+91-9876543210"
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password *</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Role Assignment *</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="SUPER_ADMIN">1. Super Admin (Full Control & Admin Access)</option>
              <option value="INVENTORY_ADMIN">2. Inventory Manager / Admin</option>
              <option value="ENGINEER">2. Field Engineer (Dispatch / Pickup Operations)</option>
              <option value="READ_ONLY">3. Read Only User (View Only Access)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <Button variant="ghost" size="sm" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              + Add User
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.name}`}
        subtitle="Update user profile, phone number, or system role."
        maxWidth="md"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number</label>
            <input
              type="text"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Role Assignment</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="INVENTORY_ADMIN">Inventory Manager</option>
              <option value="ENGINEER">Field Engineer</option>
              <option value="READ_ONLY">Read Only User</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title={`Reset Password for ${selectedUser?.name}`}
        subtitle="Generate or set a new password for this user."
        maxWidth="md"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Enter new password (min 6 characters)"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              placeholder="Re-enter new password"
              value={confirmPasswordValue}
              onChange={(e) => setConfirmPasswordValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <Button variant="ghost" size="sm" type="button" onClick={() => setResetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};

export default UserListPage;
