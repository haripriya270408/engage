'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

interface ReminderSettings {
  enabled: boolean;
  reminder_time: string;
  readonly?: boolean;
}

import { Suspense } from 'react';

function ProfileContent() {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const [reminder, setReminder] = useState<ReminderSettings>({ enabled: false, reminder_time: '09:00' });
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);

  const [salesforceStatus, setSalesforceStatus] = useState<boolean | null>(null);
  const [salesforceAccountId, setSalesforceAccountId] = useState<string | null>(null);
  const [loadingSalesforce, setLoadingSalesforce] = useState(false);

  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/users/profile');
        setFirstName(data.first_name || '');
        setLastName(data.last_name || '');
        setPhone(data.phone || '');
      } catch {
        if (user) {
          setFirstName(user.first_name || '');
          setLastName(user.last_name || '');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const fetchReminder = async () => {
      setLoadingReminder(true);
      try {
        const { data } = await api.get('/notifications/reminder-settings');
        setReminder({
          enabled: data.enabled ?? false,
          reminder_time: data.reminder_time ?? '09:00',
          readonly: data.readonly ?? false
        });
      } catch {
        // defaults
      } finally {
        setLoadingReminder(false);
      }
    };
    fetchReminder();
  }, []);

  useEffect(() => {
    const sfParam = searchParams.get('salesforce');
    if (sfParam === 'success') {
      toast.success('Successfully connected to Salesforce');
      // Remove query param to prevent toast on refresh
      window.history.replaceState(null, '', '/profile');
    } else if (sfParam === 'error') {
      const msg = searchParams.get('message');
      toast.error(`Salesforce connection failed: ${msg || 'Unknown error'}`);
      window.history.replaceState(null, '', '/profile');
    }

    const fetchSalesforceStatus = async () => {
      try {
        const { data } = await api.get('/salesforce/status');
        setSalesforceStatus(data.connected);
        setSalesforceAccountId(data.accountId || null);
      } catch {
        setSalesforceStatus(false);
        setSalesforceAccountId(null);
      }
    };
    fetchSalesforceStatus();
  }, [searchParams]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { first_name: firstName, last_name: lastName, phone });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReminder(true);
    try {
      await api.post('/notifications/reminder-settings', {
        is_enabled: reminder.enabled,
        reminder_time: reminder.reminder_time,
      });
      toast.success('Reminder settings saved');
    } catch {
      toast.error('Failed to save reminder settings');
    } finally {
      setSavingReminder(false);
    }
  };

  const handleConnectSalesforce = async () => {
    setLoadingSalesforce(true);
    try {
      const { data } = await api.get('/salesforce/auth-url');
      window.location.href = data.url;
    } catch {
      toast.error('Failed to get Salesforce connection URL');
      setLoadingSalesforce(false);
    }
  };

  const handleDisconnectSalesforce = async () => {
    setLoadingSalesforce(true);
    try {
      await api.delete('/salesforce/disconnect');
      setSalesforceStatus(false);
      toast.success('Successfully disconnected from Salesforce');
    } catch {
      toast.error('Failed to disconnect from Salesforce');
    } finally {
      setLoadingSalesforce(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Profile</h1>

      <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-foreground">User Information</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-muted">Email</p>
            <p className="text-sm font-medium text-foreground">{user?.email || '-'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-muted">Role</p>
            <p className="text-sm font-medium text-foreground">{user?.role || '-'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-muted">Status</p>
            <p className="text-sm font-medium text-foreground">{user?.status || '-'}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {user?.role !== 'ADMIN' && (
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-foreground">Daily Reminder Settings</h2>
          {loadingReminder ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleSaveReminder} className="space-y-4">
                {reminder.readonly ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-muted">Daily Reminder</p>
                      <p className="text-sm font-medium text-foreground">
                        {reminder.enabled ? `Enabled at ${reminder.reminder_time || '09:00'}` : 'Disabled'}
                      </p>
                      <p className="mt-1 text-xs text-muted">Set by your manager</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={reminder.enabled}
                          onChange={(e) => setReminder({ ...reminder, enabled: e.target.checked })}
                          className="peer sr-only"
                        />
                        <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full" />
                      </label>
                      <span className="text-sm text-foreground">Enable daily reminders</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Reminder Time</label>
                      <input
                        type="time"
                        value={reminder.reminder_time}
                        onChange={(e) => setReminder({ ...reminder, reminder_time: e.target.value })}
                        className="mt-1 block w-48 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingReminder}
                      className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      {savingReminder ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
            </form>
          )}
        </div>
      )}

      {/* Salesforce Integration Section */}
      <div className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium text-foreground">Integrations</h2>
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Salesforce CRM</p>
            <p className="text-xs text-muted mt-1">
              Connect your personal Salesforce account to enable automatic two-way task synchronization.
            </p>
          </div>
          <div className="flex flex-col items-end">
            {salesforceStatus === null ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : salesforceStatus ? (
              <div className="flex flex-col items-end gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Connected
                </span>
                {salesforceAccountId && (
                  <span className="text-xs text-gray-500">{salesforceAccountId}</span>
                )}
                <button
                  onClick={handleDisconnectSalesforce}
                  disabled={loadingSalesforce}
                  className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                >
                  {loadingSalesforce ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectSalesforce}
                disabled={loadingSalesforce}
                className="rounded-lg bg-[#00A1E0] px-4 py-2 text-sm font-medium text-white hover:bg-[#008fcc] disabled:opacity-50"
              >
                {loadingSalesforce ? 'Connecting...' : 'Connect to Salesforce'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
