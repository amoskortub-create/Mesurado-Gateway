import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { Send, Loader2, Bot, User } from 'lucide-react';
import type { PlaygroundSettings } from './settings-panel';
import { getMockChatResponse, MOCK_USAGE } from '@/lib/mock';
import { countTokens, calcCost } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: { promptTokens: number; completionTokens: number; costDebit: number };
}

interface ChatInterfaceProps {
  settings: PlaygroundSettings;
}

export function ChatInterface({ settings }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokensRemaining, setTokensRemaining] = useState(MOCK_USAGE.tokensRemaining);
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

    // Simulate realistic network delay
    const delay = 600 + Math.random() * 800;
    await new Promise(r => setTimeout(r, delay));

    const aiContent = getMockChatResponse(text);
    const promptTokens = countTokens(text + (settings.systemPrompt || ''));
    const completionTokens = countTokens(aiContent);
    const costDebit = calcCost(promptTokens + completionTokens);

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: aiContent,
      metadata: { promptTokens, completionTokens, costDebit },
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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  const SUGGESTIONS = [
    'What is Mesurado AI?',
    'Show me a Python API example',
    'How does pricing work?',
    'What temperature should I use for code?',
  ];

  return (
    <div className="h-full bg-card border border-card-border rounded-2xl flex flex-col overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-extrabold"
            style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%), hsl(217 72% 47%))' }}>M</div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">mesurado-llama3.2-3b</p>
            <p className="text-xs text-muted-foreground">Playground — mock mode</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'hsl(217 72% 47% / 0.1)', color: 'hsl(217 72% 47%)' }}>
            {tokensRemaining.toLocaleString()} tokens left
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="text-center max-w-xs">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold mx-auto mb-4 shadow-lg"
                style={{ background: 'linear-gradient(135deg, hsl(0 72% 51%) 0%, hsl(217 72% 47%) 100%)' }}>M</div>
              <p className="text-base font-bold text-foreground">Mesurado AI Playground</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Try a prompt below or adjust settings on the left panel.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
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
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white mt-0.5"
              style={{ background: msg.role === 'user' ? 'hsl(222 47% 20%)' : 'hsl(0 72% 51%)' }}>
              {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
            </div>
            <div className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-white rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm bg-muted text-foreground'}`}
                style={msg.role === 'user' ? { background: 'hsl(222 47% 20%)' } : {}}>
                {msg.content}
              </div>
              {msg.metadata && (
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'hsl(217 72% 47% / 0.1)', color: 'hsl(217 72% 47%)' }}>
                    {(msg.metadata.promptTokens + msg.metadata.completionTokens).toLocaleString()} tokens
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
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white mt-0.5"
              style={{ background: 'hsl(0 72% 51%)' }}><Bot size={13} /></div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea ref={textareaRef} value={input} onChange={autoResize} onKeyDown={handleKeyDown}
            disabled={loading} rows={1}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:border-primary transition disabled:opacity-50"
            placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
            style={{ minHeight: '42px', maxHeight: '120px' }} />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition disabled:opacity-40 hover:opacity-90 active:scale-95 shadow-sm"
            style={{ background: 'hsl(0 72% 51%)' }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Temp: <strong className="text-foreground">{settings.temperature.toFixed(2)}</strong>
          {' · '}Max tokens: <strong className="text-foreground">{settings.maxTokens}</strong>
          {' · '}
          <Link href="/api-keys" className="underline hover:text-foreground transition">Manage API keys</Link>
        </p>
      </div>
    </div>
  );
}
