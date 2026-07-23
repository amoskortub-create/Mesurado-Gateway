import { useState, useCallback } from 'react';
import { History } from 'lucide-react';
import { SettingsPanel, type PlaygroundSettings } from '@/components/playground/settings-panel';
import { ChatInterface } from '@/components/playground/chat-interface';
import { ConversationSidebar } from '@/components/playground/conversation-sidebar';
import { useConversations, fetchConversation, type ConversationSummary } from '@/hooks/use-conversations';
import { useUsage } from '@/hooks/use-usage';

const DEFAULT_SETTINGS: PlaygroundSettings = {
  temperature: 0.75,
  maxTokens: 500,
  liveSearch: false,
};

export default function PlaygroundPage() {
  const { plan, tokensRemaining, refetch } = useUsage();
  const isPaidUser = plan === 'payg';

  const [settings, setSettings] = useState<PlaygroundSettings>({
    ...DEFAULT_SETTINGS,
    liveSearch: isPaidUser,
  });
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [historyOpen, setHistoryOpen]     = useState(false);

  // Active conversation state
  const [activeConversationId, setActiveConversationId]       = useState<string | null>(null);
  const [activeInitialMessages, setActiveInitialMessages]     = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatKey, setChatKey]                                 = useState(0); // increment to force remount

  const {
    conversations,
    loading: convsLoading,
    deleteConversation,
    prependConversation,
    updateConversationTimestamp,
  } = useConversations();

  const handleSelectConversation = useCallback(async (conv: ConversationSummary) => {
    if (conv.id === activeConversationId) { setHistoryOpen(false); return; }
    const full = await fetchConversation(conv.id);
    if (!full) return;
    setActiveConversationId(full.id);
    setActiveInitialMessages(
      full.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    );
    setChatKey(k => k + 1);
    setHistoryOpen(false);
  }, [activeConversationId]);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setActiveInitialMessages([]);
    setChatKey(k => k + 1);
    setHistoryOpen(false);
  }, []);

  const handleConversationCreated = useCallback((id: string, title: string) => {
    setActiveConversationId(id);
    prependConversation({
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }, [prependConversation]);

  const handleConversationUpdated = useCallback((id: string) => {
    updateConversationTimestamp(id);
  }, [updateConversationTimestamp]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    await deleteConversation(id);
    if (id === activeConversationId) handleNewChat();
  }, [deleteConversation, activeConversationId, handleNewChat]);

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* Mobile overlays */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setHistoryOpen(false)} />
      )}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSettingsOpen(false)} />
      )}

      {/* ── Conversation history sidebar (left) ── */}
      <div className={[
        'fixed top-0 left-0 bottom-0 z-50 w-64 shadow-2xl border-r border-border',
        'md:relative md:top-auto md:left-auto md:bottom-auto md:z-auto md:shadow-none',
        'md:w-64 md:flex-shrink-0',
        'transition-transform duration-300 ease-in-out',
        historyOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ].join(' ')}>
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConversationId}
          loading={convsLoading}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
          onClose={() => setHistoryOpen(false)}
        />
      </div>

      {/* ── Chat interface (centre) ── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden relative">
        {/* Mobile history toggle */}
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="md:hidden absolute top-3 left-3 z-10 p-2 rounded-lg border border-border bg-card shadow-sm text-muted-foreground hover:text-foreground transition"
        >
          <History size={15} />
        </button>

        <ChatInterface
          key={`chat-${chatKey}`}
          settings={settings}
          isPaidUser={isPaidUser}
          tokensRemaining={tokensRemaining}
          settingsOpen={settingsOpen}
          onSettingsToggle={() => setSettingsOpen(o => !o)}
          onTokensUsed={refetch}
          conversationId={activeConversationId}
          initialMessages={activeInitialMessages}
          onConversationCreated={handleConversationCreated}
          onConversationUpdated={handleConversationUpdated}
        />
      </div>

      {/* ── Settings panel (right) ── */}
      <div className={[
        'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl border-t border-border overflow-hidden',
        'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:rounded-none md:shadow-none md:border-t-0 md:border-l md:border-border',
        'md:w-80 md:flex-shrink-0',
        'h-[78vh] md:h-full',
        settingsOpen
          ? 'translate-y-0 md:translate-x-0 opacity-100 pointer-events-auto'
          : 'translate-y-full md:translate-y-0 md:translate-x-full opacity-0 md:opacity-0 pointer-events-none',
        'transition-all duration-300 ease-in-out',
        'bg-card',
      ].join(' ')}>
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <SettingsPanel settings={settings} onChange={setSettings} isPaidUser={isPaidUser} onClose={() => setSettingsOpen(false)} />
      </div>
    </div>
  );
}
