'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface TeamStats {
  team_size: number;
  active_reps: number;
  completion_rate: number;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to?: { first_name: string; last_name: string };
}

interface DashboardData {
  team: TeamStats;
  tasks: TaskStats;
  recent_tasks: Task[];
}

export default function ManagerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role === 'REP') {
      router.push('/dashboard/rep');
      return;
    }
    if (!loading && user) {
      fetchDashboard();
    }
  }, [loading, user, router]);

  const fetchDashboard = async () => {
    try {
      const [teamRes, tasksRes] = await Promise.all([
        api.get('/teams/stats'),
        api.get('/tasks/dashboard'),
      ]);
      setData({
        team: teamRes.data,
        tasks: tasksRes.data,
        recent_tasks: tasksRes.data.recent_tasks || [],
      });
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const completionRate = data?.team?.completion_rate ?? 0;

  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground mb-6">Manager Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Team Size" value={data?.team?.team_size ?? 0} />
        <StatCard label="Active Reps" value={data?.team?.active_reps ?? 0} />
        <StatCard label="Pending Tasks" value={data?.tasks?.pending ?? 0} />
        <StatCard label="Completion Rate" value={`${completionRate}%`} />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Recent Tasks</h2>
        </div>
        {data?.recent_tasks && data.recent_tasks.length > 0 ? (
          <div className="divide-y divide-border">
            {data.recent_tasks.map((task) => (
              <div key={task.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{task.title}</p>
                  {task.assigned_to && (
                    <p className="text-xs text-muted mt-0.5">
                      Assigned to {task.assigned_to.first_name} {task.assigned_to.last_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                    task.priority === 'HIGH' ? 'bg-red-50 text-danger' :
                    task.priority === 'MEDIUM' ? 'bg-amber-50 text-warning' :
                    'bg-green-50 text-success'
                  }`}>
                    {task.priority}
                  </span>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                    task.status === 'completed' ? 'bg-green-50 text-success' :
                    task.status === 'in_progress' ? 'bg-blue-50 text-primary' :
                    'bg-gray-50 text-muted'
                  }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-muted">
            <p className="text-lg font-medium mb-1">No tasks yet</p>
            <p className="text-sm">Tasks will appear here once created</p>
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
