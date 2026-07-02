'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'ADMIN') router.push('/dashboard/admin');
      else if (user.role === 'MANAGER') router.push('/dashboard/manager');
      else router.push('/dashboard');
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Login successful');
      // Role redirection handled by useEffect
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string }; status?: number } };
      const status = error.response?.status;
      const message = error.response?.data?.message || '';
      if (status === 403 && message.toLowerCase().includes('pending')) {
        toast.error('Your account is pending admin approval. Please wait for approval before logging in.');
      } else if (status === 403 && message.toLowerCase().includes('suspended')) {
        toast.error('Your account has been suspended. Please contact an administrator.');
      } else {
        toast.error(message || 'Login failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      const res = await fetch(`${apiUrl}/auth/microsoft/url`);
      const data = await res.json();
      if (data.url && data.url.url) {
        sessionStorage.setItem('pkce_verifier', data.url.codeVerifier);
        window.location.href = data.url.url;
      } else if (data.url) {
        sessionStorage.setItem('pkce_verifier', data.codeVerifier);
        window.location.href = data.url;
      } else {
        toast.error('Failed to get login URL');
      }
    } catch (err) {
      toast.error('Failed to initialize Microsoft login');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a66c2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Top left logo */}
      <div className="absolute top-8 left-8 z-10">
        <img src="/RelantoLogo.svg" alt="Relanto Logo" className="h-10" />
      </div>

      <div className="w-full max-w-[500px] rounded-3xl border border-gray-200 bg-white p-10 shadow-lg z-10 mx-4 relative">
        <h1 className="text-4xl font-bold text-[#0066cc] mb-8">EngageSync</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Username / Email</label>
            <input
              id="email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-xl border-0 bg-[#d9e6f2] px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-[#0066cc]"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border-0 bg-[#d9e6f2] px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-[#0066cc]"
            />
          </div>
          
          <div className="flex justify-end text-sm">
            <a href="#" className="text-gray-500 hover:text-gray-700">Forgot password?</a>
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#0066cc] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Logging in...' : 'Log in'}
              <span className="text-xl leading-none">→</span>
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Login with:</span>
              <button type="button" onClick={handleMicrosoftLogin} className="hover:opacity-80 transition-opacity">
                <svg width="24" height="24" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 0H0V10H10V0Z" fill="#F25022"/>
                  <path d="M21 0H11V10H21V0Z" fill="#7FBA00"/>
                  <path d="M10 11H0V21H10V11Z" fill="#00A4EF"/>
                  <path d="M21 11H11V21H21V11Z" fill="#FFB900"/>
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
