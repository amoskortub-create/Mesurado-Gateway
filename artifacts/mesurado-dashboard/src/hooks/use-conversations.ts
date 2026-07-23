import { useState, useEffect, useCallback } from 'react';

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface FullConversation extends ConversationSummary {
  messages: ConversationMessage[];
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/playground/conversations', { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConversationSummary[] };
      setConversations(data.conversations ?? []);
    } catch {
      // silent — sidebar is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    try {
      await fetch(`/api/playground/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // silent
    }
  }, []);

  const prependConversation = useCallback((c: ConversationSummary) => {
    setConversations(prev => [c, ...prev.filter(x => x.id !== c.id)]);
  }, []);

  const updateConversationTimestamp = useCallback((id: string) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      const updated = { ...prev[idx], updatedAt: new Date().toISOString() };
      return [updated, ...prev.filter((_, i) => i !== idx)];
    });
  }, []);

  return {
    conversations,
    loading,
    refetch: load,
    deleteConversation,
    prependConversation,
    updateConversationTimestamp,
  };
}

export async function fetchConversation(id: string): Promise<FullConversation | null> {
  try {
    const res = await fetch(`/api/playground/conversations/${id}`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as FullConversation;
  } catch {
    return null;
  }
}
