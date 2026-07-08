import { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Mail, Lock, Zap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('alex@mediatechliberia.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));
    login(email);
    setLocation('/overview');
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, hsl(222 47% 8%) 0%, hsl(222 47% 14%) 40%, hsl(217 72% 20%) 100%)' }}>
      <div className="absolute inset-0 opacity-10 pointer-events-none" aria-hidden
        style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, hsl(0 72% 51%) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsl(217 72% 47%) 0%, transparent 50%)' }} />
      <div className="absolute inset-0 pointer-events-none" aria-hidden
        style={{ backgroundImage: 'linear-gradient(hsl(222 47% 20% / 0.3) 1px, transparent 1px), linear-gradient(90deg, hsl(222 47% 20% / 0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Mock mode badge */}
        <div className="flex justify-center mb-5">
          <span className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-amber-400/20 border border-amber-400/40 text-amber-300 backdrop-blur-sm">
            ⚡ Prototype Mode — any email &amp; password works
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 text-white"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 40%) 40%, hsl(217 72% 35%) 100%)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-extrabold text-xl backdrop-blur-sm">M</div>
              <span className="font-extrabold text-xl tracking-tight">Mesurado AI</span>
            </div>
            <p className="text-white/75 text-sm font-medium">Developer API Gateway by Media Tech Liberia</p>
          </div>

          <div className="px-8 py-7">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm mb-6">Sign in to your developer account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="email">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition bg-gray-50"
                    placeholder="you@company.com" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition bg-gray-50"
                    placeholder="••••••••••" required />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.99]"
                style={{ background: loading ? '#9ca3af' : 'hsl(0 72% 51%)' }}>
                {loading ? <><Loader2 size={16} className="animate-spin" />Signing in…</> : <><Zap size={16} />Sign in to Dashboard</>}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="font-bold hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>Create one free</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
