'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';

function EmailRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const [role, setRole] = useState<'MANAGER' | 'REP' | null>(null);
  const [processing, setProcessing] = useState(false);
  const { login } = useAuth(); // We might need a custom login function for Microsoft, but let's just do fetch here

  useEffect(() => {
    if (error) {
      toast.error(`Microsoft Error: ${errorDescription || error}`);
      router.push(state ? '/email-workspace' : '/login');
      return;
    }
    if (!code) {
      toast.error('No authorization code provided');
      router.push('/login');
      return;
    }
  }, [code, error, errorDescription, router]);

  const handleRoleSelect = async (selectedRole: 'MANAGER' | 'REP') => {
    setRole(selectedRole);
    setProcessing(true);

    try {
      const codeVerifier = sessionStorage.getItem('pkce_verifier') || '';
      const res = await fetch('http://localhost:3000/api/auth/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, role: selectedRole, codeVerifier })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Trigger a custom event or page reload to update auth context
        if (data.user.role === 'ADMIN') {
          window.location.href = '/dashboard/admin';
        } else if (data.user.role === 'MANAGER') {
          window.location.href = '/dashboard/manager';
        } else {
          window.location.href = '/dashboard';
        }
      } else {
        const err = await res.json();
        toast.error(err.message || 'Authentication failed');
        router.push('/login');
      }
    } catch (err) {
      toast.error('An error occurred during authentication');
      router.push('/login');
    } finally {
      setProcessing(false);
    }
  };

  if (!code) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Select Your Role</h1>
        <p className="text-gray-500 mb-8">Please select your role to continue setting up your EngageSynch account.</p>
        
        {processing ? (
          <div className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <button 
              onClick={() => handleRoleSelect('MANAGER')}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Manager
            </button>
            <button 
              onClick={() => handleRoleSelect('REP')}
              className="w-full rounded-lg bg-white border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Sales Rep
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailRedirect() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <EmailRedirectContent />
    </Suspense>
  );
}
