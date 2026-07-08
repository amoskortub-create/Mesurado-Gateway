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
  'bitcoin', 'dollar to ld', 'lrd to usd', 'usd to lrd',
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

// ── Query classifier → topic ───────────────────────────────────────────────────
type SearchTopic =
  | 'exchange_rate'
  | 'bitcoin'
  | 'crypto'
  | 'weather'
  | 'liberia_news'
  | 'stock'
  | 'election'
  | 'default';

function classifyQuery(q: string): SearchTopic {
  const lower = q.toLowerCase();
  if (lower.match(/usd.*(lrd|liberia)|lrd.*(usd)|liberian dollar|dollar to ld/)) return 'exchange_rate';
  if (lower.includes('bitcoin') || lower.includes('btc')) return 'bitcoin';
  if (lower.includes('crypto') || lower.includes('ethereum') || lower.includes('eth')) return 'crypto';
  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain')) return 'weather';
  if (lower.includes('election') || lower.includes('vote') || lower.includes('president')) return 'election';
  if (lower.includes('stock') || lower.includes('market') || lower.includes('nasdaq') || lower.includes('s&p')) return 'stock';
  if (lower.match(/liberia|monrovia|weah|cdc|unity party|senate|house of rep/)) return 'liberia_news';
  return 'default';
}

