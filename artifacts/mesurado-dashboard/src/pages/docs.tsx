import { useState } from 'react';
import { Copy, Check, BookOpen, Key, Zap, Code2, Terminal, Globe, Lock, AlertCircle } from 'lucide-react';

const BASE_URL = 'https://mesurado.mediatechliberia.online/v1';
const MODEL = 'mesurado-1.0-lite';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative group rounded-xl overflow-hidden border border-border bg-[hsl(222_47%_7%)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <span className="text-xs font-mono text-muted-foreground">{language}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition opacity-0 group-hover:opacity-100">
          {copied ? <><Check size={12} className="text-emerald-400" />Copied</> : <><Copy size={12} />Copy</>}
        </button>
      </div>
      <pre className="px-4 py-4 overflow-x-auto text-sm text-slate-200 font-mono leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(0 72% 51% / 0.12)', border: '1px solid hsl(0 72% 51% / 0.25)' }}>
          <Icon size={15} style={{ color: 'hsl(0 72% 51%)' }} />
        </div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const CURL_BASIC = `curl -X POST ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer mesurado_sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      { "role": "user", "content": "What is the capital of France?" }
    ],
    "temperature": 0.75
  }'`;

const CURL_STREAMING = `curl -X POST ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer mesurado_sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  --no-buffer \\
  -d '{
    "messages": [
      { "role": "user", "content": "Tell me a short story." }
    ],
    "stream": true,
    "temperature": 0.75
  }'`;

const JS_BASIC = `const response = await fetch('${BASE_URL}/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mesurado_sk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    temperature: 0.75,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);`;

const JS_STREAMING = `const response = await fetch('${BASE_URL}/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mesurado_sk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Tell me a story.' }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\\n');
  for (const line of lines) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    const chunk = JSON.parse(line.slice(6));
    process.stdout.write(chunk.choices[0].delta.content ?? '');
  }
}`;

const PYTHON_BASIC = `from openai import OpenAI

client = OpenAI(
    api_key="mesurado_sk_live_YOUR_KEY",
    base_url="${BASE_URL}",
)

response = client.chat.completions.create(
    model="${MODEL}",
    messages=[{"role": "user", "content": "Hello!"}],
    temperature=0.75,
)

print(response.choices[0].message.content)`;

const PYTHON_STREAMING = `from openai import OpenAI

client = OpenAI(
    api_key="mesurado_sk_live_YOUR_KEY",
    base_url="${BASE_URL}",
)

stream = client.chat.completions.create(
    model="${MODEL}",
    messages=[{"role": "user", "content": "Tell me a story."}],
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`;

const PYTHON_SYSTEM = `response = client.chat.completions.create(
    model="${MODEL}",
    messages=[
        {"role": "system", "content": "You are a helpful assistant that speaks formally."},
        {"role": "user",   "content": "What is machine learning?"},
    ],
)`;

const RESPONSE_JSON = `{
  "id": "chatcmpl-a3f9b2c4d1e8...",
  "object": "chat.completion",
  "created": 1720605600,
  "model": "${MODEL}",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Paris is the capital of France."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 8,
    "total_tokens": 22
  }
}`;

const ERROR_JSON = `{
  "error": {
    "message": "Missing or invalid Authorization header.",
    "type": "invalid_request_error",
    "code": 401
  }
}`;

const sections = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'endpoint', label: 'Endpoint' },
  { id: 'examples', label: 'Code Examples' },
  { id: 'response', label: 'Response Format' },
  { id: 'errors', label: 'Error Codes' },
  { id: 'limits', label: 'Rate Limits' },
];

