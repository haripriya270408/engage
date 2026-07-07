'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface UserRef { id: string; first_name: string; last_name: string; email?: string }

interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  priority: string;
  due_date?: string;
  contact_name?: string;
  contact_email?: string;
  company_name?: string;
  sf_who_name?: string;
  assigned_to?: UserRef | null;
  assigned_by?: UserRef | null;
  created_by?: UserRef | null;
}

interface Activity {
  id: string;
  activity_type: string;
  description?: string;
  created_at: string;
  tasks?: {
    id: string;
    title: string;
    task_type: string;
  };
  users?: {
    first_name: string;
    last_name: string;
    email?: string;
  };
}

interface DashboardData {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  today_count: number;
  today_completed_count: number;
  today_tasks: Task[];
  in_progress_tasks: Task[];
  upcoming_tasks: Task[];
  completed_tasks: Task[];
  activities: Activity[];
  team_reps: UserRef[];
}

// Task type icon map – same as rep
const TASK_TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"></path></svg>,
  CALL: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.569-5.14-3.813-6.709-6.709l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"></path></svg>,
  LINKEDIN: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>,
  MEETING: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  FOLLOW_UP: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>,
  OTHER: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>,
};

const ACTIVITY_TYPE_ICON: Record<string, { bg: string; emoji: string }> = {
  CREATED:       { bg: 'bg-blue-100',   emoji: '🆕' },
  STATUS_CHANGED:{ bg: 'bg-yellow-100', emoji: '🔄' },
  ASSIGNED:      { bg: 'bg-purple-100', emoji: '👤' },
  NOTE_ADDED:    { bg: 'bg-green-100',  emoji: '📝' },
  email_sent:    { bg: 'bg-blue-100',   emoji: '✉️' },
  DEFAULT:       { bg: 'bg-gray-100',   emoji: '🔧' },
};

