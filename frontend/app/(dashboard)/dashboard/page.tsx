'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  priority: string;
  due_date: string;
}

interface Activity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  tasks?: {
    id: string;
    title: string;
    task_type: string;
  };
  users?: {
    first_name: string;
    last_name: string;
    email: string;
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
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'in_progress' | 'upcoming' | 'completed' | 'snoozed'>('today');
  const [activeActivityTab, setActiveActivityTab] = useState<'ALL' | 'EMAIL' | 'CALL' | 'LINKEDIN'>('ALL');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user) {
      if (user.role === 'ADMIN') {
        router.push('/dashboard/admin');
        return;
      }
      if (user.role === 'MANAGER') {
        router.push('/dashboard/manager');
        return;
      }
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Get active list tasks
  const getActiveTasks = () => {
    if (!data) return [];
    switch (activeTab) {
      case 'today':
        return data.today_tasks || [];
      case 'in_progress':
        return data.in_progress_tasks || [];
      case 'upcoming':
        return data.upcoming_tasks || [];
      case 'completed':
        return data.completed_tasks || [];
      case 'snoozed':
      default:
        return [];
    }
  };

  const displayTasks = getActiveTasks();

  // Get filtered activities
  const getFilteredActivities = () => {
    if (!data || !data.activities) return [];
    if (activeActivityTab === 'ALL') return data.activities;
    return data.activities.filter(
      (act) => act.tasks?.task_type === activeActivityTab
    );
  };

  const displayActivities = getFilteredActivities();

  // Progress calculations
  const todayCount = data?.today_count ?? 0;
  const todayCompletedCount = data?.today_completed_count ?? 0;
  const todayPercentage = todayCount > 0 ? Math.round((todayCompletedCount / todayCount) * 100) : 0;

  // Count high/urgent priority remaining today
  const remainingHighPriorityToday = (data?.today_tasks || []).filter(
    (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'COMPLETED'
  ).length;

  // Counts for tabs
  const tabCounts = {
    today: todayCount,
    in_progress: data?.inProgress ?? 0,
    upcoming: data?.upcoming_tasks?.length ?? 0,
    completed: data?.completed ?? 0,
    snoozed: 0,
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <img src="/RelantoLogo.svg" alt="Relanto" className="h-6" />
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              Sales Command Center
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
            </h1>
          </div>
          <p className="text-gray-500 mt-1">
            {remainingHighPriorityToday} high-priority tasks need attention today — {data?.overdue ?? 0} overdue
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Logout
          </button>
          <button 
            onClick={() => router.push('/tasks/create')}
            className="bg-[#1e293b] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Create Task
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-200">
        <button className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-2 border-l border-gray-200 pl-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input 
            type="text" 
            placeholder="Search tasks..." 
            onClick={() => router.push('/tasks')}
            className="w-full bg-transparent border-0 px-2 py-1.5 outline-none text-sm cursor-pointer"
            readOnly
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        {/* Left Column - Tasks */}
        <div className="space-y-6">
          
          {/* Tabs */}
          <div className="flex justify-between items-center border-b border-gray-200">
            <div className="flex gap-6 text-sm font-medium">
              <button 
                onClick={() => setActiveTab('today')}
                className={`pb-3 flex items-center gap-2 transition-colors ${
                  activeTab === 'today'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Today 
                <span className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === 'today' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabCounts.today}
                </span>
              </button>
              <button 
                onClick={() => setActiveTab('in_progress')}
                className={`pb-3 flex items-center gap-2 transition-colors ${
                  activeTab === 'in_progress'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                In Progress 
                <span className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabCounts.in_progress}
                </span>
              </button>
              <button 
                onClick={() => setActiveTab('upcoming')}
                className={`pb-3 flex items-center gap-2 transition-colors ${
                  activeTab === 'upcoming'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Upcoming
                <span className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === 'upcoming' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabCounts.upcoming}
                </span>
              </button>
              <button 
                onClick={() => setActiveTab('completed')}
                className={`pb-3 flex items-center gap-2 transition-colors ${
                  activeTab === 'completed'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Completed 
                <span className={`py-0.5 px-2 rounded-full text-xs font-medium ${
                  activeTab === 'completed' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {tabCounts.completed}
                </span>
              </button>
              <button 
                onClick={() => setActiveTab('snoozed')}
                className={`pb-3 flex items-center gap-2 transition-colors ${
                  activeTab === 'snoozed'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Snoozed
              </button>
            </div>
            <div className="flex gap-4 text-xs font-medium pb-3">
              <span className="text-red-500 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {data?.overdue ?? 0} overdue
              </span>
              <span className="text-gray-400 flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {todayCount} due today
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                Today&apos;s Progress
              </h3>
              <span className="text-sm font-medium text-gray-800">{todayCompletedCount}/{todayCount}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
              <div 
                className="bg-[#1e293b] h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${todayPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{remainingHighPriorityToday} high-priority tasks remaining</span>
              <span>{todayPercentage}% complete</span>
            </div>
          </div>

          {/* Dynamic Task List */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold text-gray-800 capitalize">
                {activeTab.replace('_', ' ')} Tasks
              </h3>
              <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs font-medium">
                {displayTasks.length}
              </span>
            </div>
            
            {displayTasks.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h4 className="text-gray-900 font-medium mb-1">No tasks for this category</h4>
                <p className="text-gray-500 text-sm">You&apos;re all caught up! Enjoy your day.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
                {displayTasks.map((task) => (
                  <div 
                    key={task.id} 
                    onClick={() => router.push(`/tasks/${task.id}`)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        task.priority === 'URGENT' ? 'bg-red-500' :
                        task.priority === 'HIGH' ? 'bg-orange-500' :
                        task.priority === 'MEDIUM' ? 'bg-blue-500' :
                        'bg-gray-400'
                      }`} title={`${task.priority} Priority`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px] sm:max-w-md">
                          {task.description || 'No description provided'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full uppercase ${
                        task.task_type === 'EMAIL' ? 'bg-blue-50 text-blue-700' :
                        task.task_type === 'CALL' ? 'bg-green-50 text-green-700' :
                        task.task_type === 'LINKEDIN' ? 'bg-indigo-50 text-indigo-700' :
                        task.task_type === 'MEETING' ? 'bg-purple-50 text-purple-700' :
                        task.task_type === 'FOLLOW_UP' ? 'bg-orange-50 text-orange-700' :
                        'bg-gray-50 text-gray-700'
                      }`}>
                        {task.task_type.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column - Recent Activity */}
        <div>
          <div className="flex gap-4 text-xs font-medium border-b border-gray-200 pb-3 mb-6">
            <button 
              onClick={() => setActiveActivityTab('ALL')}
              className={`pb-3 -mb-[13px] transition-colors ${
                activeActivityTab === 'ALL' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveActivityTab('EMAIL')}
              className={`pb-3 -mb-[13px] transition-colors flex items-center gap-1 ${
                activeActivityTab === 'EMAIL' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ✉️ Email
            </button>
            <button 
              onClick={() => setActiveActivityTab('CALL')}
              className={`pb-3 -mb-[13px] transition-colors flex items-center gap-1 ${
                activeActivityTab === 'CALL' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              📞 Call
            </button>
            <button 
              onClick={() => setActiveActivityTab('LINKEDIN')}
              className={`pb-3 -mb-[13px] transition-colors flex items-center gap-1 ${
                activeActivityTab === 'LINKEDIN' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              in LinkedIn
            </button>
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-800">Recent Activity</h3>
            <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs font-medium">
              {displayActivities.length}
            </span>
          </div>
          
          {displayActivities.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center h-48 flex flex-col items-center justify-center shadow-sm">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {displayActivities.map((activity) => (
                <div key={activity.id} className="py-3 flex gap-3 text-left">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-sm">
                    {activity.activity_type === 'CREATED' ? '🆕' :
                     activity.activity_type === 'STATUS_CHANGED' ? '🔄' :
                     activity.activity_type === 'ASSIGNED' ? '👤' :
                     activity.activity_type === 'NOTE_ADDED' ? '📝' :
                     '🔧'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">
                      {activity.users?.first_name} {activity.users?.last_name}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activity.description} {activity.tasks ? 'for ' : ''}
                      {activity.tasks && (
                        <span 
                          onClick={() => router.push(`/tasks/${activity.tasks?.id}`)}
                          className="font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          {activity.tasks.title}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