export default function DocsPage() {
  const [tab, setTab] = useState<'curl' | 'javascript' | 'python'>('python');
  const [subTab, setSubTab] = useState<'basic' | 'streaming' | 'system'>('basic');

  const examples = {
    curl:       { basic: CURL_BASIC, streaming: CURL_STREAMING, system: '' },
    javascript: { basic: JS_BASIC,   streaming: JS_STREAMING,   system: '' },
    python:     { basic: PYTHON_BASIC, streaming: PYTHON_STREAMING, system: PYTHON_SYSTEM },
  };

  const langLabel = { curl: 'bash', javascript: 'javascript', python: 'python' };

  return (
    <div className="flex gap-8 max-w-6xl">
      {/* Sticky sidebar TOC */}
      <nav className="hidden lg:block w-44 flex-shrink-0 pt-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">On this page</p>
        <ul className="space-y-1">
          {sections.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-sm text-muted-foreground hover:text-foreground transition block py-0.5">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={20} style={{ color: 'hsl(0 72% 51%)' }} />
            <h1 className="text-2xl font-extrabold text-foreground">API Reference</h1>
          </div>
          <p className="text-muted-foreground">
            The Mesurado API is <span className="font-semibold text-foreground">OpenAI-compatible</span> — any SDK or tool that supports a custom base URL works out of the box. Just swap the base URL and key prefix.
          </p>
        </div>

        {/* Quick start */}
        <Section id="quickstart" icon={Zap} title="Quick Start">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              { n: '1', title: 'Generate a key', desc: 'Go to API Keys → Generate Key. Copy and store it securely — it won\'t be shown again.' },
              { n: '2', title: 'Set the base URL', desc: `Point your client to ${BASE_URL}` },
              { n: '3', title: 'Send your request', desc: 'Use the Authorization header with your key and send messages.' },
            ].map(step => (
              <div key={step.n} className="rounded-xl border border-border bg-card p-4">
                <div className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center mb-2.5 text-white" style={{ background: 'hsl(0 72% 51%)' }}>{step.n}</div>
                <p className="text-sm font-bold text-foreground mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <CodeBlock code={CURL_BASIC} language="bash" />
        </Section>

        {/* Authentication */}
        <Section id="authentication" icon={Lock} title="Authentication">
          <p className="text-sm text-muted-foreground mb-4">
            All requests require a Bearer token in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">Authorization</code> header. Keys are generated from the <strong className="text-foreground">API Keys</strong> page and are prefixed with <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">mesurado_sk_live_</code>.
          </p>
          <CodeBlock code={`Authorization: Bearer mesurado_sk_live_xxxxxxxxxxxxxxxx`} language="http" />
          <div className="mt-4 flex items-start gap-3 p-4 rounded-xl border text-sm" style={{ background: 'hsl(38 92% 50% / 0.06)', borderColor: 'hsl(38 92% 50% / 0.2)' }}>
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(38 92% 50%)' }} />
            <p className="text-muted-foreground">Never expose your key in client-side code or public repositories. Rotate keys immediately from the dashboard if compromised.</p>
          </div>
        </Section>

        {/* Endpoint */}
        <Section id="endpoint" icon={Globe} title="Endpoint">
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-md text-white" style={{ background: 'hsl(0 72% 51%)' }}>POST</span>
              <code className="text-sm font-mono text-foreground">{BASE_URL}/chat/completions</code>
            </div>
            <div className="p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Request body</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs font-bold text-muted-foreground">Field</th>
                    <th className="text-left py-2 pr-4 text-xs font-bold text-muted-foreground">Type</th>
                    <th className="text-left py-2 pr-4 text-xs font-bold text-muted-foreground">Default</th>
                    <th className="text-left py-2 text-xs font-bold text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { f: 'messages', t: 'array', d: 'required', desc: 'Conversation history. Each item: { role: "user" | "assistant" | "system", content: string }' },
                    { f: 'temperature', t: 'number', d: '0.75', desc: '0–2. Higher = more creative / varied output.' },
                    { f: 'max_tokens', t: 'integer', d: '1024', desc: 'Maximum tokens in the completion. Up to 8192.' },
                    { f: 'stream', t: 'boolean', d: 'false', desc: 'When true, response is streamed as Server-Sent Events (OpenAI SSE format).' },
                    { f: 'model', t: 'string', d: 'optional', desc: `Any value accepted. The engine always uses ${MODEL}.` },
                  ].map(r => (
                    <tr key={r.f}>
                      <td className="py-2.5 pr-4"><code className="text-xs font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{r.f}</code></td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{r.t}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">{r.d}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Code Examples */}
        <Section id="examples" icon={Code2} title="Code Examples">
          {/* Language tabs */}
          <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
            {(['python', 'javascript', 'curl'] as const).map(l => (
              <button key={l} onClick={() => { setTab(l); setSubTab('basic'); }}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${tab === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {l === 'curl' ? 'cURL' : l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-4 mb-3 border-b border-border">
            {([
              { k: 'basic', label: 'Basic' },
              { k: 'streaming', label: 'Streaming' },
              ...(tab === 'python' ? [{ k: 'system', label: 'System prompt' }] : []),
            ] as { k: 'basic' | 'streaming' | 'system'; label: string }[]).map(({ k, label }) => (
              <button key={k} onClick={() => setSubTab(k)}
                className={`pb-2 text-sm font-medium transition border-b-2 -mb-px ${subTab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>

          {examples[tab][subTab]
            ? <CodeBlock code={examples[tab][subTab]} language={langLabel[tab]} />
            : (
              <div className="p-4 rounded-xl border border-border text-sm text-muted-foreground text-center">
                Use <code className="font-mono text-xs">stream: true</code> in the request body — see the Streaming tab above for the full example.
              </div>
            )
          }

          {tab === 'python' && subTab === 'basic' && (
            <p className="mt-3 text-xs text-muted-foreground">
              Install the OpenAI SDK: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">pip install openai</code>
            </p>
          )}
        </Section>

        {/* Response */}
        <Section id="response" icon={Terminal} title="Response Format">
          <p className="text-sm text-muted-foreground mb-4">Non-streaming responses return a standard OpenAI <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">chat.completion</code> object.</p>
          <CodeBlock code={RESPONSE_JSON} language="json" />
        </Section>

        {/* Errors */}
        <Section id="errors" icon={AlertCircle} title="Error Codes">
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Meaning</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { code: '401', meaning: 'Invalid or missing API key', fix: 'Check the Authorization header. Key must start with mesurado_sk_live_' },
                  { code: '402', meaning: 'Insufficient token balance', fix: 'Top up your balance from the Billing page' },
                  { code: '422', meaning: 'Invalid request body', fix: 'Check that messages is a non-empty array with role + content' },
                  { code: '429', meaning: 'Rate limit exceeded or engine at capacity', fix: 'Wait and retry. Default limit: 60 requests/minute' },
                  { code: '503', meaning: 'Engine temporarily unreachable', fix: 'Retry with exponential backoff' },
                ].map(r => (
                  <tr key={r.code} className="hover:bg-muted/20 transition">
                    <td className="px-5 py-3"><code className="text-xs font-mono font-bold text-red-500">{r.code}</code></td>
                    <td className="px-5 py-3 text-sm text-foreground">{r.meaning}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{r.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CodeBlock code={ERROR_JSON} language="json" />
        </Section>

        {/* Rate limits */}
        <Section id="limits" icon={Key} title="Rate Limits">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Free tier', value: '60 req / min', sub: 'per API key' },
              { label: 'Paid tier', value: '120 req / min', sub: 'per API key' },
              { label: 'Concurrency', value: '3 simultaneous', sub: 'across all users' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.label}</p>
                <p className="text-xl font-extrabold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            When rate-limited, the API returns <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">429</code> with a <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">Retry-After</code> header indicating how many seconds to wait.
          </p>
        </Section>
      </div>
    </div>
  );
}
