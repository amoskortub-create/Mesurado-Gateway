import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, Mail, Lock, User, ArrowRight, Globe, Zap, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const PERKS = [
  { icon: Zap,    label: '1M free tokens',       sub: 'No credit card required' },
  { icon: Globe,  label: 'Live web search',       sub: 'Real-time Liberian news & data' },
  { icon: Shield, label: 'OpenAI-compatible',     sub: 'Drop in your existing code' },
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    login(email, name);
    setLocation('/overview');
  }

  const strength =
    password.length === 0 ? 0 :
    password.length < 6   ? 1 :
    password.length < 10  ? 2 : 3;

  const strengthColors = ['', 'hsl(0 72% 51%)', 'hsl(38 92% 50%)', 'hsl(142 76% 40%)'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Left — Brand panel ────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-between overflow-hidden
                   px-8 pt-10 pb-8
                   md:w-[42%] md:min-h-screen md:px-12 md:pt-14 md:pb-12"
        style={{
          background: 'linear-gradient(155deg, hsl(222 47% 8%) 0%, hsl(222 47% 12%) 45%, hsl(217 60% 16%) 100%)',
        }}
      >
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute top-0 right-0 w-80 h-80 opacity-15 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(217 72% 47%), transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-72 h-72 opacity-20 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(0 72% 51%), transparent 70%)' }} />
        </div>

        {/* Dot-grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden
          style={{
            backgroundImage: 'radial-gradient(hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 md:mb-16">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 38%) 100%)' }}
            >M</div>
            <div>
              <div className="text-white font-extrabold text-lg leading-tight">Mesurado AI</div>
              <div className="text-xs font-medium" style={{ color: 'hsl(213 27% 60%)' }}>Developer API Gateway</div>
            </div>
          </div>

          {/* Hero text — hidden on mobile */}
          <div className="hidden md:block">
            <h2 className="text-3xl font-extrabold text-white leading-snug mb-3">
              Start building<br />
              <span style={{ color: 'hsl(217 72% 65%)' }}>for free today</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'hsl(213 27% 65%)' }}>
              Join developers across Liberia and West Africa using Mesurado AI to build smarter applications.
            </p>

            {/* Perk cards */}
            <div className="space-y-3">
              {PERKS.map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                  style={{
                    background: 'hsl(222 47% 11% / 0.8)',
                    borderColor: 'hsl(222 47% 22%)',
                  }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(217 72% 47% / 0.2)' }}>
                    <Icon size={15} style={{ color: 'hsl(217 72% 65%)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{label}</p>
                    <p className="text-xs" style={{ color: 'hsl(213 27% 58%)' }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 hidden md:flex items-center gap-2 mt-auto pt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs" style={{ color: 'hsl(213 27% 52%)' }}>
            All systems operational · Mesurado Engine v1
          </p>
        </div>
      </div>

      {/* ── Right — Form panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 md:px-16">
        <div className="w-full max-w-sm">

          {/* Mock mode badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
              ⚡ Prototype — signup logs you in instantly
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">Get API access in seconds — no card required</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="name">
                Full name
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="name" type="text" value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400"
                  placeholder="Jane Smith"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Password strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{
                          background: i <= strength ? strengthColors[strength] : 'hsl(0 0% 90%)',
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strengthColors[strength] }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md disabled:opacity-60 mt-1"
              style={{ background: loading ? 'hsl(217 72% 60%)' : 'hsl(217 72% 47%)' }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Creating account…</>
                : <>Create Free Account <ArrowRight size={15} /></>}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
            By creating an account you agree to our{' '}
            <span className="font-medium text-gray-500 cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="font-medium text-gray-500 cursor-pointer hover:underline">Privacy Policy</span>
          </p>

          {/* Sign in link */}
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login"
                className="font-bold hover:underline"
                style={{ color: 'hsl(217 72% 47%)' }}>
                Sign in →
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            © 2026 Media Tech Liberia · Mesurado AI
          </p>
        </div>
      </div>
    </div>
  );
}
