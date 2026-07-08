/**
 * DuckDuckGo web search — no API key required.
 * Scrapes the HTML search endpoint and returns a formatted context block
 * suitable for injecting into an AI prompt.
 */

const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Keywords that indicate the query likely needs live/current web data */
const SEARCH_KEYWORDS = [
  'today', 'now', 'current', 'latest', 'recent', 'this week', 'this month',
  '2025', '2026', 'yesterday', 'tomorrow', 'upcoming', 'breaking',
  'price', 'rate', 'exchange', 'weather', 'score', 'election', 'winner',
  'death', 'born', 'appointed', 'fired', 'stock', 'bitcoin', 'crypto',
  'dollar to ld', 'lrd', 'usd to lrd', 'liberia', 'monrovia', 'liberian',
];

export function needsSearch(query: string): boolean {
  const lower = query.toLowerCase();
  return SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

async function fetchHtmlResults(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, kl: 'us-en' });
  const res = await fetch(`${DDG_HTML_URL}?${params}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];
  const html = await res.text();

  const results: SearchResult[] = [];

  // Each organic result sits inside <div class="result results_links ...">
  // We extract blocks between result__title and result__snippet
  const blockRe = /<a class="result__a"[\s\S]*?href="([^"]*)"[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null && results.length < 5) {
    const rawHref = m[1];
    const rawTitle = m[2];
    const rawSnippet = m[3];

    // DDG hrefs are relative: //duckduckgo.com/l/?uddg=ENCODED_URL
    const uddgMatch = rawHref.match(/uddg=([^&]+)/);
    const url = uddgMatch ? decodeURIComponent(uddgMatch[1]) : '';
    if (!url.startsWith('http')) continue;

    const title = decodeHtmlEntities(stripTags(rawTitle)).trim();
    const snippet = decodeHtmlEntities(stripTags(rawSnippet)).replace(/\s+/g, ' ').trim();

    if (title && snippet) {
      results.push({ title, snippet, url });
    }
  }

  // Fallback: if the block regex found nothing (layout may vary), try snippet-only
  if (results.length === 0) {
    const snippetRe = /<a class="result__snippet" href="([^"]*)">([\s\S]*?)<\/a>/g;
    while ((m = snippetRe.exec(html)) !== null && results.length < 5) {
      const rawHref = m[1];
      const rawSnippet = m[2];
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      const url = uddgMatch ? decodeURIComponent(uddgMatch[1]) : '';
      if (!url.startsWith('http')) continue;
      const snippet = decodeHtmlEntities(stripTags(rawSnippet)).replace(/\s+/g, ' ').trim();
      if (snippet) results.push({ title: '', snippet, url });
    }
  }

  return results;
}

/**
 * Run a DuckDuckGo web search and return a formatted context string
 * ready to prepend to the AI prompt, or null if nothing useful was found.
 */
export async function webSearch(query: string): Promise<string | null> {
  try {
    const results = await fetchHtmlResults(query);
    if (results.length === 0) return null;

    const lines: string[] = [`[WEB SEARCH RESULTS — query: "${query}"]`];
    for (const r of results) {
      if (r.title) lines.push(`• ${r.title}`);
      lines.push(`  ${r.snippet}`);
      lines.push(`  Source: ${r.url}`);
    }
    lines.push('[END WEB RESULTS — use the above to answer accurately and cite sources]');
    return lines.join('\n');
  } catch {
    return null;
  }
}
