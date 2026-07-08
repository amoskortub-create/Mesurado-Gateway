/** All mock data for the Mesurado AI prototype */

export const MOCK_USER = {
  email: 'alex@mediatechliberia.com',
  name: 'Alex Johnson',
  userId: 'mock_user_001',
};

export const MOCK_USAGE = {
  tokensRemaining: 742_835,
  totalTokensUsed: 257_165,
  plan: 'payg' as 'free' | 'payg',
  searchesUsedThisMonth: 12,
};

// 30 days of daily token usage
export const MOCK_DAILY_USAGE = (() => {
  const data: { date: string; tokens: number }[] = [];
  const seed = [4200, 8100, 5300, 9200, 11400, 7600, 3200, 6800, 14200, 9800, 5100, 7300, 12100, 8900, 4700, 11300, 9200, 6400, 14800, 10200, 7900, 5600, 9100, 13300, 8200, 6700, 11900, 7400, 5800, 9600];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({ date: d.toISOString().slice(0, 10), tokens: seed[29 - i] ?? 0 });
  }
  return data;
})();

export const MOCK_API_KEYS = [
  { $id: 'key_001', label: 'Production App', key_prefix: 'mesurado_sk_live_a3f2', is_active: true, created_at: '2025-06-01T10:00:00Z' },
  { $id: 'key_002', label: 'CI/CD Pipeline', key_prefix: 'mesurado_sk_live_b8c4', is_active: true, created_at: '2025-06-12T14:30:00Z' },
  { $id: 'key_003', label: 'Staging Environment', key_prefix: 'mesurado_sk_live_d1e9', is_active: false, created_at: '2025-05-20T09:15:00Z' },
];

const SOURCES = ['api', 'playground', 'api', 'api', 'playground', 'api'] as const;
export const MOCK_USAGE_LOGS = Array.from({ length: 40 }, (_, i) => {
  const d = new Date();
  d.setHours(d.getHours() - i * 4);
  const promptTokens = 120 + Math.floor(Math.sin(i * 1.3) * 80 + 80);
  const completionTokens = 80 + Math.floor(Math.cos(i * 0.9) * 60 + 60);
  const totalTokens = promptTokens + completionTokens;
  return {
    id: `log_${i.toString().padStart(3, '0')}`,
    timestamp: d.toISOString(),
    source: SOURCES[i % SOURCES.length],
    promptTokens,
    completionTokens,
    totalTokens,
    costDebit: totalTokens * 0.00000075,
    keyId: i % 3 === 2 ? 'key_002' : 'key_001',
  };
});

export const MOCK_CHAT_RESPONSES = [
  "I'm Mesurado AI, your OpenAI-compatible API gateway built by Media Tech Liberia. I'm running the mesurado-1.0-lite model and I'm here to help with any tasks you throw at me. What would you like to explore today?",
  "Great question! The Mesurado API follows the OpenAI ChatCompletion format exactly, so you can swap in your existing OpenAI client with just a base URL and key change. The endpoint is `POST /v1/chat/completions` with an `Authorization: Bearer mesurado_sk_live_…` header.",
  "Your free tier includes 1,000,000 tokens shared across API calls and Playground sessions. Usage is metered at $0.75 per million tokens after the free tier is exhausted. You can track consumption in real time from the Overview and Analytics pages.",
  "Absolutely! Here's a Python example:\n\n```python\nfrom openai import OpenAI\n\nclient = OpenAI(\n    base_url=\"https://your-gateway.replit.app/v1\",\n    api_key=\"mesurado_sk_live_your_key\",\n)\n\nresponse = client.chat.completions.create(\n    model=\"mesurado-1.0-lite\",\n    messages=[{\"role\": \"user\", \"content\": \"Hello!\"}],\n)\nprint(response.choices[0].message.content)\n```",
  "The temperature parameter controls output randomness. At 0.0 the model is deterministic and focused; at 1.0 it's more creative and varied. For code generation, try 0.2–0.4. For creative writing, 0.7–0.9 works well.",
  "Media Tech Liberia built Mesurado AI as a developer-focused API gateway that routes to open-source LLMs, giving developers an affordable alternative to closed-source providers with a familiar OpenAI-compatible interface.",
  "I can help with code, analysis, writing, summarisation, Q&A, and more. Since I use mesurado-1.0-lite under the hood, I'm especially efficient for structured tasks and shorter context windows. What are you building?",
];

export const MOCK_SEARCH_RESPONSES = [
  "Based on the latest search results, here's what I found: The Liberian Observer reports significant developments in the region today. FrontPage Africa Online confirms the information with additional context from on-the-ground reporting. The New Dawn Liberia provides further details including official statements. This information is current as of today's date.",
  "According to live search results retrieved just now, the current situation is as follows: Multiple credible Liberian news sources are reporting on this topic. The data reflects real-time conditions and may change throughout the day. I recommend checking the source URLs directly for the most up-to-date figures.",
  "Live search results show the following current information: Sources including the Liberian Observer, FrontPage Africa Online, and The New Dawn Liberia are covering this story. The information above was retrieved in real time and reflects today's latest available data.",
];

let chatResponseIndex = 0;
export function getMockChatResponse(input: string, usedSearch = false): string {
  if (usedSearch) {
    return MOCK_SEARCH_RESPONSES[chatResponseIndex % MOCK_SEARCH_RESPONSES.length];
  }
  const lower = input.toLowerCase();
  if (lower.includes('python') || lower.includes('code') || lower.includes('example')) return MOCK_CHAT_RESPONSES[3];
  if (lower.includes('temperature') || lower.includes('setting')) return MOCK_CHAT_RESPONSES[4];
  if (lower.includes('token') || lower.includes('free') || lower.includes('pricing')) return MOCK_CHAT_RESPONSES[2];
  if (lower.includes('api') && lower.includes('key')) return MOCK_CHAT_RESPONSES[1];
  if (lower.includes('who') || lower.includes('liberia') || lower.includes('built')) return MOCK_CHAT_RESPONSES[5];
  if (lower.includes('help') || lower.includes('what') || lower.includes('can')) return MOCK_CHAT_RESPONSES[6];
  const resp = MOCK_CHAT_RESPONSES[chatResponseIndex % MOCK_CHAT_RESPONSES.length];
  chatResponseIndex++;
  return resp;
}
