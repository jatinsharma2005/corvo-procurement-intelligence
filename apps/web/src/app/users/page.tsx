'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Lock,
  Building,
  Factory,
  Mail,
  User as UserIcon,
  Copy,
  Check
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api-client';

interface UserRecord {
  _id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
  isActive: boolean;
  department?: string;
  plant?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'BUYER' as 'BUYER' | 'ADMIN',
    department: '',
    plant: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'BUYER' as 'BUYER' | 'ADMIN',
    department: '',
    plant: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [copiedPass, setCopiedPass] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load users from API
  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsers({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined
      });
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && currentUser) {
      if (currentUser.role !== 'ADMIN') {
        router.replace('/dashboard');
      } else {
        loadUsers();
      }
    }
  }, [authLoading, currentUser, search, roleFilter, statusFilter]);

  // Flash success message
  function notifySuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  }

  // Password generator helper
  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  }

  // Create User Handler
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        department: createForm.department.trim() || undefined,
        plant: createForm.plant.trim() || undefined
      });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        email: '',
        password: '',
        role: 'BUYER',
        department: '',
        plant: ''
      });
      notifySuccess(`User account for ${createForm.name} created successfully.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user account.');
    } finally {
      setActionLoading(false);
    }
  }

  // Edit User Handler
  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    setActionLoading(true);
    try {
      await api.updateUser(selectedUser._id, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        department: editForm.department.trim() || undefined,
        plant: editForm.plant.trim() || undefined
      });
      setShowEditModal(false);
      notifySuccess(`User profile for ${editForm.name} updated.`);
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user profile.');
    } finally {
      setActionLoading(false);
    }
  }

  // Password Reset Handler
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setActionLoading(true);
    try {
      await api.resetPassword(selectedUser._id, newPassword);
      setShowResetModal(false);
      setNewPassword('');
      notifySuccess(`Password reset successfully for ${selectedUser.name}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setActionLoading(false);
    }
  }

  // Toggle Status Handler
  async function handleToggleStatus() {
    if (!selectedUser) return;
    setError('');
    setActionLoading(true);
    try {
      const nextStatus = !selectedUser.isActive;
      await api.updateUser(selectedUser._id, { isActive: nextStatus });
      setShowDeactivateModal(false);
      notifySuccess(
        `Account for ${selectedUser.name} is now ${nextStatus ? 'Active' : 'Inactive'}.`
      );
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update account status.');
    } finally {
      setActionLoading(false);
    }
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'ADMIN' && u.isActive).length;
    const buyers = users.filter((u) => u.role === 'BUYER' && u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    return { total, admins, buyers, inactive };
  }, [users]);

  if (authLoading || (currentUser && currentUser.role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          Verifying administrator authorization...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        title="User Management & Role Governance"
        subtitle="Administer enterprise accounts, role assignments, and authentication status"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Alerts */}
        {error && (
          <div
            role="alert"
            className="flex items-start justify-between p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm shadow-sm"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="flex items-start justify-between p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm shadow-sm"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Users
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="mt-1 text-xs text-slate-400">Configured in database</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Active Admins
            </div>
            <div className="mt-1 text-2xl font-bold text-blue-700">{stats.admins}</div>
            <div className="mt-1 text-xs text-slate-400">Full system governance</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" /> Active Buyers
            </div>
            <div className="mt-1 text-2xl font-bold text-indigo-700">{stats.buyers}</div>
            <div className="mt-1 text-xs text-slate-400">PR intake & PO processing</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5 text-slate-400" /> Inactive Users
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-600">{stats.inactive}</div>
            <div className="mt-1 text-xs text-slate-400">Access disabled</div>
          </div>
        </div>

        {/* Filter and Action Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by full name or email address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 focus:border-blue-600 outline-none"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Administrator</option>
                <option value="BUYER">Buyer</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 focus:border-blue-600 outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadUsers()}
              title="Refresh users"
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => {
                setError('');
                setShowCreateModal(true);
              }}
              className="h-10 px-4 rounded-lg bg-blue-700 text-white hover:bg-blue-800 flex items-center gap-2 text-sm font-semibold shadow-sm shadow-blue-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Content Section: Table for Desktop / Cards for Mobile */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
              Loading system users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <UserIcon className="w-6 h-6" />
              </div>
              <div className="text-base font-semibold text-slate-800">No users found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No user accounts matched your search criteria. Try clearing the filter or add a new
                user.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Plant & Dept</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Created Date</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
                      const isSelf = u.email === currentUser?.email;
                      return (
                        <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  u.role === 'ADMIN'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                u.role === 'ADMIN'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {u.role === 'ADMIN' ? (
                                <Shield className="w-3 h-3" />
                              ) : (
                                <UserIcon className="w-3 h-3" />
                              )}
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div>{u.plant || 'All Plants'}</div>
                            <div className="text-slate-400">{u.department || 'General'}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowDeactivateModal(true);
                              }}
                              title={
                                u.isActive
                                  ? 'Click to deactivate account'
                                  : 'Click to reactivate account'
                              }
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {u.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setEditForm({
                                    name: u.name,
                                    email: u.email,
                                    role: u.role,
                                    department: u.department || '',
                                    plant: u.plant || ''
                                  });
                                  setShowEditModal(true);
                                }}
                                title="Edit user details & role"
                                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewPassword('');
                                  setCopiedPass(false);
                                  setShowResetModal(true);
                                }}
                                title="Reset user password"
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px) - Zero Horizontal Scrolling */}
              <div className="md:hidden divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.email === currentUser?.email;
                  return (
                    <div key={u._id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                              u.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 break-all">{u.email}</div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            u.role === 'ADMIN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-50">
                        <div>
                          <span>{u.plant || 'All Plants'}</span>
                          {u.department && <span> • {u.department}</span>}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setShowDeactivateModal(true);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {u.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setEditForm({
                              name: u.name,
                              email: u.email,
                              role: u.role,
                              department: u.department || '',
                              plant: u.plant || ''
                            });
                            setShowEditModal(true);
                          }}
                          className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setNewPassword('');
                            setCopiedPass(false);
                            setShowResetModal(true);
                          }}
                          className="flex-1 h-9 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Key className="w-3.5 h-3.5" /> Reset Pass
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Enterprise User</h3>
                  <p className="text-xs text-slate-500">
                    Administrator-controlled user creation and role assignment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Anand Mahindra"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  required
                  type="email"
                  placeholder="e.g. anand@corvo.internal"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Assignment *
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        role: e.target.value as 'BUYER' | 'ADMIN'
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:border-blue-600 outline-none"
                  >
                    <option value="BUYER">BUYER (Purchases & Sourcing)</option>
                    <option value="ADMIN">ADMIN (Full Governance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating Plant
                  </label>
                  <select
                    value={createForm.plant}
                    onChange={(e) => setCreateForm({ ...createForm, plant: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:border-blue-600 outline-none"
                  >
                    <option value="">All Plants (Enterprise)</option>
                    <option value="PUN1">PUN1 (Pune Plant)</option>
                    <option value="CHK1">CHK1 (Chakan Plant)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operations, Procurement, Maintenance"
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Initial Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = generateRandomPassword();
                      setCreateForm({ ...createForm, password: pass });
                    }}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    Generate Temporary
                  </button>
                </div>
                <input
                  required
                  type="text"
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading}
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 flex items-center gap-2 shadow-sm"
                >
                  {actionLoading ? 'Creating User...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit User Details</h3>
                  <p className="text-xs text-slate-500">Modify user role and organizational unit</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Role Assignment
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        role: e.target.value as 'BUYER' | 'ADMIN'
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:border-blue-600 outline-none"
                  >
                    <option value="BUYER">BUYER (Purchases & Sourcing)</option>
                    <option value="ADMIN">ADMIN (Full Governance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operating Plant
                  </label>
                  <select
                    value={editForm.plant}
                    onChange={(e) => setEditForm({ ...editForm, plant: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:border-blue-600 outline-none"
                  >
                    <option value="">All Plants (Enterprise)</option>
                    <option value="PUN1">PUN1 (Pune Plant)</option>
                    <option value="CHK1">CHK1 (Chakan Plant)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading}
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 flex items-center gap-2 shadow-sm"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset User Password</h3>
                  <p className="text-xs text-slate-500">For user: {selectedUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">New Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = generateRandomPassword();
                      setNewPassword(pass);
                      setCopiedPass(false);
                    }}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    Generate Temporary
                  </button>
                </div>
                <div className="relative">
                  <input
                    required
                    type="text"
                    minLength={8}
                    placeholder="Enter min. 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-slate-300 text-sm font-mono focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  {newPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newPassword);
                        setCopiedPass(true);
                        setTimeout(() => setCopiedPass(false), 2000);
                      }}
                      className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-700"
                      title="Copy to clipboard"
                    >
                      {copiedPass ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Password will be hashed with bcrypt before storage. Never shared or stored in
                  plain text.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading || newPassword.length < 8}
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2 shadow-sm"
                >
                  {actionLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE / REACTIVATE CONFIRMATION MODAL */}
      {showDeactivateModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedUser.isActive
                    ? 'bg-red-100 text-red-600'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {selectedUser.isActive ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {selectedUser.isActive ? 'Deactivate User Account' : 'Reactivate User Account'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {selectedUser.isActive
                    ? `Are you sure you want to deactivate ${selectedUser.name} (${selectedUser.email})? Deactivated accounts cannot sign in or perform any procurement actions.`
                    : `Reactivate ${selectedUser.name} (${selectedUser.email})? They will immediately regain system access.`}
                </p>
                {selectedUser.role === 'ADMIN' && selectedUser.isActive && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                    Warning: This user has Administrator privileges. The system will prevent
                    deactivation if this is the last active administrator.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleToggleStatus}
                className={`px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 shadow-sm ${
                  selectedUser.isActive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading
                  ? 'Processing...'
                  : selectedUser.isActive
                  ? 'Deactivate Account'
                  : 'Reactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
