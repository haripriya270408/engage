'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import EmailComposerModal from '@/components/email-composer-modal';

const TASK_TYPES = ['EMAIL', 'CALL', 'LINKEDIN', 'MEETING', 'FOLLOW_UP', 'OTHER'] as const;
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
type TaskStatus = (typeof STATUSES)[number];

interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: TaskStatus;
  priority: string;
  assigned_to: { id: string; first_name: string; last_name: string } | null;
  due_date: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company_name: string | null;
  sf_who_name: string | null;
  linkedin_url: string | null;
  meeting_link: string | null;
  location: string | null;
  note: string | null;
  is_recurring: boolean;
  recurring_interval: string | null;
  salesforce_id: string | null;
  salesforce_what_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Note {
  id: string;
  content: string;
  created_by: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
}

interface Activity {
  id: string;
  action: string;
  description: string;
  created_by: { id: string; first_name: string; last_name: string } | null;
  created_at: string;
}

const statusColors: Record<TaskStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const typeColors: Record<string, string> = {
  EMAIL: 'bg-blue-100 text-blue-700',
  CALL: 'bg-green-100 text-green-700',
  LINKEDIN: 'bg-blue-900 text-white',
  MEETING: 'bg-purple-100 text-purple-700',
  FOLLOW_UP: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function TaskDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { user } = useAuth();

  const [editing, setEditing] = useState(searchParams.get('edit') === 'true');
  const [editForm, setEditForm] = useState({
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
    is_recurring: false,
    recurring_interval: '',
    salesforce_what_id: '',
  });

  const [opportunities, setOpportunities] = useState<{ Id: string; Name: string }[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);

  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const fetchTask = async () => {
    try {
      const { data } = await api.get(`/tasks/${id}`);
      setTask(data.task || data.data || data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load task');
    }
  };

  const fetchNotes = async () => {
    try {
      const { data } = await api.get(`/tasks/${id}/notes`);
      setNotes(data.notes || data.data || []);
    } catch {
      // notes may not be available
    }
  };

  const fetchActivities = async () => {
    try {
      const { data } = await api.get(`/tasks/${id}/activities`);
      setActivities(data.activities || data.data || []);
    } catch {
      // activities may not be available
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTask(), fetchNotes(), fetchActivities(), fetchOpportunities()]);
      setLoading(false);
    };
    load();
  }, [id]);

  useEffect(() => {
    if (task && editing) {
      setEditForm({
        title: task.title,
        description: task.description || '',
        task_type: task.task_type,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.slice(0, 16) : '',
        assigned_to: task.assigned_to?.id || '',
        contact_name: task.contact_name || '',
        contact_email: task.contact_email || '',
        contact_phone: task.contact_phone || '',
        company_name: task.company_name || '',
        linkedin_url: task.linkedin_url || '',
        meeting_link: task.meeting_link || '',
        location: task.location || '',
        note: task.note || '',
        is_recurring: task.is_recurring,
        recurring_interval: task.recurring_interval || '',
        salesforce_what_id: task.salesforce_what_id || '',
      });
    }
  }, [task, editing]);

  const handleStatusChange = async (status: TaskStatus) => {
    setUpdating(true);
    try {
      await api.patch(`/tasks/${id}`, { status });
      toast.success(`Task marked as ${status}`);
      await fetchTask();
      await fetchActivities();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setEditForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setEditForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setUpdating(true);
    try {
      const payload: Record<string, any> = {
        title: editForm.title,
        description: editForm.description || undefined,
        task_type: editForm.task_type,
        priority: editForm.priority,
        due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
        assigned_to: editForm.assigned_to || null,
        contact_name: editForm.contact_name || null,
        contact_email: editForm.contact_email || null,
        contact_phone: editForm.contact_phone || null,
        company_name: editForm.company_name || null,
        linkedin_url: editForm.linkedin_url || null,
        meeting_link: editForm.meeting_link || null,
        location: editForm.location || null,
        note: editForm.note || null,
        is_recurring: editForm.is_recurring,
        recurring_interval: editForm.is_recurring ? editForm.recurring_interval : null,
        salesforce_what_id: editForm.salesforce_what_id || null,
      };
      await api.patch(`/tasks/${id}`, payload);
      toast.success('Task updated');
      setEditing(false);
      await fetchTask();
      await fetchActivities();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update task');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/tasks/${id}/notes`, { content: newNote });
      toast.success('Note added');
      setNewNote('');
      await fetchNotes();
      await fetchActivities();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">Task not found</p>
          <Link href="/tasks" className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-800">Back to Tasks</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/tasks" className="text-sm text-indigo-600 hover:text-indigo-800">&larr; Back</Link>
          <h1 className="text-2xl font-semibold text-gray-900">{editing ? 'Edit Task' : task.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!editing && task.task_type === 'CALL' && (
            <>
              <a
                href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Meeting: ' + task.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5B5FC7] text-white text-[12px] font-semibold rounded-lg hover:bg-[#4a4db0] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                Connect Teams
              </a>
              <a
                href={`https://zoom.us/schedule?topic=${encodeURIComponent(task.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D8CFF] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1a73e8] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
                Connect Zoom
              </a>
            </>
          )}
          {!editing && task.task_type === 'EMAIL' && (
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-1.5"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Contact
            </button>
          )}
          {!editing && (
            <button
              onClick={() => { setEditing(true); router.replace(`/tasks/${id}?edit=true`); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
            <input
              type="text" name="title" value={editForm.title} onChange={handleEditChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              name="description" value={editForm.description} onChange={handleEditChange} rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Task Type</label>
              <select name="task_type" value={editForm.task_type} onChange={handleEditChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                {TASK_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
              <select name="priority" value={editForm.priority} onChange={handleEditChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                {PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
              <input type="datetime-local" name="due_date" value={editForm.due_date} onChange={handleEditChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Assigned To (ID)</label>
              <input type="text" name="assigned_to" value={editForm.assigned_to} onChange={handleEditChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Contact</h3>
            <div className="grid grid-cols-3 gap-4">
              <input type="text" name="contact_name" value={editForm.contact_name} onChange={handleEditChange} placeholder="Name"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="email" name="contact_email" value={editForm.contact_email} onChange={handleEditChange} placeholder="Email"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="text" name="contact_phone" value={editForm.contact_phone} onChange={handleEditChange} placeholder="Phone"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                {!loadingOpportunities ? (
                  <select
                    name="salesforce_what_id"
                    value={editForm.salesforce_what_id}
                    onChange={handleEditChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">-- No Salesforce Opportunity --</option>
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
              <input type="text" name="company_name" value={editForm.company_name} onChange={handleEditChange} placeholder="Company"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="url" name="linkedin_url" value={editForm.linkedin_url} onChange={handleEditChange} placeholder="LinkedIn URL"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="url" name="meeting_link" value={editForm.meeting_link} onChange={handleEditChange} placeholder="Meeting Link"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="text" name="location" value={editForm.location} onChange={handleEditChange} placeholder="Location"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Note</label>
            <textarea name="note" value={editForm.note} onChange={handleEditChange} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="is_recurring" checked={editForm.is_recurring} onChange={handleEditChange}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Recurring
            </label>
            {editForm.is_recurring && (
              <input type="text" name="recurring_interval" value={editForm.recurring_interval} onChange={handleEditChange}
                className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="e.g. daily" />
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
            <button onClick={handleSaveEdit} disabled={updating}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {updating ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); router.replace(`/tasks/${id}`); }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {task.status === 'PENDING' && (
              <button onClick={() => handleStatusChange('IN_PROGRESS')} disabled={updating}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                Mark In Progress
              </button>
            )}
            {task.status === 'IN_PROGRESS' && (
              <button onClick={() => handleStatusChange('COMPLETED')} disabled={updating}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                Mark Complete
              </button>
            )}
            {task.status !== 'CANCELLED' && user?.role !== 'REP' && (
              <button onClick={() => handleStatusChange('CANCELLED')} disabled={updating}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
                Cancel Task
              </button>
            )}
          </div>

          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${typeColors[task.task_type] || 'bg-gray-100'}`}>
                {task.task_type}
              </span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColors[task.status]}`}>
                {task.status}
              </span>
              <span className="text-sm font-medium text-gray-700">{task.priority}</span>
            </div>

            <p className="mb-4 text-sm text-gray-600">{task.description || 'No description'}</p>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">Assigned To:</span> {task.assigned_to ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}` : 'Unassigned'}</div>
              <div><span className="font-medium text-gray-500">Due Date:</span> {task.due_date ? new Date(task.due_date).toLocaleString() : 'Not set'}</div>
              {task.contact_name && <div><span className="font-medium text-gray-500">Related To:</span> {task.contact_name}</div>}
              {task.company_name && <div><span className="font-medium text-gray-500">Account Name:</span> {task.company_name}</div>}
              {task.sf_who_name && <div><span className="font-medium text-gray-500">Contact (Who):</span> {task.sf_who_name}</div>}
              {task.contact_email && <div><span className="font-medium text-gray-500">Email:</span> {task.contact_email}</div>}
              {task.contact_phone && <div><span className="font-medium text-gray-500">Phone:</span> {task.contact_phone}</div>}
              {task.linkedin_url && (
                <div><span className="font-medium text-gray-500">LinkedIn:</span> <a href={task.linkedin_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{task.linkedin_url}</a></div>
              )}
              {task.meeting_link && (
                <div><span className="font-medium text-gray-500">Meeting:</span> <a href={task.meeting_link} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{task.meeting_link}</a></div>
              )}
              {task.location && <div><span className="font-medium text-gray-500">Location:</span> {task.location}</div>}
              {task.is_recurring && <div><span className="font-medium text-gray-500">Recurring:</span> {task.recurring_interval || 'Yes'}</div>}
              {task.note && (
                <div className="col-span-2"><span className="font-medium text-gray-500">Note:</span> {task.note}</div>
              )}
            </div>

            {/* Salesforce Details Banner */}
            {task.salesforce_id && (task.company_name || task.contact_name || task.sf_who_name) && (
              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-blue-600" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l3 3 5-5" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="text-[12px] font-semibold text-blue-700">Salesforce Details</span>
                  <span className="ml-auto text-[10px] text-blue-400 font-mono">{task.salesforce_id}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {task.company_name && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Account Name</span>
                      <span className="text-[13px] font-medium text-gray-800">{task.company_name}</span>
                    </div>
                  )}
                  {task.contact_name && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Related To (Opportunity)</span>
                      <span className="text-[13px] font-medium text-gray-800">{task.contact_name}</span>
                    </div>
                  )}
                  {task.sf_who_name && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Name (Who)</span>
                      <span className="text-[13px] font-medium text-gray-800">{task.sf_who_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
              Created: {new Date(task.created_at).toLocaleString()} &middot; Updated: {new Date(task.updated_at).toLocaleString()}
            </div>
          </div>

          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Notes</h2>
            <div className="mb-4 flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="Add a note..."
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="self-end rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addingNote ? 'Adding...' : 'Add'}
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-gray-500">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm text-gray-700">{note.content}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {note.created_by ? `${note.created_by.first_name} ${note.created_by.last_name}` : 'System'} &middot; {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Activity Timeline</h2>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500">No activity recorded</p>
            ) : (
              <div className="relative space-y-4">
                {activities.map((activity, idx) => (
                  <div key={activity.id} className="relative pl-6">
                    {idx < activities.length - 1 && (
                      <div className="absolute left-2 top-3 h-full w-px bg-gray-200" />
                    )}
                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-indigo-500 bg-white" />
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    {activity.description && <p className="text-xs text-gray-500">{activity.description}</p>}
                    <p className="text-xs text-gray-400">
                      {activity.created_by ? `${activity.created_by.first_name} ${activity.created_by.last_name}` : 'System'} &middot; {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <EmailComposerModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        initialTo={task.contact_email || ''}
        taskContext={`${task.title} - ${task.description || ''}`}
      />
    </div>
  );
}
