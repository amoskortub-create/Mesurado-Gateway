'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Invalid email or password');
        return;
      }
      router.push(params.get('next') ?? '/overview');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
      {/* Gradient header */}
      <div
        className="px-8 py-6 text-white"
        style={{
          background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 40%) 40%, hsl(217 72% 35%) 100%)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-extrabold text-xl backdrop-blur-sm">
            M
          </div>
          <span className="font-extrabold text-xl tracking-tight">Mesurado AI</span>
        </div>
        <p className="text-white/75 text-sm font-medium">Developer API Gateway by Media Tech Liberia</p>
      </div>

      {/* Form */}
      <div className="px-8 py-7">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to your developer account</p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="email">
              Email address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition bg-gray-50 hover:bg-white"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition bg-gray-50 hover:bg-white"
                placeholder="••••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
            style={{ background: loading ? '#9ca3af' : 'hsl(0 72% 51%)' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <Zap size={16} />
                Sign in to Dashboard
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-bold hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
