'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';

const TABS = ['Compose', 'Templates', 'Outlook Settings'] as const;
type Tab = (typeof TABS)[number];

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export default function EmailPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Compose');

  const [subject, setSubject] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateBody, setTemplateBody] = useState('');

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiContext, setAiContext] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (activeTab === 'Templates') {
      fetchTemplates();
    }
  }, [activeTab]);

  const handleSend = async () => {
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
      setSubject('');
      setTo('');
      setCc('');
      setBody('');
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { message?: unknown } } };
      const msg = String(errResp.response?.data?.message || '');
      toast.error(msg || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await api.delete(`/email/templates/${templateId}`);
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await api.get('/email/templates');
      setTemplates(data);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) { toast.error('Template name is required'); return; }
    try {
      await api.post('/email/templates', { name: templateName, subject: templateSubject, body: templateBody });
      toast.success('Template created');
      setShowTemplateForm(false);
      setTemplateName('');
      setTemplateSubject('');
      setTemplateBody('');
      fetchTemplates();
    } catch {
      toast.error('Failed to create template');
    }
  };

  const loadTemplate = (tpl: Template) => {
    setSubject(tpl.subject);
    setBody(tpl.body);
    setActiveTab('Compose');
    toast.success(`Loaded template: ${tpl.name}`);
  };

  const handleAiCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) { toast.error('Please enter a prompt'); return; }
    setGenerating(true);
    try {
      const { data } = await api.post('/email/ai/compose', { prompt: aiPrompt, tone: aiTone, context: aiContext });
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      toast.success('AI generated email content');
      setShowAiModal(false);
      setAiPrompt('');
      setAiContext('');
    } catch {
      toast.error('Failed to generate with AI');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Email Workspace</h1>

        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {['Compose', 'Templates'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
                ${activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:border-border hover:text-foreground'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>

      {activeTab === 'Compose' && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm text-gray-500">Sending as <span className="font-medium text-gray-800">{user?.email}</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com (optional)"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Body</label>
            <textarea
              id="email-body-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Write your email here..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>

            <button
              onClick={async () => {
                const textarea = document.getElementById('email-body-textarea') as HTMLTextAreaElement;
                if (!textarea) return;
                const selectedText = body.substring(textarea.selectionStart, textarea.selectionEnd);
                if (!selectedText.trim()) {
                  toast.error('Please select some text in the body to rephrase');
                  return;
                }
                setGenerating(true);
                try {
                  const { data } = await api.post('/email/ai/compose', { 
                    prompt: `Rephrase and correct this text to sound more professional: "${selectedText}"`,
                    tone: 'professional'
                  });
                  if (data.body) {
                    const newBody = body.substring(0, textarea.selectionStart) + data.body + body.substring(textarea.selectionEnd);
                    setBody(newBody);
                    toast.success('Text rephrased successfully');
                  }
                } catch (err: unknown) {
                  const errResp = err as { response?: { data?: { message?: unknown } } };
                  const msg = String(errResp.response?.data?.message || 'Failed to rephrase');
                  toast.error(msg);
                } finally {
                  setGenerating(false);
                }
              }}
              disabled={generating}
              className="rounded-lg border border-primary px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {generating ? 'Rephrasing...' : 'Rephrase Selection'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Email Templates</h2>
            {user?.role !== 'REP' && (
              <button
                onClick={() => setShowTemplateForm(!showTemplateForm)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                {showTemplateForm ? 'Cancel' : 'New Template'}
              </button>
            )}
          </div>

          {showTemplateForm && (
            <form onSubmit={handleCreateTemplate} className="space-y-3 rounded-xl border border-border bg-white p-6 shadow-sm">
              <div>
                <label className="block text-sm font-medium text-foreground">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Subject</label>
                <input
                  type="text"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Body</label>
                <textarea
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={6}
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                Create Template
              </button>
            </form>
          )}

          {loadingTemplates ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-12 text-center">
              <p className="text-muted">No templates yet. Create your first template.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => loadTemplate(tpl)}
                  className="cursor-pointer rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-medium text-foreground">{tpl.name}</h3>
                    {tpl.subject && <p className="mt-1 text-sm text-muted">{tpl.subject}</p>}
                  </div>
                  {user?.role === 'MANAGER' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this template?')) {
                          handleDeleteTemplate(tpl.id);
                        }
                      }}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
