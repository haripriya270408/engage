'use client';

import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const TABS = ['Compose', 'Templates', 'Outlook Settings'] as const;
type Tab = (typeof TABS)[number];

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export default function EmailPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Compose');

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

  const [outlookStatus, setOutlookStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const [fromEmail, setFromEmail] = useState('');

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiContext, setAiContext] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) { toast.error('Please enter at least one recipient'); return; }
    setSending(true);
    try {
      await api.post('/email/outlook/send', {
        to: to.split(',').map((s) => s.trim()),
        cc: cc ? cc.split(',').map((s) => s.trim()) : [],
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
      if (msg.toLowerCase().includes('outlook') || msg.toLowerCase().includes('connect')) {
        toast.error('Outlook not connected. Please connect Outlook in Settings first.');
      } else {
        toast.error(msg || 'Failed to send email');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      await api.post('/email/templates', {
        name: `Draft - ${subject || 'Untitled'}`,
        subject,
        body,
      });
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save draft');
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

  const checkOutlookStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data } = await api.get('/email/outlook/status');
      setOutlookStatus(data);
      if (data?.outlook_email) setFromEmail(data.outlook_email);
    } catch {
      setOutlookStatus(null);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectOutlook = async () => {
    try {
      const { data } = await api.get('/email/outlook/auth-url');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error('Failed to initiate Outlook connection');
    }
  };

  const handleDisconnectOutlook = async () => {
    try {
      await api.post('/email/outlook/disconnect');
      toast.success('Outlook disconnected');
      setOutlookStatus(null);
    } catch {
      toast.error('Failed to disconnect Outlook');
    }
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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'Templates') fetchTemplates();
    if (tab === 'Outlook Settings') checkOutlookStatus();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Email Workspace</h1>

      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-primary shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Compose' && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-foreground">From</label>
            <input
              type="text"
              value={fromEmail || 'Connect Outlook in Settings to see your email'}
              readOnly
              className="mt-1 block w-full rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm text-muted outline-none"
            />
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
              onClick={handleSaveDraft}
              className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-50"
            >
              Save Draft
            </button>
            <button
              onClick={() => setShowAiModal(true)}
              className="rounded-lg border border-primary px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light"
            >
              AI Assist
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">Email Templates</h2>
            <button
              onClick={() => setShowTemplateForm(!showTemplateForm)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              {showTemplateForm ? 'Cancel' : 'New Template'}
            </button>
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
                  className="cursor-pointer rounded-xl border border-border bg-white p-4 transition-colors hover:bg-gray-50"
                >
                  <h3 className="font-medium text-foreground">{tpl.name}</h3>
                  {tpl.subject && <p className="mt-1 text-sm text-muted">{tpl.subject}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Outlook Settings' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-foreground">Outlook Connection</h2>
            {checkingStatus ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Checking status...
              </div>
            ) : outlookStatus?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-success">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" />
                  Connected as {outlookStatus.email || 'Outlook user'}
                </div>
                <button
                  onClick={handleDisconnectOutlook}
                  className="rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-red-50"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted">Connect your Outlook account to send emails directly from the platform.</p>
                <button
                  onClick={handleConnectOutlook}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Connect Outlook
                </button>
                <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-muted">
                  <p className="font-medium text-foreground">Instructions:</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1">
                    <li>Click &quot;Connect Outlook&quot; above</li>
                    <li>Sign in with your Microsoft account</li>
                    <li>Grant the requested permissions</li>
                    <li>You will be redirected back once connected</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-lg">
            <h2 className="text-lg font-medium text-foreground">AI Compose Assistant</h2>
            <form onSubmit={handleAiCompose} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Describe what you want to write</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g., A follow-up email after a product demo"
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Tone</label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">Additional Context (optional)</label>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={2}
                  placeholder="Any specific details to include"
                  className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={generating}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
