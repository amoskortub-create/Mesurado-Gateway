import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, Mail, Lock, ArrowRight, Globe, Zap, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const FEATURES = [
  { icon: Zap,    text: 'OpenAI-compatible API — drop-in replacement' },
  { icon: Globe,  text: 'Live web search for real-time Liberian news & data' },
  { icon: Shield, text: '100,000 free tokens — no card required' },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      setLocation('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left — Brand panel ─────────────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-between overflow-hidden
                   px-8 pt-10 pb-8
                   md:w-[42%] md:min-h-screen md:px-12 md:pt-14 md:pb-12"
        style={{ background: 'linear-gradient(155deg, hsl(222 47% 8%) 0%, hsl(222 47% 12%) 45%, hsl(217 60% 16%) 100%)' }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute top-0 left-0 w-80 h-80 opacity-20 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(0 72% 51%), transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-72 h-72 opacity-15 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(217 72% 47%), transparent 70%)' }} />
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden
          style={{ backgroundImage: 'radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10 md:mb-16">
            <img src="/logo.svg" alt="Mesurado AI" className="w-10 h-10 rounded-xl shadow-lg" />
            <div>
              <div className="text-white font-extrabold text-lg leading-tight">Mesurado AI</div>
              <div className="text-xs font-medium" style={{ color: 'hsl(213 27% 60%)' }}>Developer API Gateway</div>
            </div>
          </div>

          <div className="hidden md:block">
            <h2 className="text-3xl font-extrabold text-white leading-snug mb-3">
              Build with<br />
              <span style={{ color: 'hsl(0 72% 60%)' }}>Mesurado AI</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'hsl(213 27% 65%)' }}>
              The OpenAI-compatible API gateway built by Media Tech Liberia — affordable, fast, and live-search enabled.
            </p>
            <ul className="space-y-3">
              {FEATURES.map(f => (
                <li key={f.text} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(0 72% 51% / 0.25)' }}>
                    <f.icon size={13} style={{ color: 'hsl(0 72% 65%)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'hsl(213 27% 72%)' }}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative z-10 hidden md:block">
          <blockquote className="border-l-2 pl-4 text-sm italic" style={{ borderColor: 'hsl(0 72% 51%)', color: 'hsl(213 27% 55%)' }}>
            "Powering the next generation of Liberian developers with world-class AI infrastructure."
          </blockquote>
          <p className="mt-2 text-xs" style={{ color: 'hsl(213 27% 45%)' }}>Media Tech Liberia · Mesurado Engine v1</p>
        </div>
      </div>

      {/* ── Right — Login form ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your developer dashboard</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md disabled:opacity-60"
              style={{ background: 'hsl(0 72% 51%)' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" />Signing in…</>
                : <>Sign in to Dashboard <ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              New to Mesurado AI?{' '}
              <Link href="/signup" className="font-bold hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>
                Create a free account →
              </Link>
            </p>
            <p className="text-xs text-muted-foreground mt-1">100,000 free tokens — no card required</p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            © 2026 Media Tech Liberia · Mesurado AI
          </p>
        </div>
      </div>
    </div>
  );
}
