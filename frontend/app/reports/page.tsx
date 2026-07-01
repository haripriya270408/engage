'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface TaskSummary {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

interface RepPerformance {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  total_tasks: number;
  completed: number;
  completion_rate: number;
}

interface EmailStats {
  total_sent: number;
  drafts: number;
  sent: number;
}

interface Activity {
  id: string;
  user_name: string;
  activity_type: string;
  description: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-400',
  IN_PROGRESS: 'bg-blue-400',
  COMPLETED: 'bg-green-400',
  CANCELLED: 'bg-gray-400',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [repPerformance, setRepPerformance] = useState<RepPerformance[]>([]);
  const [loadingReps, setLoadingReps] = useState(true);

  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(true);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [activityFilter, setActivityFilter] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const actParams: Record<string, string> = {};
    if (startDate) actParams.startDate = startDate;
    if (endDate) actParams.endDate = endDate;
    if (activityFilter) actParams.activity_type = activityFilter;

    const load = async () => {
      try {
        const [summaryRes, emailRes, activityRes] = await Promise.all([
          api.get('/reports/task-summary', { params }),
          api.get('/reports/email-stats', { params }),
          api.get('/reports/user-activity', { params: actParams }),
        ]);
        setTaskSummary(summaryRes.data);
        setEmailStats(emailRes.data);
        setActivities(activityRes.data);
      } catch {
        toast.error('Failed to load report data');
      }

      if (isManager) {
        try {
          const { data } = await api.get('/reports/rep-performance', { params });
          setRepPerformance(data);
        } catch {
          toast.error('Failed to load rep performance');
        }
      }

      setLoadingSummary(false);
      setLoadingEmail(false);
      if (isManager) setLoadingReps(false);
      setLoadingActivity(false);
    };

    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxStatusValue = taskSummary
    ? Math.max(...Object.values(taskSummary.byStatus), 1)
    : 1;
  const maxTypeValue = taskSummary
    ? Math.max(...Object.values(taskSummary.byType), 1)
    : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Reports</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-foreground">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 block rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 block rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-foreground">Task Summary</h2>
          {loadingSummary ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !taskSummary ? (
            <p className="text-sm text-muted">No data available</p>
          ) : (
            <div className="space-y-4">
              <p className="text-3xl font-bold text-foreground">{taskSummary.total}</p>
              <div>
                <p className="mb-2 text-sm font-medium text-muted">By Status</p>
                {Object.entries(taskSummary.byStatus).map(([status, count]) => (
                  <div key={status} className="mb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{status.replace('_', ' ')}</span>
                      <span className="text-muted">{count}</span>
                    </div>
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-primary'} transition-all`}
                        style={{ width: `${(count / maxStatusValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-muted">By Type</p>
                {Object.entries(taskSummary.byType).map(([type, count]) => (
                  <div key={type} className="mb-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{type}</span>
                      <span className="text-muted">{count}</span>
                    </div>
                    <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${(count / maxTypeValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-foreground">Email Stats</h2>
          {loadingEmail ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !emailStats ? (
            <p className="text-sm text-muted">No data available</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{emailStats.total_sent}</p>
                <p className="text-xs text-muted">Total Sent</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{emailStats.sent}</p>
                <p className="text-xs text-muted">Sent</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{emailStats.drafts}</p>
                <p className="text-xs text-muted">Drafts</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isManager && (
        <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-foreground">Rep Performance</h2>
          {loadingReps ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : repPerformance.length === 0 ? (
            <p className="text-sm text-muted">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 font-medium text-foreground">Name</th>
                    <th className="pb-3 pr-4 font-medium text-foreground">Email</th>
                    <th className="pb-3 pr-4 font-medium text-foreground">Total Tasks</th>
                    <th className="pb-3 pr-4 font-medium text-foreground">Completed</th>
                    <th className="pb-3 font-medium text-foreground">Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {repPerformance.map((rep) => (
                    <tr key={rep.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-foreground">{rep.first_name} {rep.last_name}</td>
                      <td className="py-3 pr-4 text-muted">{rep.email}</td>
                      <td className="py-3 pr-4 text-foreground">{rep.total_tasks}</td>
                      <td className="py-3 pr-4 text-foreground">{rep.completed}</td>
                      <td className="py-3 text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-success"
                              style={{ width: `${rep.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted">{rep.completion_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-foreground">User Activity</h2>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="">All Types</option>
            <option value="task_created">Task Created</option>
            <option value="task_updated">Task Updated</option>
            <option value="task_completed">Task Completed</option>
            <option value="email_sent">Email Sent</option>
            <option value="login">Login</option>
          </select>
        </div>
        {loadingActivity ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No activity found</p>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{act.user_name}</p>
                    <span className="text-xs text-muted">
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{act.description}</p>
                  <span className="text-xs capitalize text-muted">{act.activity_type.replace(/_/g, ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
