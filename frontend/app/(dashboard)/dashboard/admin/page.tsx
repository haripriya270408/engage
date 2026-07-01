'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Manager {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface DashboardData {
  total_users: number;
  total_managers: number;
  total_reps: number;
  pending_approvals: number;
  total_tasks: number;
  pending_users: PendingUser[];
  managers: Manager[];
}

interface PendingUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [managerSelections, setManagerSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'ADMIN') {
      const target = user.role === 'MANAGER' ? '/dashboard/manager' : '/dashboard/rep';
      router.push(target);
      return;
    }
    if (!loading && user) {
      fetchDashboard();
    }
  }, [loading, user, router]);

  const fetchDashboard = async () => {
    try {
      const { data: res } = await api.get('/admin/dashboard');
      setData(res);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setPageLoading(false);
    }
  };

  const handleApprove = async (userId: string, role: string) => {
    setActionLoading(userId);
    try {
      const body: any = { user_id: userId };
      if (role === 'REP' && managerSelections[userId]) {
        body.manager_id = managerSelections[userId];
      }
      await api.post('/admin/approve-user', body);
      toast.success('User approved');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      await api.post('/admin/reject-user', { user_id: userId });
      toast.success('User rejected');
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject user');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={data?.total_users ?? 0} />
        <StatCard label="Managers" value={data?.total_managers ?? 0} />
        <StatCard label="Sales Reps" value={data?.total_reps ?? 0} />
        <StatCard label="Total Tasks" value={data?.total_tasks ?? 0} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Pending Approvals</h2>
          <span className="text-sm text-muted">{data?.pending_approvals ?? 0} pending</span>
        </div>
        {data?.pending_users && data.pending_users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-6 py-3 font-medium">Assign Manager</th>
                  <th className="px-6 py-3 font-medium">Registered</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_users.map((pu) => (
                  <tr key={pu.id} className="border-b border-border hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-foreground">{pu.first_name} {pu.last_name}</td>
                    <td className="px-6 py-4 text-muted">{pu.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary-light text-primary">
                        {pu.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {pu.role === 'REP' ? (
                        <select
                          value={managerSelections[pu.id] || ''}
                          onChange={(e) => setManagerSelections(prev => ({ ...prev, [pu.id]: e.target.value }))}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs outline-none focus:border-primary w-40"
                        >
                          <option value="">No manager</option>
                          {(data.managers || []).map((m) => (
                            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted text-xs">
                      {new Date(pu.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(pu.id, pu.role)}
                          disabled={actionLoading === pu.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === pu.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(pu.id)}
                          disabled={actionLoading === pu.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-danger text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === pu.id ? '...' : 'Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-muted">
            <p className="text-lg font-medium mb-1">All clear</p>
            <p className="text-sm">No pending user approvals</p>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
