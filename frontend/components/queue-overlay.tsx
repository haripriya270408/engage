'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Task {
  id: string;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  company_name: string | null;
  contact_name: string | null;
  sf_who_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  salesforce_id: string | null;
  description?: string;
}

interface QueueOverlayProps {
  isOpen: boolean;
  tasks: Task[];
  onClose: () => void;
  onMarkComplete: (taskId: string) => Promise<void>;
}

export default function QueueOverlay({ isOpen, tasks, onClose, onMarkComplete }: QueueOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Email states
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  useEffect(() => {
    if (isOpen && tasks.length > 0) {
      setCurrentIndex(0);
    }
  }, [isOpen, tasks]);

  useEffect(() => {
    const task = tasks[currentIndex];
    if (task && task.task_type?.toLowerCase() === 'email') {
      setTo(task.contact_email || '');
      setSubject(`Following up regarding: ${task.title}`);
      setBody('');
      fetchTemplates();
    }
  }, [currentIndex, tasks]);

  const fetchTemplates = async () => {
    try {
      const { data } = await api.get('/email/templates');
      setTemplates(data);
    } catch {
      // ignore
    }
  };

  const handleSendEmail = async () => {
    if (!to.trim()) { toast.error('Please enter at least one recipient'); return; }
    setSending(true);
    try {
      await api.post('/email/outlook/send', {
        to_emails: to.split(',').map((s) => s.trim()).filter(Boolean),
        cc_emails: cc ? cc.split(',').map((s) => s.trim()).filter(Boolean) : [],
        subject,
        body,
      });
      toast.success('Email sent successfully');
      
      // Optionally auto-complete the task if email succeeds
      await onMarkComplete(tasks[currentIndex].id);
      handleNext();
    } catch (err: unknown) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < tasks.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      toast.success('Queue completed!');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  if (!isOpen || tasks.length === 0) return null;

  const currentTask = tasks[currentIndex];
  const type = currentTask.task_type?.toLowerCase() || 'other';

  // Generate calendar scheduling links
  const taskTitle = encodeURIComponent(`Meeting: ${currentTask.title}`);
  const taskDesc = encodeURIComponent(`${currentTask.description || ''}\n\nRelated to: ${currentTask.company_name || 'N/A'}`);
  const contactEmail = encodeURIComponent(currentTask.contact_email || '');
  
  // Outlook Calendar (often used for Teams)
  const teamsScheduleUrl = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${taskTitle}&body=${taskDesc}&to=${contactEmail}`;
  
  // Google Calendar (often used for Zoom/Meet)
  const zoomScheduleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${taskTitle}&details=${taskDesc}&add=${contactEmail}`;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center rounded-full bg-blue-100 text-blue-600 px-3 py-1 text-sm font-semibold">
            Task {currentIndex + 1} of {tasks.length}
          </div>
          <h2 className="text-lg font-bold text-gray-800">{currentTask.title}</h2>
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex justify-center">
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          
          {/* Task Context Banner */}
          <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-center justify-between">
            <div className="grid grid-cols-3 gap-8 text-sm w-full">
              <div>
                <span className="block text-xs font-semibold text-blue-500 uppercase tracking-wide">Contact</span>
                <span className="font-medium text-gray-800">{currentTask.contact_name || currentTask.sf_who_name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-blue-500 uppercase tracking-wide">Account</span>
                <span className="font-medium text-gray-800">{currentTask.company_name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-blue-500 uppercase tracking-wide">Phone / Email</span>
                <span className="font-medium text-gray-800 break-all">{currentTask.contact_phone || currentTask.contact_email || 'N/A'}</span>
              </div>
            </div>
            <div className="text-right pl-4">
              <span className="inline-block px-2.5 py-1 text-xs font-bold rounded bg-gray-200 text-gray-700 uppercase tracking-wider">
                {type}
              </span>
            </div>
          </div>

          <div className="p-8 flex-1">
            {type === 'call' && (
              <div className="flex flex-col items-center justify-center h-full space-y-8 py-12">
                <div className="text-center space-y-2">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Initiate Call</h3>
                  <p className="text-gray-500">Connect with {currentTask.contact_name || currentTask.sf_who_name || 'the contact'}</p>
                </div>

                <div className="flex gap-4">
                  <a
                    href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent('Meeting: ' + currentTask.title)}&body=${encodeURIComponent((currentTask.description || '') + (currentTask.contact_name ? '\n\nContact: ' + currentTask.contact_name : '') + (currentTask.company_name ? '\nCompany: ' + currentTask.company_name : ''))}&to=${encodeURIComponent(currentTask.contact_email || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#5B5FC7] text-white text-[13px] font-semibold rounded-xl hover:bg-[#4a4db0] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4h-19C1.67 4 1 4.67 1 5.5v13c0 .83.67 1.5 1.5 1.5h19c.83 0 1.5-.67 1.5-1.5v-13c0-.83-.67-1.5-1.5-1.5zM19 8.5l-7 4.5-7-4.5V6l7 4.5L19 6v2.5z"/></svg>
                    Connect Teams
                  </a>
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Meeting: ' + currentTask.title)}&details=${encodeURIComponent((currentTask.description || '') + (currentTask.contact_name ? '\n\nContact: ' + currentTask.contact_name : '') + (currentTask.company_name ? '\nCompany: ' + currentTask.company_name : ''))}&add=${encodeURIComponent(currentTask.contact_email || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2D8CFF] text-white text-[13px] font-semibold rounded-xl hover:bg-[#1a73e8] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 8.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-1.5l4 2.5V6l-4 2.5z"/></svg>
                    Connect Zoom
                  </a>
                  {currentTask.contact_phone && (
                    <a
                      href={`tel:${currentTask.contact_phone}`}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-gray-200 text-gray-700 font-medium hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Call via Phone
                    </a>
                  )}
                </div>
              </div>
            )}

            {type === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">To</label>
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                    <span>Message</span>
                    <select
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs outline-none bg-gray-50"
                      onChange={(e) => {
                        const templateId = e.target.value;
                        const tmpl = templates.find((t) => t.id === templateId);
                        if (tmpl) {
                          setSubject(tmpl.subject);
                          setBody(tmpl.body);
                        }
                      }}
                    >
                      <option value="">Insert Template...</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    placeholder="Write your email here..."
                    className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSendEmail}
                    disabled={sending}
                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {sending ? 'Sending...' : 'Send & Complete'}
                  </button>
                </div>
              </div>
            )}

            {type !== 'call' && type !== 'email' && (
              <div className="flex flex-col justify-center items-center h-full py-12 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500 mb-4">
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Manual Task Execution</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  This task type ({type}) doesn't have an automated execution flow. Please perform this action manually.
                </p>
                {currentTask.description && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left w-full max-w-xl border border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Description</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentTask.description}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="h-20 bg-white border-t border-gray-200 px-8 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-30 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              await onMarkComplete(currentTask.id);
              handleNext();
            }}
            className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-sm"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Mark Complete
          </button>
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {currentIndex === tasks.length - 1 ? 'Finish Queue' : 'Skip & Next'}
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
