import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, Mail, Lock, ArrowRight, Globe, Zap, Shield, CheckCircle2, Monitor, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDeviceAccounts, getDeviceIp, relativeTime, type DeviceAccount } from '@/lib/device-store';

const FEATURES = [
  { icon: Zap,    text: 'OpenAI-compatible API — drop-in replacement' },
  { icon: Globe,  text: 'Live web search for real-time Liberian news & data' },
  { icon: Shield, text: '1,000,000 free tokens — no card required' },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('alex@mediatechliberia.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceAccount[]>([]);
  const [deviceIp, setDeviceIp] = useState('');

  useEffect(() => {
    setDeviceAccounts(getDeviceAccounts());
    setDeviceIp(getDeviceIp());
    // Pick up any pre-fill email passed from the signup page account picker
    try {
      const prefill = sessionStorage.getItem('mesurado_prefill_email');
      if (prefill) {
        setEmail(prefill);
        sessionStorage.removeItem('mesurado_prefill_email');
      }
    } catch { /* ignore */ }
  }, []);

  function pickAccount(acc: DeviceAccount) {
    setEmail(acc.email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    login(email);
    setLocation('/overview');
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
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10 md:mb-16">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 38%) 100%)' }}>M</div>
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
            <div className="space-y-3.5">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(0 72% 51% / 0.15)' }}>
                    <Icon size={13} style={{ color: 'hsl(0 72% 65%)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'hsl(213 27% 72%)' }}>{text}</p>
                </div>
              ))}
            </div>

            {/* Device IP indicator */}
            {deviceIp && (
              <div className="mt-8 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'hsl(222 47% 11% / 0.8)', border: '1px solid hsl(222 47% 22%)' }}>
                <Monitor size={13} style={{ color: 'hsl(213 27% 52%)' }} />
                <span className="text-xs font-mono" style={{ color: 'hsl(213 27% 52%)' }}>
                  Device IP: {deviceIp}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 hidden md:block mt-auto">
          <div className="border-l-2 pl-4" style={{ borderColor: 'hsl(0 72% 51% / 0.5)' }}>
            <p className="text-sm italic" style={{ color: 'hsl(213 27% 60%)' }}>
              "Powering the next generation of Liberian developers with world-class AI infrastructure."
            </p>
            <p className="text-xs font-semibold mt-1.5" style={{ color: 'hsl(213 27% 48%)' }}>
              Media Tech Liberia · Mesurado Engine v1
            </p>
          </div>
        </div>
      </div>

      {/* ── Right — Form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 md:px-16">
        <div className="w-full max-w-sm">

          {/* Mock mode badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
              ⚡ Prototype — any email &amp; password works
            </span>
          </div>

          {/* Accounts on this device */}
          {deviceAccounts.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Monitor size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Accounts on this device</span>
              </div>
              <div className="space-y-2">
                {deviceAccounts.map(acc => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => pickAccount(acc)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 hover:border-gray-200 transition-all text-left group"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 47%))' }}>
                      {acc.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{acc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-gray-400" />
                        <span className="text-xs text-gray-400">{relativeTime(acc.lastLogin)}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono text-right">{acc.deviceIp}</span>
                    </div>
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition flex-shrink-0" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-5 mb-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            </div>
          )}

          {/* Heading */}
          {deviceAccounts.length === 0 && (
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your developer dashboard</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-red-500 transition placeholder:text-gray-400"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide" htmlFor="password">Password</label>
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="text-xs font-medium hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="password" type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-red-500 transition placeholder:text-gray-400"
                  placeholder="••••••••••"
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md disabled:opacity-60 mt-2"
              style={{ background: loading ? 'hsl(0 72% 65%)' : 'hsl(0 72% 51%)' }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Signing in…</>
                : <>Sign in to Dashboard <ArrowRight size={15} /></>}
            </button>
          </form>

          {deviceAccounts.length === 0 && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-gray-800">New to Mesurado AI?</p>
                  <p className="text-xs text-gray-500 mt-0.5">Start free with 1,000,000 tokens — no credit card needed.</p>
                  <Link href="/signup" className="inline-block text-xs font-bold mt-1.5 hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>
                    Create a free account →
                  </Link>
                </div>
              </div>
            </>
          )}

          {deviceAccounts.length > 0 && (
            <p className="mt-5 text-center text-sm text-gray-500">
              New account?{' '}
              <Link href="/signup" className="font-bold hover:underline" style={{ color: 'hsl(0 72% 51%)' }}>
                Create one free →
              </Link>
            </p>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">© 2026 Media Tech Liberia · Mesurado AI</p>
        </div>
      </div>
    </div>
  );
}
