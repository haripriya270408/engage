'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const TASK_TYPES = ['EMAIL', 'CALL', 'LINKEDIN', 'MEETING', 'FOLLOW_UP', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function CreateTaskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    task_type: 'EMAIL',
    priority: 'MEDIUM',
    due_date: '',
    assigned_to: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    company_name: '',
    linkedin_url: '',
    meeting_link: '',
    location: '',
    note: '',
    salesforce_what_id: '',
  });

  const [opportunities, setOpportunities] = useState<{ Id: string; Name: string }[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);

  useEffect(() => {
    if (!user) return; // wait until auth loads

    const fetchUsers = async () => {
      // REPs don't need the user list — tasks auto-assign to themselves
      if (user.role === 'REP') {
        setUsersLoading(false);
        return;
      }
      try {
        if (user.role === 'MANAGER') {
          const { data } = await api.get('/teams/my-team');
          setUsers(data.reps || []);
        } else {
          const { data } = await api.get('/users/reps');
          setUsers(Array.isArray(data) ? data : (data.users || data.data || []));
        }
      } catch {
        // silently ignore
      } finally {
        setUsersLoading(false);
      }
    };

    const fetchOpportunities = async () => {
      try {
        const { data } = await api.get('/salesforce/opportunities');
        if (data?.opportunities) {
          setOpportunities(data.opportunities);
        }
      } catch {
        // silently ignore
      } finally {
        setLoadingOpportunities(false);
      }
    };

    fetchUsers();
    fetchOpportunities();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        title: form.title,
        description: form.description || undefined,
        task_type: form.task_type,
        priority: form.priority,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : undefined,
        // REPs are always assigned to themselves
        assigned_to: user?.role === 'REP' ? user.id : (form.assigned_to || undefined),
        contact_name: form.contact_name || undefined,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
        company_name: form.company_name || undefined,
        linkedin_url: form.linkedin_url || undefined,
        meeting_link: form.meeting_link || undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        salesforce_what_id: form.salesforce_what_id || undefined,
      };

      await api.post('/tasks', payload);
      toast.success('Task created successfully');
      router.push('/tasks');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Create Task</h1>
        <Link href="/tasks" className="text-sm text-indigo-600 hover:text-indigo-800">Back to Tasks</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Task title"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Task description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task Type</label>
            <select
              name="task_type"
              value={form.task_type}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="datetime-local"
              name="due_date"
              value={form.due_date}
              onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {user?.role !== 'REP' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assigned To</label>
              {!usersLoading ? (
                <select
                  name="assigned_to"
                  value={form.assigned_to}
                  onChange={handleChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <span className="text-xs text-gray-400">Loading...</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Contact Information</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="text"
                name="contact_phone"
                value={form.contact_phone}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Additional Details</h3>
          
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">Salesforce Opportunity</label>
            {!loadingOpportunities ? (
              <select
                name="salesforce_what_id"
                value={form.salesforce_what_id}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">-- None --</option>
                {opportunities.map((opp) => (
                  <option key={opp.Id} value={opp.Id}>{opp.Name}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <span className="text-xs text-gray-400">Loading Opportunities...</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn URL</label>
              <input
                type="url"
                name="linkedin_url"
                value={form.linkedin_url}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Meeting Link</label>
              <input
                type="url"
                name="meeting_link"
                value={form.meeting_link}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
          <textarea
            name="note"
            value={form.note}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>


        <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
          <Link
            href="/tasks"
            className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
