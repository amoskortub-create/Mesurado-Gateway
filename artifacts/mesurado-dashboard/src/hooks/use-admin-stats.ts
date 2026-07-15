import { useState, useEffect, useCallback, useRef } from 'react';
import { appwriteClient, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';

export interface AdminStats {
  revenue: { today: number; week: number; month: number };
  pendingCount: number;
  asOf: string;
}

const EMPTY: AdminStats = {
  revenue: { today: 0, week: 0, month: 0 },
  pendingCount: 0,
  asOf: '',
};

/**
 * Admin-only revenue + pending-payments stats. Updates instantly via an
 * Appwrite realtime subscription on the payments collection (new
 * submissions, approvals, rejections all trigger a refetch), with a polling
 * fallback in case the browser's Appwrite session (set at login) isn't
 * active — see auth-context.tsx for why that session can silently fail.
 */
export function useAdminStats(enabled: boolean) {
  const [data, setData] = useState<AdminStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(0);

  const fetchStats = useCallback(async () => {
    if (!enabled) return;
    const id = ++fetchRef.current;
    try {
      const res = await fetch('/api/admin/payments/stats', { credentials: 'include' });
      if (!res.ok) return;
      const json = await res.json() as AdminStats;
      if (id === fetchRef.current) setData(json);
    } catch { /* keep last known value */ } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchStats();
    // Polling fallback (30s) — realtime subscription below is the fast path.
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [enabled, fetchStats]);

  useEffect(() => {
    if (!enabled) return;
    let unsub: (() => void) | null = null;
    try {
      unsub = appwriteClient.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.PAYMENTS}.documents`,
        () => fetchStats(),
      );
    } catch { /* Appwrite browser session not active — polling only */ }
    return () => { unsub?.(); };
  }, [enabled, fetchStats]);

  return { ...data, loading, refetch: fetchStats };
}
