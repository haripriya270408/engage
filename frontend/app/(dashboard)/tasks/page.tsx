'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type TaskType = 'EMAIL' | 'CALL' | 'LINKEDIN' | 'MEETING' | 'FOLLOW_UP' | 'OTHER';
type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface Task {
  id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assigned_to: { id: string; first_name: string; last_name: string } | null;
  due_date: string | null;
  created_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const statusColors: Record<TaskStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const priorityColors: Record<Priority, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600',
};

const typeColors: Record<TaskType, string> = {
  EMAIL: 'bg-blue-100 text-blue-700',
  CALL: 'bg-green-100 text-green-700',
  LINKEDIN: 'bg-blue-900 text-white',
  MEETING: 'bg-purple-100 text-purple-700',
  FOLLOW_UP: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

// Status quick-filter chips shown at the top
const STATUS_CHIPS: { label: string; value: TaskStatus | 'OVERDUE' | '' }[] = [
  { label: 'All', value: '' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Overdue', value: 'OVERDUE' },
];

// Type quick-filter chips
const TYPE_CHIPS: { label: string; value: TaskType | '' }[] = [
  { label: 'All Types', value: '' },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Call', value: 'CALL' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'Meeting', value: 'MEETING' },
  { label: 'Follow Up', value: 'FOLLOW_UP' },
];

function TasksPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStatus = searchParams.get('status') as TaskStatus | '';
  const initialOverdue = searchParams.get('overdue') === 'true';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Active filter values
  const [activeStatus, setActiveStatus] = useState<TaskStatus | 'OVERDUE' | ''>(
    initialOverdue ? 'OVERDUE' : (initialStatus || '')
  );
  const [activeType, setActiveType] = useState<TaskType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchTasks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (activeStatus && activeStatus !== 'OVERDUE') params.status = activeStatus;
      if (activeStatus === 'OVERDUE') params.overdue = 'true';
      if (activeType) params.task_type = activeType;
      if (dateFrom) params.due_date_from = new Date(dateFrom).toISOString();
      if (dateTo) {
        // include the full end day
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.due_date_to = end.toISOString();
      }

      const { data } = await api.get('/tasks', { params });
      // Backend returns { data: [...], total, page, limit, totalPages }
      const taskList = data.data || data.tasks || [];
      const pag = {
        total: data.total ?? taskList.length,
        page: data.page ?? page,
        limit: data.limit ?? 10,
        totalPages: data.totalPages ?? Math.ceil((data.total ?? taskList.length) / 10),
      };
      setTasks(taskList);
      setPagination(pag);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, activeType, dateFrom, dateTo]);

  useEffect(() => {
    fetchTasks(1);
  }, [fetchTasks]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      toast.success('Task deleted');
      fetchTasks(pagination.page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete task');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
        <Link
          href="/tasks/create"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
        >
          + Create Task
        </Link>
      </div>

      {/* Status filter chips */}
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setActiveStatus(chip.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              activeStatus === chip.value
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Type filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => setActiveType(chip.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
              activeType === chip.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Date range filters */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Due from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Due to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear dates
          </button>
        )}
        <div className="ml-auto text-xs text-gray-400 self-center">
          {pagination.total} task{pagination.total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Tasks table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-base font-medium">No tasks found</p>
            <p className="text-sm mt-1">Try adjusting the filters above</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate">{task.title}</td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[task.task_type]}`}>
                      {task.task_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {task.assigned_to
                      ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}`
                      : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => router.push(`/tasks/${task.id}`)}
                      className="mr-3 text-primary hover:underline"
                    >
                      View
                    </button>
                    <button
                      onClick={() => router.push(`/tasks/${task.id}?edit=true`)}
                      className="mr-3 text-gray-500 hover:text-gray-800"
                    >
                      Edit
                    </button>
                    {user?.role !== 'REP' && (
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => fetchTasks(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchTasks(p)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                p === pagination.page
                  ? 'bg-primary text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => fetchTasks(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}
