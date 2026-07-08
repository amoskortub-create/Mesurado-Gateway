import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, Mail, Lock, User, ArrowRight, Globe, Zap, Shield, Eye, EyeOff, Monitor, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { getDeviceAccounts, getDeviceIp, isKnownOnDevice, relativeTime, type DeviceAccount } from '@/lib/device-store';

const PERKS = [
  { icon: Zap,    label: '1M free tokens',      sub: 'No credit card required' },
  { icon: Globe,  label: 'Live web search',      sub: 'Real-time Liberian news & data' },
  { icon: Shield, label: 'OpenAI-compatible',    sub: 'Drop in your existing code' },
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceAccount[]>([]);
  const [deviceIp, setDeviceIp] = useState('');
  const [knownEmail, setKnownEmail] = useState(false);

  useEffect(() => {
    setDeviceAccounts(getDeviceAccounts());
    setDeviceIp(getDeviceIp());
  }, []);

  // Check if typed email was previously used on this device
  useEffect(() => {
    setKnownEmail(email.length > 4 && isKnownOnDevice(email));
  }, [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    login(email, name);
    setLocation('/overview');
  }

  function useExisting(acc: DeviceAccount) {
    // Store the selected email so the login page can pre-fill it
    try { sessionStorage.setItem('mesurado_prefill_email', acc.email); } catch { /* ignore */ }
    setLocation('/login');
  }

  const strength =
    password.length === 0 ? 0 :
    password.length < 6   ? 1 :
    password.length < 10  ? 2 : 3;
  const strengthColors = ['', 'hsl(0 72% 51%)', 'hsl(38 92% 50%)', 'hsl(142 76% 40%)'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

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
          <div className="absolute top-0 right-0 w-80 h-80 opacity-15 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(217 72% 47%), transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-72 h-72 opacity-20 blur-3xl rounded-full"
            style={{ background: 'radial-gradient(circle, hsl(0 72% 51%), transparent 70%)' }} />
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
              Start building<br />
              <span style={{ color: 'hsl(217 72% 65%)' }}>for free today</span>
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: 'hsl(213 27% 65%)' }}>
              Join developers across Liberia and West Africa using Mesurado AI to build smarter applications.
            </p>

            <div className="space-y-3">
              {PERKS.map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
                  style={{ background: 'hsl(222 47% 11% / 0.8)', borderColor: 'hsl(222 47% 22%)' }}>
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

            {/* Device info */}
            {deviceIp && (
              <div className="mt-6 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'hsl(222 47% 11% / 0.8)', border: '1px solid hsl(222 47% 22%)' }}>
                <Monitor size={13} style={{ color: 'hsl(213 27% 52%)' }} />
                <span className="text-xs font-mono" style={{ color: 'hsl(213 27% 52%)' }}>
                  Device IP: {deviceIp}
                </span>
                {deviceAccounts.length > 0 && (
                  <span className="ml-auto text-xs font-semibold" style={{ color: 'hsl(217 72% 65%)' }}>
                    {deviceAccounts.length} account{deviceAccounts.length !== 1 ? 's' : ''} tracked
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 hidden md:flex items-center gap-2 mt-auto pt-8">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs" style={{ color: 'hsl(213 27% 52%)' }}>
            All systems operational · Mesurado Engine v1
          </p>
        </div>
      </div>

      {/* ── Right — Form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-6 py-10 md:px-16">
        <div className="w-full max-w-sm">

          {/* Mock mode badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700">
              ⚡ Prototype — signup logs you in instantly
            </span>
          </div>

          {/* Accounts already on this device */}
          {deviceAccounts.length > 0 && (
            <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Monitor size={13} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  {deviceAccounts.length} account{deviceAccounts.length !== 1 ? 's' : ''} on this device
                </span>
                <span className="ml-auto text-xs font-mono text-gray-400">{deviceIp}</span>
              </div>
              <div className="space-y-1.5">
                {deviceAccounts.slice(0, 3).map(acc => (
                  <div key={acc.email}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white border border-gray-100">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 47%))' }}>
                      {acc.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{acc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock size={9} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{relativeTime(acc.lastLogin)}</span>
                    </div>
                    <button type="button" onClick={() => useExisting(acc)}
                      className="text-xs font-bold px-2 py-1 rounded-lg transition hover:bg-gray-100 flex-shrink-0"
                      style={{ color: 'hsl(217 72% 47%)' }}>
                      Sign in
                    </button>
                  </div>
                ))}
                {deviceAccounts.length > 3 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    +{deviceAccounts.length - 3} more account{deviceAccounts.length - 3 !== 1 ? 's' : ''} on this device
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">Get API access in seconds — no card required</p>
          </div>

          {/* Known email warning */}
          {knownEmail && (
            <div className="mb-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl border border-amber-200 bg-amber-50">
              <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">This email was used on this device before</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You can still create a new account or{' '}
                  <Link href="/login" className="font-bold underline">sign in instead</Link>.
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="name">
                Full name
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400"
                  placeholder="Jane Smith" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400 ${knownEmail ? 'border-amber-300' : 'border-gray-200'}`}
                  placeholder="you@company.com" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input id="password" type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:border-blue-500 transition placeholder:text-gray-400"
                  placeholder="Min. 8 characters" required minLength={8} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength ? strengthColors[strength] : 'hsl(0 0% 90%)' }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strengthColors[strength] }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md disabled:opacity-60 mt-1"
              style={{ background: loading ? 'hsl(217 72% 60%)' : 'hsl(217 72% 47%)' }}>
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Creating account…</>
                : <>Create Free Account <ArrowRight size={15} /></>}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
            By creating an account you agree to our{' '}
            <span className="font-medium text-gray-500 cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="font-medium text-gray-500 cursor-pointer hover:underline">Privacy Policy</span>
          </p>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="font-bold hover:underline" style={{ color: 'hsl(217 72% 47%)' }}>
                Sign in →
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">© 2026 Media Tech Liberia · Mesurado AI</p>
        </div>
      </div>
    </div>
  );
}
