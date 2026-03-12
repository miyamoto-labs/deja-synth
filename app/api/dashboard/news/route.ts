import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ── Types ── */

interface CacheEntry {
  data: NewsArticle[];
  timestamp: number;
}

interface NewsArticle {
  id: string;
  title: string;
  link: string;
  description: string | null;
  imageUrl: string | null;
  sourceName: string;
  sourceIcon: string | null;
  pubDate: string;
  categories: string[];
  keywords: string[];
}

/* ── Module-level cache ── */

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Daily credit tracking (resets on new day)
let creditCount = 0;
let creditResetDate = new Date().toDateString();
const MAX_DAILY_CREDITS = 180; // leave 20-credit buffer from 200 limit

/* ── Category → NewsData.io param mapping ── */

const CATEGORY_MAP: Record<string, { category?: string; q?: string }> = {
  all: { category: "politics,business,technology,world,science" },
  politics: { category: "politics" },
  crypto: { q: "cryptocurrency OR bitcoin OR ethereum OR polymarket" },
  business: { category: "business" },
  technology: { category: "technology" },
  world: { category: "world" },
};

/* ── Route handler ── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "all";
    const search = searchParams.get("q") || "";

    // Build cache key
    const cacheKey = `${category}:${search}`;

    // Check daily credit budget (reset at midnight)
    const today = new Date().toDateString();
    if (today !== creditResetDate) {
      creditCount = 0;
      creditResetDate = today;
    }

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(
        {
          articles: cached.data,
          meta: { category, query: search || null, fromCache: true, cachedAt: new Date(cached.timestamp).toISOString() },
        },
        {
          headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        }
      );
    }

    // Budget exceeded — return stale cache or empty
    if (creditCount >= MAX_DAILY_CREDITS) {
      if (cached) {
        return NextResponse.json({
          articles: cached.data,
          meta: { category, query: search || null, fromCache: true, stale: true, cachedAt: new Date(cached.timestamp).toISOString() },
        });
      }
      return NextResponse.json({ articles: [], meta: { category, budgetExceeded: true } });
    }

    // Build NewsData.io request
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "NEWSDATA_API_KEY not configured" }, { status: 500 });
    }

    const params = new URLSearchParams({ apikey: apiKey, language: "en" });

    if (search) {
      // User search overrides category
      params.set("q", search);
    } else {
      const mapping = CATEGORY_MAP[category] || CATEGORY_MAP.all;
      if (mapping.category) params.set("category", mapping.category);
      if (mapping.q) params.set("q", mapping.q);
    }

    const res = await fetch(`https://newsdata.io/api/1/latest?${params.toString()}`, {
      headers: { "X-ACCESS-KEY": apiKey },
    });

    creditCount++;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      console.error(`[news] NewsData.io error ${res.status}: ${errorText}`);
      // Return stale cache on API error
      if (cached) {
        return NextResponse.json({
          articles: cached.data,
          meta: { category, query: search || null, fromCache: true, stale: true, cachedAt: new Date(cached.timestamp).toISOString() },
        });
      }
      return NextResponse.json({ error: "News API error" }, { status: 502 });
    }

    const json = await res.json();
    const results = json.results || [];

    // Map to clean shape
    const articles: NewsArticle[] = results
      .filter((a: any) => a.title) // skip entries without titles
      .map((a: any) => ({
        id: a.article_id || a.link || Math.random().toString(36),
        title: a.title,
        link: a.link || "#",
        description: a.description || null,
        imageUrl: a.image_url || null,
        sourceName: a.source_name || a.source_id || "Unknown",
        sourceIcon: a.source_icon || null,
        pubDate: a.pubDate || new Date().toISOString(),
        categories: Array.isArray(a.category) ? a.category : [],
        keywords: Array.isArray(a.keywords) ? a.keywords.slice(0, 5) : [],
      }));

    // Update cache
    cache.set(cacheKey, { data: articles, timestamp: Date.now() });

    return NextResponse.json(
      {
        articles,
        meta: {
          category,
          query: search || null,
          fromCache: false,
          cachedAt: new Date().toISOString(),
          creditsUsedToday: creditCount,
        },
      },
      {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
      }
    );
  } catch (err: any) {
    console.error("[news] Unexpected error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
