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

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTo?: string;
  taskContext?: string;
}

export default function EmailComposerModal({ isOpen, onClose, initialTo = '', taskContext = '' }: EmailComposerModalProps) {
  const [subject, setSubject] = useState('');
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(taskContext ? `Write an email regarding the task: ${taskContext}` : '');
  const [aiTone, setAiTone] = useState('professional');
  const [aiContext, setAiContext] = useState(taskContext);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(initialTo);
      fetchTemplates();
    }
  }, [isOpen, initialTo]);

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
      setCc('');
      setBody('');
      onClose();
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { message?: unknown } } };
      const msg = String(errResp.response?.data?.message || '');
      toast.error(msg || 'Failed to send email');
    } finally {
      setSending(false);
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
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { message?: unknown } } };
      const msg = String(errResp.response?.data?.message || 'Failed to generate email');
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Compose Email</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 relative">
          <div>
            <label className="block text-sm font-medium text-foreground">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
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
            <label className="block text-sm font-medium text-foreground mb-1 flex justify-between items-center">
              <span>Body</span>
              <div className="flex gap-2">
                <select
                  className="rounded-lg border border-border px-2 py-1 text-xs outline-none"
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
                <button
                  type="button"
                  onClick={async () => {
                    const textarea = document.getElementById('modal-email-body-textarea') as HTMLTextAreaElement;
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
                  className="flex items-center gap-1 rounded-lg border border-primary text-primary px-3 py-1 text-xs font-medium hover:bg-primary-light disabled:opacity-50"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {generating ? 'Rephrasing...' : 'Rephrase Selection'}
                </button>
              </div>
            </label>
            <textarea
              id="modal-email-body-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your email here..."
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>


        </div>
      </div>
    </div>
  );
}
