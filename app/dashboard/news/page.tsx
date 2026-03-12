"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { timeAgo } from "@/app/lib/utils/timeAgo";

/* ── Types ── */

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

/* ── Categories ── */

const categories = [
  { id: "all", label: "All", emoji: "\u{1F4F0}" },
  { id: "politics", label: "Politics", emoji: "\u{1F3DB}\u{FE0F}" },
  { id: "crypto", label: "Crypto", emoji: "\u{20BF}" },
  { id: "business", label: "Business", emoji: "\u{1F4BC}" },
  { id: "technology", label: "Technology", emoji: "\u{1F4BB}" },
  { id: "world", label: "World", emoji: "\u{1F30D}" },
];

/* ── News Card ── */

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <motion.a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="ep-card overflow-hidden flex flex-col group cursor-pointer hover:border-accent/20 transition-colors"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Image */}
      {article.imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-ep-surface">
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* Source + Time */}
        <div className="flex items-center gap-2 mb-2">
          {article.sourceIcon && (
            <img
              src={article.sourceIcon}
              alt=""
              className="h-4 w-4 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-xs text-text-muted truncate max-w-[120px]">{article.sourceName}</span>
          <span className="text-[10px] text-text-muted">&middot;</span>
          <span className="text-xs text-text-muted whitespace-nowrap">{timeAgo(article.pubDate)}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-primary leading-snug mb-2 line-clamp-2 group-hover:text-accent transition-colors">
          {article.title}
        </h3>

        {/* Description */}
        {article.description && (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3 mb-3">
            {article.description}
          </p>
        )}

        {/* Category badges */}
        {article.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
            {article.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent capitalize"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.a>
  );
}

/* ── Skeleton ── */

function NewsCardSkeleton() {
  return (
    <div className="ep-card overflow-hidden">
      <div className="aspect-video w-full skeleton" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 skeleton rounded-sm" />
          <div className="h-3 w-20 skeleton rounded" />
          <div className="h-3 w-12 skeleton rounded" />
        </div>
        <div className="h-4 w-3/4 skeleton rounded" />
        <div className="h-4 w-1/2 skeleton rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-full skeleton rounded" />
          <div className="h-3 w-2/3 skeleton rounded" />
        </div>
        <div className="flex gap-1.5 pt-1">
          <div className="h-5 w-16 skeleton rounded-full" />
          <div className="h-5 w-14 skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  // Search debounce (500ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch news
  const fetchNews = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (debouncedQuery) params.set("q", debouncedQuery);

      const res = await fetch(`/api/dashboard/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch news");

      const data = await res.json();
      setArticles(data.articles || []);
      setLastUpdated(data.meta?.cachedAt || new Date().toISOString());
      setFromCache(data.meta?.fromCache || false);
    } catch (err) {
      console.error("[news] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, debouncedQuery]);

  // Initial fetch + polling every 5 min
  useEffect(() => {
    setLoading(true);
    fetchNews();
    const interval = setInterval(fetchNews, 300_000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Source count
  const sourceCount = useMemo(() => {
    const sources = new Set(articles.map((a) => a.sourceName));
    return sources.size;
  }, [articles]);

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-primary">News</h1>
          <p className="text-sm text-text-secondary mt-1">
            Market-moving news from thousands of sources
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${fromCache ? "bg-yellow-400" : "bg-profit"}`} />
            Updated {timeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="ep-card px-4 py-3">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Articles</p>
          <p className="text-lg font-mono font-bold text-text-primary mt-0.5">
            {loading ? <span className="skeleton inline-block h-5 w-8 rounded" /> : articles.length}
          </p>
        </div>
        <div className="ep-card px-4 py-3">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Sources</p>
          <p className="text-lg font-mono font-bold text-text-primary mt-0.5">
            {loading ? <span className="skeleton inline-block h-5 w-8 rounded" /> : sourceCount}
          </p>
        </div>
        <div className="ep-card px-4 py-3 hidden sm:block">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Category</p>
          <p className="text-lg font-mono font-bold text-accent mt-0.5 capitalize">
            {activeCategory}
          </p>
        </div>
      </div>

      {/* Category tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setSearchQuery("");
                setDebouncedQuery("");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                activeCategory === cat.id && !debouncedQuery
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "bg-ep-surface text-text-secondary hover:text-text-primary border border-ep-border hover:border-accent/20"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto sm:w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news..."
            className="w-full pl-10 pr-9 py-2 rounded-lg bg-ep-surface border border-ep-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDebouncedQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search indicator */}
      {debouncedQuery && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Showing results for &ldquo;{debouncedQuery}&rdquo;
          <button
            onClick={() => {
              setSearchQuery("");
              setDebouncedQuery("");
            }}
            className="text-accent hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Loading skeleton grid */}
      {loading && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Articles grid */}
      {!loading && articles.length > 0 && (
        <motion.div
          className="grid md:grid-cols-2 xl:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="popLayout">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <motion.div
          className="ep-card p-12 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-4xl mb-3">{debouncedQuery ? "\u{1F50D}" : "\u{1F4F0}"}</div>
          <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
            {debouncedQuery ? "No results found" : "No news available"}
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {debouncedQuery
              ? `No articles found for "${debouncedQuery}". Try a different search term.`
              : "Check back shortly \u2014 news updates every 15 minutes."}
          </p>
        </motion.div>
      )}

      {/* Footer note */}
      {!loading && articles.length > 0 && (
        <p className="text-center text-[10px] text-text-muted pt-2">
          News provided by NewsData.io &middot; Updates every 15 minutes
        </p>
      )}
    </div>
  );
}