// ── Per-topic mock search results ──────────────────────────────────────────────
const TOPIC_RESULTS: Record<SearchTopic, SearchResult[]> = {
  exchange_rate: [
    {
      title: 'USD/LRD Exchange Rate Today — Central Bank of Liberia',
      snippet: 'As of July 8, 2026: 1 USD = 194.75 LRD (Liberian Dollar). The rate has been stable over the past 7 days, ranging between LRD 193.20 and LRD 195.40. Source: CBL official daily rate.',
      url: 'https://www.cbl.org.lr/exchange-rates',
    },
    {
      title: 'USD to LRD Live Rate — FrontPage Africa Online',
      snippet: 'Current black market rate in Monrovia: approximately LRD 196–198 per USD as of this morning. Commercial banks offering LRD 194.50 buy / 195.10 sell.',
      url: 'https://frontpageafricaonline.com/business/usd-lrd-rate',
    },
    {
      title: 'Liberia Currency Update — The New Dawn Liberia',
      snippet: 'The Liberian Dollar held steady today as the Central Bank maintained its intervention policy. Year-to-date the LRD has depreciated approximately 2.3% against the US Dollar.',
      url: 'https://thenewdawnliberia.com/business/currency-update',
    },
  ],
  bitcoin: [
    {
      title: 'Bitcoin Price Today — Live BTC/USD Rate',
      snippet: 'Bitcoin (BTC) is trading at $107,420 USD as of July 8, 2026 at 01:05 AM UTC. 24h change: +1.8%. Market cap: $2.12 trillion. 24h volume: $48.3 billion.',
      url: 'https://coinmarketcap.com/currencies/bitcoin',
    },
    {
      title: 'BTC Price Analysis — CryptoSlate',
      snippet: 'Bitcoin continues to consolidate above $105,000. Analysts point to institutional inflows and ETF demand as key drivers. Resistance at $110,000; support at $102,500.',
      url: 'https://cryptoslate.com/bitcoin-price-analysis',
    },
    {
      title: 'Bitcoin in LRD — Liberian Exchange Estimate',
      snippet: 'At the current rate of 1 BTC ≈ $107,420 USD and 1 USD ≈ 194.75 LRD, 1 Bitcoin is approximately LRD 20,919,465 today.',
      url: 'https://liberianobserver.com/business/crypto-in-lrd',
    },
  ],
  crypto: [
    {
      title: 'Crypto Market Overview — July 8, 2026',
      snippet: 'Total crypto market cap: $3.87 trillion. BTC: $107,420 (+1.8%), ETH: $4,215 (+2.1%), BNB: $892 (+0.5%), SOL: $312 (+3.2%). Bitcoin dominance: 54.7%.',
      url: 'https://coinmarketcap.com',
    },
    {
      title: 'Ethereum Price Today — ETH/USD Live',
      snippet: 'Ethereum (ETH) trading at $4,215 as of July 8, 2026. 24h high: $4,289. The ETH/BTC ratio stands at 0.0392. Staking yield approximately 3.6% APR.',
      url: 'https://coinmarketcap.com/currencies/ethereum',
    },
    {
      title: 'Crypto in West Africa — Adoption Update',
      snippet: 'Peer-to-peer crypto usage in Liberia has grown 38% year-over-year according to a recent Chainalysis report. USDT and USDC remain the most traded stablecoins in Monrovia.',
      url: 'https://frontpageafricaonline.com/tech/crypto-liberia',
    },
  ],
  weather: [
    {
      title: 'Monrovia Weather Today — July 8, 2026',
      snippet: 'Monrovia, Liberia: 28°C (82°F), Heavy rain showers expected throughout the day. Humidity: 91%. Wind: 12 km/h SW. Typical for rainy season. UV index: Low.',
      url: 'https://weather.com/weather/today/l/Monrovia+Liberia',
    },
    {
      title: 'Liberia 7-Day Forecast — AccuWeather',
      snippet: 'This week: Rain likely every day with temperatures between 25–30°C. The rainy season runs through October. Tuesday sees potential for heavier overnight rainfall.',
      url: 'https://www.accuweather.com/en/lr/monrovia/weather-forecast',
    },
    {
      title: 'Weather Advisory — Liberia Meteorological Service',
      snippet: 'The Liberia Meteorological Service has issued a routine advisory for July 8–10: expect persistent southwest monsoon activity bringing moderate to heavy rainfall across coastal counties.',
      url: 'https://liberianobserver.com/weather-advisory',
    },
  ],
  election: [
    {
      title: 'Liberia Political News — Latest Updates',
      snippet: 'The National Elections Commission of Liberia (NEC) has announced preliminary voter registration statistics for the 2025 cycle. Over 2.4 million citizens are now registered to vote.',
      url: 'https://liberianobserver.com/politics/nec-update',
    },
    {
      title: 'Liberia Government News — FrontPage Africa',
      snippet: 'President Joseph Nyuma Boakai continues his "ARREST" agenda reforms. Key infrastructure projects underway in Lofa and Grand Bassa counties. Senate session scheduled for next week.',
      url: 'https://frontpageafricaonline.com/politics/government',
    },
    {
      title: 'Liberia NEC 2025 Update — The New Dawn',
      snippet: 'The National Elections Commission confirmed timelines for upcoming by-elections. Opposition parties have requested additional polling stations in rural constituencies.',
      url: 'https://thenewdawnliberia.com/politics/elections',
    },
  ],
  stock: [
    {
      title: 'US Stock Market Today — July 8, 2026',
      snippet: 'Markets closed Monday: S&P 500: 6,142.30 (+0.47%), NASDAQ: 19,874.22 (+0.63%), Dow Jones: 44,218.45 (+0.31%). Tech stocks led gains; energy sector flat.',
      url: 'https://finance.yahoo.com/markets',
    },
    {
      title: 'Stock Market Recap — CNBC',
      snippet: 'Wall Street ended higher Tuesday as AI semiconductor stocks rallied. NVIDIA +2.1%, Apple +0.8%, Microsoft +1.2%. The Fed is expected to hold rates at its upcoming meeting.',
      url: 'https://www.cnbc.com/markets',
    },
    {
      title: 'African Markets Update',
      snippet: 'The Johannesburg Stock Exchange (JSE) All Share Index rose 0.6% today. Nigerian NGX Exchange gained 1.2%. West African regional markets broadly stable.',
      url: 'https://frontpageafricaonline.com/business/african-markets',
    },
  ],
  liberia_news: [
    {
      title: 'Top Stories Today — Liberian Observer',
      snippet: 'Breaking: President Boakai signs new energy partnership deal with a West African development bank to expand rural electrification. The project targets 15 counties by 2027.',
      url: 'https://liberianobserver.com/top-stories',
    },
    {
      title: "Today's Headlines — FrontPage Africa Online",
      snippet: 'The University of Liberia announces expanded STEM programs. Health Ministry reports decline in malaria cases in Montserrado County. Road construction on Tubman Boulevard nears completion.',
      url: 'https://frontpageafricaonline.com/today',
    },
    {
      title: 'Latest News — The New Dawn Liberia',
      snippet: 'Liberia National Police report improved response times in Monrovia. Commerce Ministry issues new business registration guidelines. Central Bank releases quarterly economic bulletin.',
      url: 'https://thenewdawnliberia.com/latest',
    },
  ],
  default: [
    {
      title: 'Search Results — Liberian Observer',
      snippet: 'The Liberian Observer is reporting on the latest developments. Our team continues to provide real-time coverage of breaking news, politics, and community events across Liberia.',
      url: 'https://liberianobserver.com/search',
    },
    {
      title: 'Live Coverage — FrontPage Africa Online',
      snippet: 'FrontPage Africa provides in-depth, real-time reporting on this topic. Our journalists on the ground are tracking developments as they unfold across Liberia and West Africa.',
      url: 'https://frontpageafricaonline.com/search',
    },
    {
      title: 'Current Updates — The New Dawn Liberia',
      snippet: 'The New Dawn Liberia is covering this story with up-to-date reporting, official statements, and community perspectives from across the country.',
      url: 'https://thenewdawnliberia.com/search',
    },
  ],
};

