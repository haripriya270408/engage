'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface AppUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  approved: boolean;
  created_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ROLES = ['', 'ADMIN', 'MANAGER', 'REP'] as const;
const STATUSES = ['', 'ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 20, totalPages: 1 });

  const doFetchUsers = (page: number = 1) => {
    const fn = async () => {
      try {
        const params: Record<string, string | number> = { page, limit: 20 };
        if (roleFilter) params.role = roleFilter;
        if (statusFilter) params.status = statusFilter;
        const { data } = await api.get('/users', { params });
        if (data.users) {
          setUsers(data.users);
          if (data.pagination) setPagination(data.pagination);
        } else {
          setUsers(data);
        }
      } catch {
        toast.error('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fn();
  };

  useEffect(() => {
    doFetchUsers(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      await api.patch(`/users/${userId}`, { status: newStatus });
      toast.success('User status updated');
      doFetchUsers(pagination.page);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Users</h1>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-muted">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All Roles</option>
            {ROLES.filter(Boolean).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-border bg-white p-16 text-center">
          <p className="text-muted">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50">
                <th className="px-4 py-3 font-medium text-foreground">Name</th>
                <th className="px-4 py-3 font-medium text-foreground">Email</th>
                <th className="px-4 py-3 font-medium text-foreground">Role</th>
                <th className="px-4 py-3 font-medium text-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-foreground">Approved</th>
                <th className="px-4 py-3 font-medium text-foreground">Created</th>
                <th className="px-4 py-3 font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-50 text-success'
                          : u.status === 'INACTIVE'
                          ? 'bg-yellow-50 text-warning'
                          : 'bg-red-50 text-danger'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{u.approved ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.status}
                      onChange={(e) => handleStatusChange(u.id, e.target.value)}
                      className="rounded-lg border border-border px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => doFetchUsers(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-gray-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => doFetchUsers(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-gray-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
