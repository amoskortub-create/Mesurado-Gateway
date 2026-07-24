import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, Mail, Lock, User, ArrowRight, Globe, Zap, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const FEATURES = [
  { icon: Zap,    text: 'OpenAI-compatible API — drop-in replacement' },
  { icon: Globe,  text: 'Live web search for real-time Liberian news & data' },
  { icon: Shield, text: '100,000 free tokens — no card required' },
];

function strengthScore(p: string): number {
  let s = 0;
  if (p.length >= 8)  s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9!@#$%^&*]/.test(p)) s++;
  return s;
}
const strengthLabels: Record<number, string> = { 0: 'Too short', 1: 'Weak', 2: 'Fair', 3: 'Strong' };
const strengthColors: Record<number, string> = {
  0: 'hsl(0 72% 55%)', 1: 'hsl(30 80% 50%)', 2: 'hsl(40 90% 50%)', 3: 'hsl(142 76% 40%)',
};

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const strength = strengthScore(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      await signup(email, password, name);
      setLocation('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
            style={{ background: 'radial-gradient(circle, hsl(217 72% 47%), transparent 70%)' }} />
          <div className="absolute bottom-0 right-0 w-72 h-72 opacity-15 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(0 72% 51%), transparent 70%)' }} />
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
              Start building<br />
              <span style={{ color: 'hsl(217 72% 65%)' }}>for free</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'hsl(213 27% 65%)' }}>
              Get 100,000 tokens immediately. No credit card needed.
            </p>
            <ul className="space-y-3">
              {FEATURES.map(f => (
                <li key={f.text} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(217 72% 47% / 0.25)' }}>
                    <f.icon size={13} style={{ color: 'hsl(217 72% 65%)' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'hsl(213 27% 72%)' }}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative z-10 hidden md:block">
          <blockquote className="border-l-2 pl-4 text-sm italic" style={{ borderColor: 'hsl(217 72% 47%)', color: 'hsl(213 27% 55%)' }}>
            "Powering the next generation of Liberian developers with world-class AI infrastructure."
          </blockquote>
          <p className="mt-2 text-xs" style={{ color: 'hsl(213 27% 45%)' }}>Media Tech Liberia · Mesurado Engine v1</p>
        </div>
      </div>

      {/* ── Right — Signup form ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Free forever · No credit card needed</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Full name</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Alex Johnson"
                  required
                  autoComplete="name"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>
            </div>

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
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColors[strength] : 'hsl(0 0% 88%)' }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strengthColors[strength] }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading || !name || !email || password.length < 8}
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md disabled:opacity-60"
              style={{ background: 'hsl(217 72% 47%)' }}>
              {loading
                ? <><Loader2 size={15} className="animate-spin" />Creating account…</>
                : <>Create Free Account <ArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            By creating an account you agree to our{' '}
            <span className="font-medium cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="font-medium cursor-pointer hover:underline">Privacy Policy</span>
          </p>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-bold hover:underline" style={{ color: 'hsl(217 72% 47%)' }}>
                Sign in →
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            © 2026 Media Tech Liberia · Mesurado AI
          </p>
        </div>
      </div>
    </div>
  );
}
