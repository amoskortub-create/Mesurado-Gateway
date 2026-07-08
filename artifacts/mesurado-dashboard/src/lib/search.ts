/** Live web search utilities — keyword detection + mock search execution for prototype */

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// ── Keyword lists ──────────────────────────────────────────────────────────────
const TIME_SENSITIVE = [
  'today', 'now', 'current', 'latest', 'recent', 'this week', 'this month',
  '2024', '2025', '2026', 'yesterday', 'tomorrow', 'upcoming', 'just announced', 'breaking',
];
const FACTUAL_FRESHNESS = [
  'price', 'cost', 'rate', 'exchange', 'weather', 'score', 'result', 'election',
  'winner', 'death', 'born', 'appointed', 'fired', 'stock', 'market', 'crypto',
  'bitcoin', 'dollar to ld', 'lrd to usd',
];
const LOCATION_FRESHNESS = [
  'open now', 'closed today', 'hours', 'schedule', 'traffic', 'road condition', 'flight status',
];
const EXPLICIT_SEARCH = [
  'search for', 'look up', 'find me', 'google', 'what is the latest', 'tell me the current',
];

const ALL_KEYWORDS = [
  ...TIME_SENSITIVE,
  ...FACTUAL_FRESHNESS,
  ...LOCATION_FRESHNESS,
  ...EXPLICIT_SEARCH,
];

/** Returns true if the query likely needs live web data */
export function needsSearch(query: string): boolean {
  const q = query.toLowerCase();
  return ALL_KEYWORDS.some(kw => q.includes(kw));
}

// ── Mock search execution (prototype) ─────────────────────────────────────────
const BASE_RESULTS: SearchResult[] = [
  {
    title: 'Breaking: Latest Developments — Liberian Observer',
    snippet:
      'Stay up to date with breaking news and real-time coverage from Liberia. Updated continuously with the latest headlines across politics, economy, and society.',
    url: 'https://liberianobserver.com/latest',
  },
  {
    title: 'Current Affairs & Top Stories — FrontPage Africa Online',
    snippet:
      'Live reporting on politics, business, and social issues across Liberia and West Africa. Real-time updates from our team on the ground.',
    url: 'https://frontpageafricaonline.com/news',
  },
  {
    title: "Today's Top Stories — The New Dawn Liberia",
    snippet:
      'Comprehensive daily coverage from Monrovia. Includes official statements, market rates, and community updates refreshed throughout the day.',
    url: 'https://thenewdawnliberia.com/today',
  },
];

/** Simulated search — returns mocked results with query context injected */
export async function mockSearch(query: string): Promise<SearchResult[]> {
  await new Promise(r => setTimeout(r, 400 + Math.random() * 300)); // simulate latency
  return BASE_RESULTS.map(r => ({
    ...r,
    snippet: r.snippet + ` [Search: "${query.slice(0, 35)}${query.length > 35 ? '…' : ''}"]`,
  }));
}

/** Formats search results as an injected context block for the prompt */
export function formatSearchContext(results: SearchResult[], query: string): string {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const body = results
    .map((r, i) => `${i + 1}. Title: ${r.title}\n   Snippet: ${r.snippet}\n   Source: ${r.url}`)
    .join('\n\n');
  return (
    `[SEARCH RESULTS - Retrieved at ${ts}]\n${body}\n[END SEARCH RESULTS]\n\n` +
    `User question: ${query}\nAnswer using the search results above and your general knowledge.`
  );
}

/** Rough word-based token counter for billing */
export function countSearchTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.35);
}
