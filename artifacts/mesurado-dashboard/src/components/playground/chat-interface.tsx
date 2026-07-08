import { useState, useRef, useEffect } from 'react';
import { Loader2, Globe, ArrowUp } from 'lucide-react';
import type { PlaygroundSettings } from './settings-panel';
import { countTokens, calcCost } from '@/lib/utils';

// Keywords that likely need live search
const SEARCH_KEYWORDS = [
  'today','now','current','latest','recent','this week','this month',
  '2024','2025','2026','yesterday','tomorrow','upcoming','breaking',
  'price','rate','exchange','weather','score','election','winner',
  'death','born','appointed','fired','stock','bitcoin','crypto',
  'dollar to ld','lrd','usd to lrd','liberia','monrovia',
];
function needsSearch(q: string): boolean {
  const lower = q.toLowerCase();
  return SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}


interface Message {
  role: 'user' | 'assistant';
  content: string;
  searchUsed?: boolean;
  searchUnavailable?: boolean;
  metadata?: { promptTokens: number; completionTokens: number; costDebit: number };
}

interface ChatInterfaceProps {
  settings: PlaygroundSettings;
  isPaidUser: boolean;
  tokensRemaining: number;
  settingsOpen: boolean;
  onSettingsToggle: () => void;
  onTokensUsed?: () => void;
}

const SUGGESTIONS = [
  { icon: '💱', text: 'What is the current USD to LRD rate?' },
  { icon: '📰', text: 'Latest news from Liberia today' },
  { icon: '🐍', text: 'Show me a Python API example' },
  { icon: '🤖', text: 'What is Mesurado AI?' },
];

export function ChatInterface({ settings, isPaidUser, tokensRemaining: initialTokens, settingsOpen, onSettingsToggle, onTokensUsed }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [localTokens, setLocalTokens] = useState(initialTokens);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep local token count in sync with parent
  useEffect(() => { setLocalTokens(initialTokens); }, [initialTokens]);

  const searchActive = isPaidUser && settings.liveSearch;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const queryNeedsSearch = needsSearch(text);

    // Upgrade gate for free users who need search
    if (queryNeedsSearch && !isPaidUser) {
      await new Promise(r => setTimeout(r, 300));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'This query needs live web data, available on the **Pay-As-You-Go** plan. Upgrade to access real-time exchange rates, Liberian news, crypto prices, and more.\n\n_No tokens deducted._',
        searchUnavailable: true,
      }]);
      setLoading(false);
      return;
    }

    try {
      // Build the messages array for the API
      const apiMessages = [
        ...messages.filter(m => !m.searchUnavailable).map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const res = await fetch('/api/playground/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Server error ${res.status}`);
      }

      const data = await res.json() as {
        content: string;
        promptTokens: number;
        completionTokens: number;
        costDebit: number;
        tokensRemaining: number;
        searchUsed?: boolean;
      };

      const promptTokens = data.promptTokens ?? countTokens(text);
      const completionTokens = data.completionTokens ?? countTokens(data.content);
      const costDebit = data.costDebit ?? calcCost(promptTokens + completionTokens);

      setLocalTokens(data.tokensRemaining ?? (localTokens - promptTokens - completionTokens));
      onTokensUsed?.();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
        searchUsed: data.searchUsed ?? (queryNeedsSearch && searchActive),
        metadata: { promptTokens, completionTokens, costDebit },
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Request failed'}. Please try again.`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}>M</div>
          <div>
            <span className="text-sm font-bold text-foreground">Mesurado Playground</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">mesurado-1.0-lite</span>
          </div>
          {searchActive && (
            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'hsl(142 76% 45% / 0.12)', color: 'hsl(142 76% 38%)' }}>
              <Globe size={10} />Live Search
            </span>
          )}
        </div>
        <button onClick={onSettingsToggle}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition">
          Settings
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}>M</div>
            <h3 className="font-bold text-foreground mb-1">Mesurado AI Playground</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {isPaidUser ? 'Live web search is available. Ask anything.' : 'Ask me anything about coding, APIs, or Mesurado.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                  className="flex items-center gap-2 text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:bg-muted transition bg-card">
                  <span>{s.icon}</span>
                  <span className="text-muted-foreground">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 mt-0.5 mr-2"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}>M</div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'text-white rounded-tr-sm'
                : `bg-card border border-card-border text-foreground rounded-tl-sm ${msg.searchUnavailable ? 'border-amber-200 bg-amber-50' : ''}`
            }`} style={msg.role === 'user' ? { background: 'hsl(217 72% 47%)' } : {}}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.metadata && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                  <span>{msg.metadata.promptTokens + msg.metadata.completionTokens} tokens</span>
                  <span>${msg.metadata.costDebit.toFixed(6)}</span>
                  {msg.searchUsed && <span className="flex items-center gap-1" style={{ color: 'hsl(142 76% 40%)' }}><Globe size={9} />Search</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 mt-0.5 mr-2"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}>M</div>
            <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 md:px-6 py-4 border-t border-border flex-shrink-0">
        {queryNeedsSearchIndicator(input, isPaidUser, searchActive)}
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
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="absolute right-2 bottom-2 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 hover:opacity-90 active:scale-95 shadow-md"
            style={{ background: 'hsl(0 72% 51%)' }}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.5} />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-0.5">
          <span className="text-xs text-muted-foreground">⇧ Enter for newline</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {localTokens.toLocaleString()} tokens left
          </span>
        </div>
      </div>
    </div>
  );
}

function queryNeedsSearchIndicator(input: string, isPaidUser: boolean, searchActive: boolean) {
  const needs = input.trim().length > 3 && needsSearch(input);
  if (!needs) return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs mb-2 px-1 ${searchActive ? 'text-emerald-600' : 'text-amber-600'}`}>
      <Globe size={11} />
      {searchActive
        ? 'Live search will activate for this query'
        : isPaidUser
        ? 'Enable live search in settings for real-time data'
        : 'Upgrade to Pay-As-You-Go for live search on this query'}
    </div>
  );
}
