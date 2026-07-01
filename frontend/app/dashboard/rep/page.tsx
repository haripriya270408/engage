'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/sidebar';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  upcoming: Task[];
  overdue_tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date: string;
}

export default function RepDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<TaskStats | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role === 'MANAGER') {
      router.push('/dashboard/manager');
      return;
    }
    if (!loading && user) {
      fetchDashboard();
    }
  }, [loading, user, router]);

  const fetchDashboard = async () => {
    try {
      const { data: res } = await api.get('/tasks/dashboard');
      setData(res);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-6">My Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Tasks" value={data?.total ?? 0} />
          <StatCard label="In Progress" value={data?.in_progress ?? 0} />
          <StatCard label="Completed" value={data?.completed ?? 0} />
          <StatCard label="Overdue" value={data?.overdue ?? 0} accent />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Upcoming Tasks</h2>
            </div>
            {data?.upcoming && data.upcoming.length > 0 ? (
              <div className="divide-y divide-border">
                {data.upcoming.map((task) => (
                  <div key={task.id} className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      Due {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-muted">
                <p className="text-sm">No upcoming tasks</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Overdue Tasks</h2>
              {(data?.overdue_tasks?.length ?? 0) > 0 && (
                <span className="text-xs font-medium text-danger bg-red-50 px-2 py-0.5 rounded-full">
                  {data?.overdue_tasks?.length} overdue
                </span>
              )}
            </div>
            {data?.overdue_tasks && data.overdue_tasks.length > 0 ? (
              <div className="divide-y divide-border">
                {data.overdue_tasks.map((task) => (
                  <div key={task.id} className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-danger mt-0.5">
                          Due {new Date(task.due_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-muted">
                <p className="text-sm">No overdue tasks. Great job!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-danger' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
