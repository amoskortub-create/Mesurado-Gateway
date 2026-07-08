import { useState, useRef, useEffect } from 'react';
import { Loader2, Globe, ArrowUp, Wifi } from 'lucide-react';
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
  streaming?: boolean;
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

// ─── SSE stream reader ────────────────────────────────────────────────────────

type SseEvent =
  | { type: 'queue'; position: number; message: string }
  | { type: 'start'; message: string }
  | { type: 'token'; content: string }
  | { type: 'done'; promptTokens: number; completionTokens: number; costDebit: number; tokensRemaining: number; searchUsed: boolean }
  | { type: 'error'; code: number; message: string };

async function* readSseStream(res: Response): AsyncGenerator<SseEvent> {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = leftover + decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      leftover = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const raw = trimmed.slice(6);
        if (raw === '[DONE]') return;
        try {
          yield JSON.parse(raw) as SseEvent;
        } catch {
          // malformed — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatInterface({
  settings,
  isPaidUser,
  tokensRemaining: initialTokens,
  settingsOpen,
  onSettingsToggle,
  onTokensUsed,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [localTokens, setLocalTokens] = useState(initialTokens);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setLocalTokens(initialTokens); }, [initialTokens]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const searchActive = isPaidUser && settings.liveSearch;

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

    // Append user message
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    setStatusText('Connecting…');
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
      setStatusText('');
      return;
    }

    const apiMessages = [
      ...messages.filter(m => !m.searchUnavailable).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ];

    // Reserve a placeholder for the streaming assistant message
    const placeholderIdx = messages.filter(m => !m.searchUnavailable).length + 1; // after user msg
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/playground/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          live_search: isPaidUser && settings.liveSearch,
        }),
        signal: abort.signal,
      });

      // Non-SSE error (auth, rate limit, balance, etc.)
      if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errData.error ?? `Server error ${res.status}`);
      }

      let accumulated = '';
      let finalMeta: { promptTokens: number; completionTokens: number; costDebit: number; tokensRemaining: number; searchUsed: boolean } | null = null;

      for await (const event of readSseStream(res)) {
        if (abort.signal.aborted) break;

        if (event.type === 'queue') {
          setStatusText(event.message ?? `Connecting… (position ${event.position})`);
        } else if (event.type === 'start') {
          setStatusText('Mesurado is thinking…');
        } else if (event.type === 'token') {
          accumulated += event.content;
          // Update the streaming placeholder in real time
          setMessages(prev => {
            const updated = [...prev];
            // Find the last streaming message and update it
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].role === 'assistant' && updated[i].streaming) {
                updated[i] = { ...updated[i], content: accumulated };
                break;
              }
            }
            return updated;
          });
        } else if (event.type === 'done') {
          finalMeta = event;
          setLocalTokens(event.tokensRemaining);
          onTokensUsed?.();
          setStatusText('');
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      // Finalise the message (clear streaming flag, attach metadata)
      setMessages(prev => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'assistant' && updated[i].streaming) {
            const promptTokens = finalMeta?.promptTokens ?? countTokens(apiMessages.map(m => m.content).join(' '));
            const completionTokens = finalMeta?.completionTokens ?? countTokens(accumulated);
            const costDebit = finalMeta?.costDebit ?? calcCost(promptTokens + completionTokens);
            updated[i] = {
              ...updated[i],
              content: accumulated || updated[i].content,
              streaming: false,
              searchUsed: finalMeta?.searchUsed ?? false,
              metadata: { promptTokens, completionTokens, costDebit },
            };
            break;
          }
        }
        return updated;
      });

      void placeholderIdx; // suppress unused warning
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // User cancelled — clean up the placeholder
        setMessages(prev => prev.filter(m => !m.streaming));
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Request cancelled.',
        }]);
      } else {
        setMessages(prev => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && updated[i].streaming) {
              updated[i] = {
                role: 'assistant',
                content: `Error: ${err instanceof Error ? err.message : 'Request failed'}. Please try again.`,
                streaming: false,
              };
              break;
            }
          }
          return updated;
        });
      }
    } finally {
      setLoading(false);
      setStatusText('');
      abortRef.current = null;
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}
          >M</div>
          <div>
            <span className="text-sm font-bold text-foreground">Mesurado Playground</span>
            <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">mesurado-1.0-lite</span>
          </div>
          {searchActive && (
            <span
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'hsl(142 76% 45% / 0.12)', color: 'hsl(142 76% 38%)' }}
            >
              <Globe size={10} />Live Search
            </span>
          )}
        </div>
        <button
          onClick={onSettingsToggle}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition"
        >
          Settings
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}
            >M</div>
            <h3 className="font-bold text-foreground mb-1">Mesurado AI Playground</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {isPaidUser ? 'Live web search is available. Ask anything.' : 'Ask me anything about coding, APIs, or Mesurado.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTIONS.map(s => (
                <button
                  key={s.text}
                  onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                  className="flex items-center gap-2 text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:bg-muted transition bg-card"
                >
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
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 mt-0.5 mr-2"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}
              >M</div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm'
                  : `bg-card border border-card-border text-foreground rounded-tl-sm ${msg.searchUnavailable ? 'border-amber-200 bg-amber-50' : ''}`
              }`}
              style={msg.role === 'user' ? { background: 'hsl(217 72% 47%)' } : {}}
            >
              {msg.content ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : msg.streaming ? (
                <span className="inline-block w-2 h-4 bg-foreground/40 rounded-sm animate-pulse" />
              ) : null}

              {/* Streaming cursor */}
              {msg.streaming && msg.content && (
                <span className="inline-block w-0.5 h-4 bg-foreground/60 rounded-full animate-pulse ml-0.5 align-middle" />
              )}

              {msg.metadata && !msg.streaming && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                  <span>{msg.metadata.promptTokens + msg.metadata.completionTokens} tokens</span>
                  <span>${msg.metadata.costDebit.toFixed(6)}</span>
                  {msg.searchUsed && (
                    <span className="flex items-center gap-1" style={{ color: 'hsl(142 76% 40%)' }}>
                      <Globe size={9} />Search
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading state with status text */}
        {loading && !messages.some(m => m.streaming) && (
          <div className="flex justify-start">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0 mt-0.5 mr-2"
              style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 40%))' }}
            >M</div>
            <div className="bg-card border border-card-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2">
                {statusText.includes('onnecting') || statusText.includes('queue') ? (
                  <Wifi size={13} className="text-muted-foreground animate-pulse" />
                ) : (
                  <Loader2 size={13} className="text-muted-foreground animate-spin" />
                )}
                <span className="text-xs text-muted-foreground">{statusText || 'Connecting…'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Status text overlay while streaming */}
        {loading && statusText && messages.some(m => m.streaming) && (
          <div className="flex justify-center">
            <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-muted/60">
              {statusText}
            </span>
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
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="absolute right-2 bottom-2 w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-30 hover:opacity-90 active:scale-95 shadow-md"
            style={{ background: 'hsl(0 72% 51%)' }}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <ArrowUp size={16} strokeWidth={2.5} />
            }
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
