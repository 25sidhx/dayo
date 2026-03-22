// Quotable API — free, no key, HTTPS, CORS ✓
// https://github.com/lukePeavey/quotable

export interface DailyQuote {
  content: string;
  author: string;
}

// Cache in module memory so it only fetches once per server restart
let cachedQuote: DailyQuote | null = null;

export async function fetchDailyQuote(): Promise<DailyQuote> {
  if (cachedQuote) return cachedQuote;

  try {
    // Filter by tags relevant to students
    const tags = ['motivational', 'education', 'success', 'wisdom'];
    const tag  = tags[new Date().getDay() % tags.length]; // rotate daily
    const res  = await fetch(
      `https://api.quotable.io/quotes/random?tags=${tag}&maxLength=120`,
      { next: { revalidate: 86400 } } // cache 24h
    );
    if (!res.ok) throw new Error('Quotable fetch failed');
    const json = await res.json();
    const q = Array.isArray(json) ? json[0] : json;
    cachedQuote = { content: q.content, author: q.author };
    return cachedQuote;
  } catch {
    // Fallback quote if API is down
    return {
      content: 'The secret of getting ahead is getting started.',
      author:  'Mark Twain',
    };
  }
}
