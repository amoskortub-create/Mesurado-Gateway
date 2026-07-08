import { useState, useEffect, useCallback, useRef } from 'react';
import { appwriteClient, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';

export interface UsageLog {
  id: string;
  timestamp: string;
  source: 'api' | 'playground';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costDebit: number;
  keyId: string;
}

export interface UsageData {
  tokensRemaining: number;
  totalTokensUsed: number;
  plan: 'free' | 'payg';
  dailyUsage: { date: string; tokens: number }[];
  recentLogs: UsageLog[];
}

export interface UseUsageResult extends UsageData {
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const EMPTY: UsageData = {
  tokensRemaining: 0,
  totalTokensUsed: 0,
  plan: 'free',
  dailyUsage: [],
  recentLogs: [],
};

export function useUsage(): UseUsageResult {
  const [data, setData] = useState<UsageData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(0);

  const fetchData = useCallback(async () => {
    const id = ++fetchRef.current;
    setLoading(true);
    try {
      const res = await fetch('/api/user/usage', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch usage data');
      const json = await res.json() as UsageData;
      if (id === fetchRef.current) {
        setData(json);
        setError(null);
      }
    } catch (err) {
      if (id === fetchRef.current) setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (id === fetchRef.current) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscription — re-fetch when a new usage_log document appears
  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      unsub = appwriteClient.subscribe(
        `databases.${DATABASE_ID}.collections.${COLLECTIONS.USAGE_LOGS}.documents`,
        (ev) => {
          const relevant = (ev.events as string[]).some(
            e => e.includes('.create') || e.includes('.update') || e.includes('.delete'),
          );
          if (relevant) fetchData();
        },
      );
    } catch { /* Appwrite session not active yet — polling only */ }

    return () => { unsub?.(); };
  }, [fetchData]);

  return { ...data, loading, error, refetch: fetchData };
}