function getInitials(firstName?: string, lastName?: string) {
  return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase() || '??';
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Reassign Modal (manager-only) ───────────────────────────────────────── */
function ReassignModal({ task, reps, onClose, onDone }: { task: Task; reps: UserRef[]; onClose: () => void; onDone: () => void }) {
  const [selectedRep, setSelectedRep] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedRep) return toast.error('Select a rep first');
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}`, { assigned_to: selectedRep });
      toast.success('Task reassigned!');
      onDone();
    } catch { toast.error('Failed to reassign task'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl border border-gray-150 p-5 w-full max-w-sm animate-in scale-in duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-[14px] font-bold text-gray-800 mb-3 flex items-center gap-1.5">
          <span>👤</span> Reassign Task
        </h3>
        <p className="text-[12px] text-gray-500 mb-4">{task.title}</p>
        <label className="block text-[12px] font-semibold text-gray-700 mb-1">Assign to</label>
        <select
          value={selectedRep}
          onChange={e => setSelectedRep(e.target.value)}
          className="w-full border border-gray-250 rounded-lg p-2 text-[13px] outline-none focus:ring-1 focus:ring-blue-500 mb-4 text-gray-700 font-medium"
        >
          <option value="">Select a rep…</option>
          {reps.map(r => (<option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>))}
        </select>
        <div className="flex justify-end gap-2 text-[12px] font-semibold">
          <button onClick={onClose} className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 border border-gray-250 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !selectedRep} className="px-3 py-1.5 bg-[#1e293b] text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'in_progress' | 'upcoming' | 'completed'>('today');
  const [activeActivityTab, setActiveActivityTab] = useState<'ALL' | 'EMAIL' | 'CALL' | 'LINKEDIN' | 'CUSTOM'>('ALL');
  const [checkedTasks, setCheckedTasks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'priority' | 'type'>('none');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority'>('due_date');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [reassignTask, setReassignTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (!loading && user) {
      if (user.role === 'ADMIN') { router.push('/dashboard/admin'); return; }
      if (user.role === 'REP') { router.push('/dashboard'); return; }
      fetchDashboardData();
    }
  }, [loading, user, router]);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/tasks/dashboard');
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setPageLoading(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const getActiveTasks = () => {
    if (!data) return [];
    let tasks: Task[] = [];
    switch (activeTab) {
      case 'today':       tasks = data.today_tasks || []; break;
      case 'in_progress': tasks = data.in_progress_tasks || []; break;
      case 'upcoming':    tasks = data.upcoming_tasks || []; break;
      case 'completed':   tasks = data.completed_tasks || []; break;
      default:            tasks = []; break;
    }
    // Manager: apply rep filter
    if (repFilter !== 'all') {
      tasks = tasks.filter(t => t.assigned_to?.id === repFilter);
    }
    return tasks;
  };

  const q = searchQuery.toLowerCase().trim();
  const filteredTasks = getActiveTasks().filter((t) => {
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.contact_name || '').toLowerCase().includes(q) ||
      t.task_type.toLowerCase().includes(q) ||
      t.priority.toLowerCase().includes(q) ||
      (t.assigned_to ? `${t.assigned_to.first_name} ${t.assigned_to.last_name}`.toLowerCase() : '').includes(q)
    );
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Group tasks
  const groupTasks = (tasks: Task[]): { label: string; tasks: Task[] }[] => {
    if (groupBy === 'none') return [{ label: '', tasks }];
    const groups: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      const key = groupBy === 'priority' ? t.priority : t.task_type;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    const ordered = groupBy === 'priority'
      ? ['URGENT','HIGH','MEDIUM','LOW']
      : ['EMAIL','CALL','LINKEDIN','MEETING','FOLLOW_UP','OTHER'];
    return ordered.filter((k) => groups[k]).map((k) => ({ label: k, tasks: groups[k] }));
  };

  const displayTasks = sortedTasks;
  const taskGroups = groupTasks(sortedTasks);

  const getFilteredActivities = () => {
    if (!data?.activities) return [];
    if (activeActivityTab === 'ALL') return data.activities;
    return data.activities.filter((a) => a.tasks?.task_type === activeActivityTab);
  };

  const displayActivities = getFilteredActivities();

  const todayCount = data?.today_count ?? 0;
  const todayCompletedCount = data?.today_completed_count ?? 0;
  const todayPercentage = todayCount > 0 ? Math.round((todayCompletedCount / todayCount) * 100) : 0;

  const highPriorityRemaining = (data?.today_tasks || []).filter(
    (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'COMPLETED'
  ).length;

  const atRisk = data?.overdue ?? 0;

  const tabCounts = {
    today:       todayCount,
    in_progress: data?.inProgress ?? 0,
    upcoming:    data?.upcoming_tasks?.length ?? 0,
    completed:   data?.completed ?? 0,
  };

  const TABS: Array<{ key: typeof activeTab; label: string }> = [
    { key: 'today',       label: 'Today' },
    { key: 'in_progress', label: 'In-Progress' },
    { key: 'upcoming',    label: 'Upcoming' },
    { key: 'completed',   label: 'Completed' },
  ];

  const ACTIVITY_TABS: Array<{ key: typeof activeActivityTab; label: string }> = [
    { key: 'ALL',      label: 'All' },
    { key: 'EMAIL',    label: '✉️ Email' },
    { key: 'CALL',     label: '📞 Call' },
    { key: 'LINKEDIN', label: 'in LinkedIn' },
    { key: 'CUSTOM',   label: '⚙️ Custom' },
  ];

  const toggleCheck = (id: string) => {
    setCheckedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTakeAction = (task: Task) => {
    router.push(`/tasks/${task.id}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-[1380px] mx-auto px-6 py-5 space-y-4">

        {/* ── Header ── */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2.5 mb-0.5">
              <img src="/RelantoLogo.svg" alt="Relanto" className="h-5 opacity-80" />
              <h1 className="text-[18px] font-semibold text-gray-900 flex items-center gap-2">
                Sales Command Center
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              </h1>
            </div>
            <p className="text-[13px] text-gray-500">
              {highPriorityRemaining} high-priority tasks need{' '}
              <span className="text-blue-600 underline underline-offset-2 cursor-pointer">attention today</span>
              {' '}— {atRisk} at risk of slipping
            </p>
          </div>
          <button
            onClick={() => router.push('/tasks/create')}
            className="bg-[#1e293b] text-white px-4 py-2 rounded-lg text-[13px] font-medium flex items-center gap-1.5 hover:bg-slate-700 transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span> Create Task
          </button>
        </div>

        {/* ── Search / Filter Bar ── */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <div className="flex-1 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, contacts, companies..."
              className="flex-1 bg-transparent border-0 outline-none text-[13px] text-gray-600 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-4 border-l border-gray-200 pl-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="font-medium text-gray-700">Group By</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                className="bg-transparent border-0 outline-none text-[12px] text-gray-600 cursor-pointer pr-1"
              >
                <option value="none">None</option>
                <option value="priority">Priority</option>
                <option value="type">Type</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="font-medium text-gray-700">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-transparent border-0 outline-none text-[12px] text-gray-600 cursor-pointer pr-1"
              >
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
              </select>
            </div>
            {/* Manager-only: Rep filter */}
            <div className="flex items-center gap-1.5 text-[12px] border-l border-gray-200 pl-3">
              <span className="font-medium text-gray-700">Rep</span>
              <select
                value={repFilter}
                onChange={(e) => setRepFilter(e.target.value)}
                className="bg-transparent border-0 outline-none text-[12px] text-gray-600 cursor-pointer pr-1"
              >
                <option value="all">All Reps</option>
                {data?.team_reps?.filter(r => r.id !== user?.id).map(r => (
                  <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4">

            {/* Tab Bar */}
            <div className="flex justify-between items-center border-b border-gray-200">
              <div className="flex gap-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`pb-2.5 px-1 mr-5 flex items-center gap-1.5 text-[13px] font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                    }`}
                  >
                    {tab.label}
                    {tabCounts[tab.key] > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        activeTab === tab.key ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 text-[11px] font-medium pb-2.5">
                <span className="text-red-500 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {atRisk} at risk
                </span>
                <span className="text-gray-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {todayCount} due today
                </span>
              </div>
            </div>

            {/* Today's Progress */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                  </svg>
                  Today&apos;s Progress
                </h3>
                <span className="text-[12px] font-semibold text-gray-700">{todayCompletedCount}/{todayCount}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-[6px] mb-2">
                <div
                  className="bg-[#1e293b] h-[6px] rounded-full transition-all duration-700"
                  style={{ width: `${todayPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                {todayCount === 0 ? (
                  <span className="text-green-600 font-medium">All high-priority tasks complete!</span>
                ) : (
                  <span>{highPriorityRemaining} high-priority tasks remaining</span>
                )}
                <span>{todayPercentage}% complete</span>
              </div>
            </div>

            {/* Task List */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-[13px] font-semibold text-gray-800 capitalize">
                  {activeTab === 'in_progress' ? 'High Priority' : activeTab.replace('_', ' ')}
                </h3>
                <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  {displayTasks.length}
                </span>
              </div>

              {displayTasks.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-[13px]">
                    {searchQuery ? `No tasks match "${searchQuery}"` : "No tasks here — you're all caught up!"}
                  </p>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="mt-2 text-blue-600 text-[12px] hover:underline">
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {taskGroups.map((group, gi) => (
                    <div key={gi}>
                      {group.label && (
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{group.label}</span>
                          <span className="bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">{group.tasks.length}</span>
                        </div>
                      )}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                        {group.tasks.map((task) => {
                          const isHighPriority = task.priority === 'HIGH' || task.priority === 'URGENT';
                          const isChecked = checkedTasks.has(task.id);
                          const accentColor = task.priority === 'URGENT' ? '#ef4444'
                            : task.priority === 'HIGH' ? '#f97316'
                            : task.priority === 'MEDIUM' ? '#3b82f6'
                            : '#9ca3af';

                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors relative"
                              style={{ borderLeft: `3px solid ${isHighPriority ? accentColor : 'transparent'}` }}
                            >
                              {/* Checkbox */}
                              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <label className="relative flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => { e.stopPropagation(); toggleCheck(task.id); }}
                                    className="sr-only peer"
                                  />
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                    isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                                  }`}>
                                    {isChecked && (
                                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    )}
                                  </div>
                                </label>
                              </div>

                              {/* Task Type Icon */}
                              <div className="flex-shrink-0 flex items-center justify-center select-none w-5 h-5 ml-1 mr-1">
                                {TASK_TYPE_ICON[task.task_type] || TASK_TYPE_ICON['OTHER']}
                              </div>

                              {/* Main Content */}
                              <div
                                className="flex-1 min-w-0 cursor-pointer"
                                onClick={() => router.push(`/tasks/${task.id}`)}
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-gray-900 truncate">
                                    {task.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                                  {/* Account Name (company_name) • Opportunity Name (contact_name) */}
                                  {task.company_name && (
                                    <>
                                      <span className="font-medium text-gray-600">{task.company_name}</span>
                                      {task.contact_name && <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />}
                                    </>
                                  )}
                                  {task.contact_name && (
                                    <span className="text-gray-500 truncate max-w-[120px]">{task.contact_name}</span>
                                  )}
                                  {(task.company_name || task.contact_name) && task.assigned_to && (
                                    <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
                                  )}
                                  {task.assigned_to && (
                                    <>
                                      <span className="text-gray-500">→ {task.assigned_to.first_name} {task.assigned_to.last_name}</span>
                                      {task.due_date && <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />}
                                    </>
                                  )}
                                  {task.due_date && (
                                    <span className="flex items-center gap-0.5">
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                      </svg>
                                      Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right side: priority badge + Reassign + Take Action */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                  task.priority === 'URGENT' ? 'bg-red-50 text-red-600' :
                                  task.priority === 'HIGH'   ? 'bg-orange-50 text-orange-600' :
                                  task.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-600' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {task.priority}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setReassignTask(task); }}
                                  className="text-[11px] font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors whitespace-nowrap"
                                >
                                  Reassign
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTakeAction(task); }}
                                  className="text-[11px] font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors whitespace-nowrap"
                                >
                                  Take Action
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN – Recent Activity ── */}
          <div className="space-y-0">

            {/* Activity Tab Bar */}
            <div className="flex gap-3 border-b border-gray-200 pb-0 mb-4 overflow-x-auto">
              {ACTIVITY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveActivityTab(tab.key)}
                  className={`pb-2.5 px-0.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    activeActivityTab === tab.key
                      ? 'text-gray-900 border-b-2 border-gray-900'
                      : 'text-gray-400 hover:text-gray-600 border-b-2 border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Activity Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-gray-800">Recent Activity</h3>
              <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                {displayActivities.length}
              </span>
            </div>

            {displayActivities.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
                <p className="text-gray-400 text-[13px]">No recent activity</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
                {displayActivities.map((activity) => {
                  const iconInfo = ACTIVITY_TYPE_ICON[activity.activity_type] || ACTIVITY_TYPE_ICON.DEFAULT;
                  const initials = getInitials(activity.users?.first_name, activity.users?.last_name);
                  const taskTypeEmoji = activity.tasks ? (TASK_TYPE_ICON[activity.tasks.task_type] || '📋') : null;

                  return (
                    <div key={activity.id} className="p-3.5 flex gap-3">
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${iconInfo.bg} flex items-center justify-center text-[11px] font-bold text-gray-600`}>
                        {initials !== '??' ? initials : <span className="text-[13px]">{iconInfo.emoji}</span>}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <span className="text-[12px] font-semibold text-gray-900">
                              {activity.users?.first_name} {activity.users?.last_name}
                            </span>
                            {activity.tasks && (
                              <span className="text-[11px] text-gray-400 ml-1">
                                — {activity.tasks.title}
                              </span>
                            )}
                          </div>
                          {taskTypeEmoji && (
                            <span className="text-[13px] flex-shrink-0 ml-1">{taskTypeEmoji}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                          {activity.description}
                          {activity.tasks && (
                            <span
                              onClick={() => router.push(`/tasks/${activity.tasks?.id}`)}
                              className="font-semibold text-blue-600 hover:underline cursor-pointer ml-1"
                            >
                              {activity.tasks.title}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {timeAgo(activity.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reassign Modal ── */}
      {reassignTask && (
        <ReassignModal
          task={reassignTask}
          reps={(data?.team_reps || []).filter(r => r.id !== user?.id)}
          onClose={() => setReassignTask(null)}
          onDone={() => { setReassignTask(null); fetchDashboardData(); }}
        />
      )}
    </div>
  );
}