// ── Per-topic mock AI responses ────────────────────────────────────────────────
export const SEARCH_AI_RESPONSES: Partial<Record<SearchTopic, string>> = {
  exchange_rate:
    "Based on live search results retrieved just now:\n\n**1 USD = 194.75 LRD** (Central Bank of Liberia official rate, July 8, 2026)\n\n• Commercial bank buy rate: ~LRD 194.50\n• Commercial bank sell rate: ~LRD 195.10\n• Street/parallel rate in Monrovia: ~LRD 196–198\n• Year-to-date depreciation: ~2.3%\n\nThe LRD has been broadly stable this week. For the most accurate rate, check the CBL website or your commercial bank directly.",
  bitcoin:
    "Based on live search data:\n\n**Bitcoin (BTC) = $107,420 USD** as of July 8, 2026 (01:05 AM UTC)\n\n• 24h change: **+1.8%**\n• Market cap: $2.12 trillion\n• 24h trading volume: $48.3 billion\n• In Liberian Dollars: approximately **LRD 20,919,465 per BTC**\n\nBitcoin is consolidating above $105,000. Key resistance at $110,000. Always verify on a live exchange before transacting.",
  crypto:
    "Based on live crypto market data (July 8, 2026):\n\n| Coin | Price | 24h Change |\n|------|-------|------------|\n| BTC | $107,420 | +1.8% |\n| ETH | $4,215 | +2.1% |\n| BNB | $892 | +0.5% |\n| SOL | $312 | +3.2% |\n\nTotal market cap: **$3.87 trillion**. Bitcoin dominance: 54.7%. Crypto adoption in Liberia is growing — P2P volume up 38% YoY per Chainalysis.",
  weather:
    "Based on live weather data for Monrovia, Liberia (July 8, 2026):\n\n🌧️ **Heavy rain showers** throughout the day\n🌡️ Temperature: **28°C (82°F)**\n💧 Humidity: **91%**\n💨 Wind: 12 km/h from the southwest\n\nThis is typical for Liberia's rainy season (May–October). The Liberia Meteorological Service has issued a routine advisory for persistent southwest monsoon activity through July 10. Carry an umbrella and avoid low-lying flood-prone areas.",
  stock:
    "Based on live market data (July 8, 2026 close):\n\n| Index | Value | Change |\n|-------|-------|--------|\n| S&P 500 | 6,142.30 | +0.47% |\n| NASDAQ | 19,874.22 | +0.63% |\n| Dow Jones | 44,218.45 | +0.31% |\n\nAI and semiconductor stocks led the rally. NVIDIA +2.1%, Apple +0.8%. The Federal Reserve is expected to hold interest rates at its next meeting. African markets: JSE +0.6%, NGX +1.2%.",
  election:
    "Based on live search results:\n\nLiberia's National Elections Commission (NEC) has registered over **2.4 million voters** for the current electoral cycle. President Joseph Nyuma Boakai's administration is continuing its ARREST agenda reforms.\n\nKey political updates (July 8, 2026):\n• By-election timelines confirmed by NEC\n• Opposition parties requesting more rural polling stations\n• Senate session scheduled for next week\n• Infrastructure projects underway in Lofa and Grand Bassa counties",
  liberia_news:
    "Based on live news from Liberian sources (July 8, 2026):\n\n🔴 **Top Story:** President Boakai signs new energy partnership to expand rural electrification across 15 counties by 2027.\n\n📰 **Other Headlines:**\n• University of Liberia expands STEM programs\n• Health Ministry reports declining malaria cases in Montserrado\n• Tubman Boulevard road construction nearing completion\n• Central Bank releases Q2 economic bulletin\n• LNP reports improved response times in Monrovia",
};

/** Simulated search — returns topic-specific mocked results */
export async function mockSearch(query: string): Promise<SearchResult[]> {
  await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
  const topic = classifyQuery(query);
  return TOPIC_RESULTS[topic];
}

/** Returns a topic-specific mock AI response for search queries */
export function getSearchAiResponse(query: string): string {
  const topic = classifyQuery(query);
  return (
    SEARCH_AI_RESPONSES[topic] ??
    `Based on live search results retrieved just now, here is what I found regarding "${query}":\n\nMultiple Liberian news sources including the Liberian Observer, FrontPage Africa Online, and The New Dawn Liberia are reporting on this topic. The information reflects the latest available data as of July 8, 2026. For the most precise and up-to-date details, I recommend visiting the source URLs provided in the search results above.`
  );
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
