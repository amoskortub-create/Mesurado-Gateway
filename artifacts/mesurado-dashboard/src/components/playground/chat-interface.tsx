import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Globe, Settings2, ArrowUp, AlertCircle } from 'lucide-react';
import type { PlaygroundSettings } from './settings-panel';
import { getMockChatResponse, MOCK_USAGE } from '@/lib/mock';
import { countTokens, calcCost } from '@/lib/utils';
import { needsSearch, mockSearch, formatSearchContext, countSearchTokens, getSearchAiResponse } from '@/lib/search';

const SYSTEM_PROMPT = 'You are Mesurado AI, built by Media Tech Liberia. You are helpful, accurate, and concise.';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  searchUsed?: boolean;
  searchUnavailable?: boolean;
  metadata?: {
    promptTokens: number;
    completionTokens: number;
    searchTokens: number;
    costDebit: number;
  };
}

interface ChatInterfaceProps {
  settings: PlaygroundSettings;
  isPaidUser: boolean;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
}

const SUGGESTIONS = [
  { icon: '💱', text: 'What is the current USD to LRD rate?' },
  { icon: '📰', text: 'Latest news from Liberia today' },
  { icon: '🐍', text: 'Show me a Python API example' },
  { icon: '🤖', text: 'What is Mesurado AI?' },
];

