'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type Step =
  | 'loading'   // exchanging code with Microsoft
  | 'role'      // brand new user — pick Manager or Rep (first time only)
  | 'pending'   // registered but awaiting admin approval
  | 'error';    // something went wrong

function EmailRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const msError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsToken, setSavedMsToken] = useState('');
  // Prevent double-fire from React StrictMode in dev
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (msError) {
      toast.error(`Microsoft error: ${errorDescription || msError}`);
      router.push('/login');
      return;
    }
    if (!code) {
      router.push('/login');
      return;
    }
    attemptLogin({ code, role: undefined, msToken: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attemptLogin = async (params: {
    code?: string;
    role?: 'MANAGER' | 'REP';
    msToken?: string;
  }) => {
    const codeVerifier = sessionStorage.getItem('pkce_verifier') || '';
    try {
      const res = await fetch(`${API_URL}/auth/microsoft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: params.code || '',
          codeVerifier,
          role: params.role,
          msToken: params.msToken,
        }),
      });

      const data = await res.json();

      // New user — needs to pick a role
      if (res.status === 401 && data.message === 'ROLE_REQUIRED') {
        if (data.msToken) setSavedMsToken(data.msToken);
        setStep('role');
        return;
      }

      // Account pending admin approval
      if (res.status === 403 && data.message?.toLowerCase().includes('pending admin approval')) {
        setStep('pending');
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.message || 'Authentication failed');
        setStep('error');
        return;
      }

      // Success
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ADMIN') {
        window.location.href = '/dashboard/admin';
      } else if (data.user.role === 'MANAGER') {
        window.location.href = '/dashboard/manager';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setErrorMsg('An error occurred during authentication');
      setStep('error');
    }
  };

  const handleRoleSelect = async (selectedRole: 'MANAGER' | 'REP') => {
    setStep('loading');
    await attemptLogin({
      code: code || '',
      role: selectedRole,
      msToken: savedMsToken || undefined,
    });
  };

  if (step === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500 text-sm">Signing you in with Microsoft…</p>
        </div>
      </div>
    );
  }

  if (step === 'role') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Your Role</h1>
          <p className="text-gray-500 text-sm mb-8">
            Choose your role to complete registration. An admin will review and approve your account before you can sign in.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => handleRoleSelect('MANAGER')}
              className="w-full rounded-xl border-2 border-transparent bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Manager
            </button>
            <button
              onClick={() => handleRoleSelect('REP')}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sales Rep
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50">
            <svg className="h-7 w-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approval</h1>
          <p className="text-gray-500 text-sm mb-2">Your account is awaiting admin approval.</p>
          <p className="text-gray-500 text-sm mb-8">
            You will be able to sign in once an administrator approves your request.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-500 text-sm mb-8">{errorMsg}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function EmailRedirect() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      }
    >
      <EmailRedirectContent />
    </Suspense>
  );
}
