'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Send, Loader2, Bot, User, AlertTriangle } from 'lucide-react';
import type { PlaygroundSettings } from './settings-panel';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    promptTokens: number;
    completionTokens: number;
    costDebit: number;
  };
}

interface ChatInterfaceProps {
  settings: PlaygroundSettings;
}

export function ChatInterface({ settings }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load initial balance
  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then((d) => setTokenBalance(d.tokensRemaining ?? 0))
      .catch(console.error);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const isExhausted = tokenBalance !== null && tokenBalance <= 0;

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || isExhausted) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setErrorMsg('');

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch('/api/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          temperature: settings.temperature,
          system_prompt: settings.systemPrompt,
          max_tokens: settings.maxTokens,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) setTokenBalance(0);
        setErrorMsg(data.error ?? 'Request failed');
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
          metadata: {
            promptTokens: data.promptTokens,
            completionTokens: data.completionTokens,
            costDebit: data.costDebit,
          },
        },
      ]);
      setTokenBalance(data.tokensRemaining);
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  return (
    <div className="h-full bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden shadow-sm relative">
      {/* Chat header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 47%))' }}
          >
            M
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">
              mesurado-llama3.2-3b
            </p>
            <p className="text-xs text-muted-foreground">Playground — ephemeral session</p>
          </div>
        </div>

        {tokenBalance !== null && (
          <div
            className="text-xs font-bold px-2.5 py-1 rounded-full tabular-nums"
            style={{
              background:
                tokenBalance > 10000
                  ? 'hsl(217 72% 47% / 0.1)'
                  : tokenBalance > 0
                  ? 'hsl(40 96% 50% / 0.12)'
                  : 'hsl(0 72% 51% / 0.1)',
              color:
                tokenBalance > 10000
                  ? 'hsl(217 72% 47%)'
                  : tokenBalance > 0
                  ? 'hsl(40 72% 40%)'
                  : 'hsl(0 72% 51%)',
            }}
          >
            {tokenBalance.toLocaleString()} tokens left
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-xs">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold mx-auto mb-4 shadow-lg"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(217 72% 47%) 100%)',
                }}
              >
                M
              </div>
              <p className="text-base font-bold text-foreground">Mesurado AI Playground</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Configure temperature and system prompt on the left panel, then start chatting.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white mt-0.5"
              style={{
                background: msg.role === 'user' ? 'hsl(222 47% 20%)' : 'hsl(0 72% 51%)',
              }}
            >
              {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>

            {/* Bubble + metadata */}
            <div
              className={`flex flex-col gap-1.5 max-w-[78%] ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'text-white rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm bg-muted text-foreground'
                }`}
                style={
                  msg.role === 'user' ? { background: 'hsl(222 47% 20%)' } : {}
                }
              >
                {msg.content}
              </div>

              {msg.metadata && (
                <div className="flex items-center gap-1.5 px-1">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(217 72% 47% / 0.1)', color: 'hsl(217 72% 47%)' }}
                  >
                    {(msg.metadata.promptTokens + msg.metadata.completionTokens).toLocaleString()} tokens
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(0 72% 51% / 0.08)', color: 'hsl(0 72% 40%)' }}
                  >
                    ${msg.metadata.costDebit.toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading bubble */}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white mt-0.5"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              <Bot size={13} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            disabled={isExhausted || loading}
            rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:border-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={
              isExhausted
                ? 'Token balance exhausted — visit Billing to add funds'
                : 'Type a message… (Enter to send)'
            }
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading || isExhausted}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition disabled:opacity-40 hover:opacity-90 active:scale-95 shadow-sm"
            style={{ background: 'hsl(0 72% 51%)' }}
            title="Send message"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Temp: <strong className="text-foreground">{settings.temperature.toFixed(2)}</strong>
          {' · '}Max tokens: <strong className="text-foreground">{settings.maxTokens}</strong>
          {' · '}Model: <strong className="text-foreground">mesurado-llama3.2-3b</strong>
        </p>
      </div>

      {/* Exhausted overlay */}
      {isExhausted && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-2xl z-10"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)' }}
        >
          <div className="text-center p-8 max-w-sm">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              <AlertTriangle size={28} className="text-white" />
            </div>
            <h3 className="text-lg font-extrabold text-foreground mb-2">
              Free tier exhausted
            </h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              Your 1,000,000 token balance has been fully used. Add funds to your account to
              continue generating responses.
            </p>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition"
              style={{ background: 'hsl(0 72% 51%)' }}
            >
              View Billing & Add Funds
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