export function ChatInterface({ settings, isPaidUser, settingsOpen, onSettingsToggle }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokensRemaining, setTokensRemaining] = useState(MOCK_USAGE.tokensRemaining);
  const [searchesUsed, setSearchesUsed] = useState(MOCK_USAGE.searchesUsedThisMonth);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const searchActive = isPaidUser && settings.liveSearch;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const queryNeedsSearch = needsSearch(text);

    // Free user + search needed → upgrade gate
    if (queryNeedsSearch && !isPaidUser) {
      await new Promise(r => setTimeout(r, 500));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'This query requires live web search, available on the **Pay-As-You-Go** plan.\n\nUpgrade to access real-time information — exchange rates, Liberian news, crypto prices, weather, and more.\n\n_No tokens have been deducted._',
        searchUnavailable: true,
      }]);
      setLoading(false);
      return;
    }

    // Search execution (paid + enabled + triggered)
    let searchContext = '';
    let searchTokens = 0;
    let usedSearch = false;

    if (queryNeedsSearch && isPaidUser && settings.liveSearch) {
      try {
        const results = await mockSearch(text);
        searchContext = formatSearchContext(results, text);
        searchTokens = countSearchTokens(searchContext);
        usedSearch = true;
        setSearchesUsed(n => n + 1);
      } catch { /* fail silently, proceed without search */ }
    }

    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));

    const aiContent = usedSearch ? getSearchAiResponse(text) : getMockChatResponse(text);
    const promptTokens = countTokens(text + SYSTEM_PROMPT + searchContext);
    const completionTokens = countTokens(aiContent);
    const costDebit = calcCost(promptTokens + completionTokens);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: aiContent,
      searchUsed: usedSearch,
      metadata: { promptTokens, completionTokens, searchTokens, costDebit },
    }]);
    setTokensRemaining(prev => Math.max(0, prev - promptTokens - completionTokens));
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }

  const isSearchQuery = input.trim().length > 0 && needsSearch(input);

  return (
    <div className="h-full flex flex-col bg-card overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-extrabold text-sm shadow-md"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(217 72% 47%) 100%)' }}
          >M</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">mesurado-1.0-lite</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: 'hsl(142 76% 45% / 0.1)', color: 'hsl(142 76% 38%)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {searchActive ? '🌐 Live search on' : 'Mesurado Engine Core'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Token counter */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-bold tabular-nums text-foreground">
              {(tokensRemaining / 1000).toFixed(0)}k
            </span>
            <span className="text-xs text-muted-foreground">tokens left</span>
          </div>

          {/* Settings toggle */}
          <button
            onClick={onSettingsToggle}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${
              settingsOpen
                ? 'text-white border-transparent shadow-sm'
                : 'text-muted-foreground border-border hover:bg-muted hover:text-foreground'
            }`}
            style={settingsOpen ? { background: 'hsl(0 72% 51%)' } : {}}
            title="Model settings"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !loading ? (
          /* Empty state */
          <div className="h-full flex flex-col items-center justify-center px-5 py-8 gap-5">
            {/* Glow orb */}
            <div className="relative">
              <div
                className="absolute inset-0 scale-[2] blur-3xl opacity-20 rounded-full"
                style={{ background: 'radial-gradient(circle, hsl(0 72% 51%), hsl(217 72% 47%))' }}
              />
              <div
                className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-white text-2xl md:text-3xl font-extrabold shadow-2xl"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(217 72% 47%) 100%)' }}
              >M</div>
            </div>

            <div className="text-center max-w-xs">
              <h2 className="text-lg md:text-xl font-extrabold text-foreground">What can I help with?</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {searchActive
                  ? 'Ask about exchange rates, Liberian news, crypto prices, or anything else.'
                  : 'Ask me about code, analysis, writing, or general knowledge.'}
              </p>
              {searchActive && (
                <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-full"
                  style={{ background: 'hsl(142 76% 45% / 0.1)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold" style={{ color: 'hsl(142 76% 38%)' }}>
                    Live search active
                  </span>
                </div>
              )}
            </div>

            {/* Suggestion chips */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                  className="text-left p-3.5 rounded-2xl border border-border bg-background hover:bg-muted hover:border-border/80 transition-all group"
                >
                  <div className="text-lg mb-1.5">{s.icon}</div>
                  <p className="text-xs font-semibold text-foreground leading-snug group-hover:text-foreground">{s.text}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="p-4 md:p-5 space-y-5">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  /* User message — right aligned */
                  <div className="flex justify-end">
                    <div className="max-w-[82%] md:max-w-[72%]">
                      <div
                        className="px-4 py-3 text-white text-sm leading-relaxed rounded-2xl rounded-tr-sm shadow-sm"
                        style={{ background: 'linear-gradient(135deg, hsl(222 47% 17%) 0%, hsl(222 47% 22%) 100%)' }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Assistant message — left aligned */
                  <div className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-extrabold shadow-md mt-0.5"
                      style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 40%) 100%)' }}
                    >M</div>

                    <div className="max-w-[82%] md:max-w-[75%] min-w-0">
                      {/* Upgrade notice */}
                      {msg.searchUnavailable && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2 text-xs font-semibold"
                          style={{ background: 'hsl(38 92% 50% / 0.08)', color: 'hsl(38 70% 40%)' }}>
                          <AlertCircle size={12} />
                          Live search requires Pay-As-You-Go
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className="px-4 py-3 text-sm leading-relaxed rounded-2xl rounded-tl-sm bg-background border border-border shadow-sm whitespace-pre-wrap"
                        style={{ borderLeftWidth: '3px', borderLeftColor: 'hsl(0 72% 51%)' }}
                      >
                        {msg.content}
                      </div>

                      {/* Search badge */}
                      {msg.searchUsed && (
                        <div className="flex items-center gap-1.5 mt-1.5 px-1">
                          <Globe size={11} style={{ color: 'hsl(142 76% 45%)' }} />
                          <span className="text-xs font-medium" style={{ color: 'hsl(142 76% 45%)' }}>
                            Informed by live search
                          </span>
                        </div>
                      )}

                      {/* Token metadata */}
                      {msg.metadata && (
                        <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {(msg.metadata.promptTokens + msg.metadata.completionTokens).toLocaleString()} tokens
                            {msg.metadata.searchTokens > 0 && (
                              <span className="opacity-60"> · {msg.metadata.searchTokens} search</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            ${msg.metadata.costDebit.toFixed(6)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xs font-extrabold shadow-md mt-0.5"
                  style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(0 72% 40%) 100%)' }}
                >M</div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-background border border-border shadow-sm flex items-center gap-2.5">
                  {searchActive && needsSearch(messages[messages.length - 1]?.content ?? '') ? (
                    <>
                      <Globe size={13} className="animate-pulse" style={{ color: 'hsl(142 76% 45%)' }} />
                      <span className="text-sm text-muted-foreground">Searching the web…</span>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">Thinking…</span>
                    </>
                  )}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="p-3 md:p-4 border-t border-border flex-shrink-0" style={{ background: 'hsl(var(--card))' }}>
        {/* Search trigger preview */}
        {isSearchQuery && (
          <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 px-1 ${
            !isPaidUser ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            <Globe size={11} />
            {isPaidUser && settings.liveSearch
              ? 'Live search will activate for this query'
              : isPaidUser
              ? 'Enable live search in settings for real-time data'
              : 'Upgrade to Pay-As-You-Go for live search on this query'}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder={searchActive ? 'Ask anything — live search active…' : 'Ask me anything…'}
            className="w-full pr-14 pl-4 py-3.5 rounded-2xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:border-primary transition-all disabled:opacity-50"
            style={{ minHeight: '52px', maxHeight: '140px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="absolute right-2 bottom-2 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 hover:opacity-90 active:scale-95 shadow-md"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <ArrowUp size={16} strokeWidth={2.5} />}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2 px-0.5">
          <div className="flex items-center gap-2">
            {searchActive ? (
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'hsl(142 76% 40%)' }}>
                <Globe size={10} />
                Live · {searchesUsed} searches this month
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">⇧ Enter for newline</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {tokensRemaining.toLocaleString()} left
          </span>
        </div>
      </div>
    </div>
  );
}
