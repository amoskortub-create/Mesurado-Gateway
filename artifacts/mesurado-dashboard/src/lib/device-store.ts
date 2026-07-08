/**
 * Device-level account registry.
 * Persists to localStorage so accounts survive page reloads and tab closes.
 * Simulates what a real backend would track per IP + device fingerprint.
 */

const REGISTRY_KEY = 'mesurado_device_accounts';
const IP_KEY = 'mesurado_device_ip';

export interface DeviceAccount {
  email: string;
  name: string;
  initials: string;
  deviceIp: string;
  firstSeen: string;   // ISO
  lastLogin: string;   // ISO
  loginCount: number;
}

/** Generate or retrieve a stable mock IP for this browser/device */
export function getDeviceIp(): string {
  try {
    const stored = localStorage.getItem(IP_KEY);
    if (stored) return stored;
    // Generate a plausible Liberian ISP-range IP (102.x.x.x)
    const ip = `102.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`;
    localStorage.setItem(IP_KEY, ip);
    return ip;
  } catch {
    return '102.0.0.1';
  }
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initials(name: string, email: string): string {
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return email[0].toUpperCase();
}

function load(): DeviceAccount[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate each entry has the minimum required fields
    return parsed.filter(
      (a): a is DeviceAccount =>
        a !== null &&
        typeof a === 'object' &&
        typeof a.email === 'string' && a.email.length > 0 &&
        typeof a.name === 'string' &&
        typeof a.initials === 'string' &&
        typeof a.deviceIp === 'string' &&
        typeof a.firstSeen === 'string' &&
        typeof a.lastLogin === 'string' &&
        typeof a.loginCount === 'number'
    );
  } catch { /* ignore */ }
  return [];
}

function save(accounts: DeviceAccount[]) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(accounts));
  } catch { /* ignore */ }
}

/** Return all accounts ever used on this device, newest-first */
export function getDeviceAccounts(): DeviceAccount[] {
  return load().sort(
    (a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
  );
}

/** Record a login / signup on this device */
export function recordLogin(email: string, name = ''): DeviceAccount {
  const ip = getDeviceIp();
  const now = new Date().toISOString();
  const accounts = load();
  const idx = accounts.findIndex(a => a.email.toLowerCase() === email.toLowerCase());

  if (idx >= 0) {
    accounts[idx].lastLogin = now;
    accounts[idx].loginCount += 1;
    if (name.trim()) {
      accounts[idx].name = name.trim();
      accounts[idx].initials = initials(name, email);
    }
    save(accounts);
    return accounts[idx];
  }

  const entry: DeviceAccount = {
    email,
    name: name.trim() || email.split('@')[0],
    initials: initials(name, email),
    deviceIp: ip,
    firstSeen: now,
    lastLogin: now,
    loginCount: 1,
  };
  accounts.push(entry);
  save(accounts);
  return entry;
}

/** Check whether an email has been used on this device before */
export function isKnownOnDevice(email: string): boolean {
  return load().some(a => a.email.toLowerCase() === email.toLowerCase());
}

/** Format a relative time label for display */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
