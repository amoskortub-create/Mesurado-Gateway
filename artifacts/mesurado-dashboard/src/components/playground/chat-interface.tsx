import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Send, Loader2, Bot, User, Globe, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import type { PlaygroundSettings } from './settings-panel';
import { getMockChatResponse, MOCK_USAGE } from '@/lib/mock';
import { countTokens, calcCost } from '@/lib/utils';
import { needsSearch, mockSearch, formatSearchContext, countSearchTokens } from '@/lib/search';

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
  onSettingsClick?: () => void;
}

export function ChatInterface({ settings, isPaidUser, onSettingsClick }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokensRemaining, setTokensRemaining] = useState(MOCK_USAGE.tokensRemaining);
  const [searchesUsed, setSearchesUsed] = useState(MOCK_USAGE.searchesUsedThisMonth);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const queryNeedsSearch = needsSearch(text);

    // ── Free user + search needed → upgrade gate ─────────────────────────────
    if (queryNeedsSearch && !isPaidUser) {
      await new Promise(r => setTimeout(r, 400));
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            'This query requires live web search, which is available on the **Pay-As-You-Go** plan.\n\nUpgrade to access current information from the web — including news, prices, exchange rates, weather, and more.\n\n_Your token balance is unaffected._',
          searchUnavailable: true,
        },
      ]);
      setLoading(false);
      return;
    }

    // ── Search enabled (paid user + liveSearch on + query needs it) ──────────
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
      } catch {
        // Search failed silently — proceed without context
        searchContext = '';
      }
    }

    // Simulate remaining AI delay
    const delay = 400 + Math.random() * 600;
    await new Promise(r => setTimeout(r, delay));

    const aiContent = getMockChatResponse(text, usedSearch);
    const promptTokens = countTokens(text + (settings.systemPrompt || '') + searchContext);
    const completionTokens = countTokens(aiContent);
    const totalTokens = promptTokens + completionTokens;
    const costDebit = calcCost(totalTokens);

    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: aiContent,
        searchUsed: usedSearch,
        metadata: { promptTokens, completionTokens, searchTokens, costDebit },
      },
    ]);
    setTokensRemaining(prev => Math.max(0, prev - totalTokens));
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  const SUGGESTIONS = [
    'What is Mesurado AI?',
    'Show me a Python API example',
    'What is the current USD to LRD rate?',
    'Latest news from Liberia today',
  ];

  const searchActive = isPaidUser && settings.liveSearch;

  return (
    <div className="h-full bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-3 md:px-5 py-3 md:py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 47%))' }}>M</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight truncate">mesurado-llama3.2-3b</p>
            <p className="text-xs text-muted-foreground hidden sm:block">Playground — mock mode</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
          {/* Live search status badge */}
          {searchActive ? (
            <span className="hidden sm:flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'hsl(142 76% 45% / 0.12)', color: 'hsl(142 76% 38%)' }}>
              <Globe size={10} />
              Search On
            </span>
          ) : isPaidUser ? (
            <span className="hidden sm:flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <Globe size={10} />
              Search Off
            </span>
          ) : null}

          {/* Token counter */}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: 'hsl(217 72% 47% / 0.1)', color: 'hsl(217 72% 47%)' }}>
            <span className="hidden sm:inline">{tokensRemaining.toLocaleString()} left</span>
            <span className="sm:hidden">{(tokensRemaining / 1000).toFixed(0)}k</span>
          </span>

          {/* Mobile settings button */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition"
              aria-label="Open settings"
            >
              <SlidersHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center gap-5 md:gap-6">
            <div className="text-center max-w-xs px-4">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl font-extrabold mx-auto mb-3 md:mb-4 shadow-lg"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(217 72% 47%) 100%)' }}>M</div>
              <p className="text-sm md:text-base font-bold text-foreground">Mesurado AI Playground</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {searchActive
                  ? 'Live search is active. Ask about current events, prices, or news.'
                  : 'Try a prompt below or adjust settings with the ⚙ button.'}
              </p>
              {searchActive && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Globe size={11} style={{ color: 'hsl(142 76% 45%)' }} />
                  <span className="text-xs font-medium" style={{ color: 'hsl(142 76% 45%)' }}>
                    Live web search enabled
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm px-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition leading-snug">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white mt-0.5"
                style={{ background: msg.role === 'user' ? 'hsl(222 47% 20%)' : 'hsl(0 72% 51%)' }}>
                {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>
              {/* Globe badge on assistant avatar when search was used */}
              {msg.role === 'assistant' && msg.searchUsed && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  title="Answer informed by live web search"
                  style={{ background: 'hsl(142 76% 40%)' }}>
                  <Globe size={8} className="text-white" />
                </div>
              )}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col gap-1.5 max-w-[82%] md:max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Search unavailable warning */}
              {msg.searchUnavailable && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium mb-0.5"
                  style={{ background: 'hsl(38 92% 50% / 0.1)', color: 'hsl(38 70% 40%)' }}>
                  <AlertTriangle size={11} />
                  Live search requires Pay-As-You-Go
                </div>
              )}
              <div
                className={`px-3.5 md:px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-white rounded-2xl rounded-tr-sm'
                    : 'rounded-2xl rounded-tl-sm bg-muted text-foreground'
                }`}
                style={msg.role === 'user' ? { background: 'hsl(222 47% 20%)' } : {}}>
                {msg.content}
              </div>

              {/* Search used notice */}
              {msg.searchUsed && (
                <div className="flex items-center gap-1 px-1">
                  <Globe size={10} style={{ color: 'hsl(142 76% 45%)' }} />
                  <span className="text-xs" style={{ color: 'hsl(142 76% 45%)' }}>
                    Informed by live search
                  </span>
                </div>
              )}

              {/* Metadata badge */}
              {msg.metadata && (
                <div className="flex items-center gap-1.5 px-1 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(217 72% 47% / 0.1)', color: 'hsl(217 72% 47%)' }}>
                    {(msg.metadata.promptTokens + msg.metadata.completionTokens).toLocaleString()} tokens
                    {msg.metadata.searchTokens > 0 && (
                      <span className="opacity-70"> ({msg.metadata.searchTokens} search)</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(0 72% 51% / 0.08)', color: 'hsl(0 72% 40%)' }}>
                    ${msg.metadata.costDebit.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 md:gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white mt-0.5"
              style={{ background: 'hsl(0 72% 51%)' }}><Bot size={13} /></div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {needsSearch(input) && isPaidUser && settings.liveSearch ? 'Searching the web…' : 'Thinking…'}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 md:p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea ref={textareaRef} value={input} onChange={autoResize} onKeyDown={handleKeyDown}
            disabled={loading} rows={1}
            className="flex-1 px-3.5 md:px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:border-primary transition disabled:opacity-50"
            placeholder={searchActive ? 'Ask anything — live search active…' : 'Type a message…'}
            style={{ minHeight: '42px', maxHeight: '120px' }} />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition disabled:opacity-40 hover:opacity-90 active:scale-95 shadow-sm"
            style={{ background: 'hsl(0 72% 51%)' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">Temp: <strong className="text-foreground">{settings.temperature.toFixed(2)}</strong> · Max: <strong className="text-foreground">{settings.maxTokens}</strong> · </span>
            <Link href="/api-keys" className="underline hover:text-foreground transition">Keys</Link>
          </p>
          {searchActive && (
            <p className="text-xs flex items-center gap-1" style={{ color: 'hsl(142 76% 40%)' }}>
              <Globe size={10} />
              <span>{searchesUsed} searches this month</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
