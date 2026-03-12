// ── Markets page shared constants ─────────────────

export const CATEGORIES = [
  { id: "hot", label: "Hot", emoji: "🔥", color: "#F97316" },
  { id: "all", label: "All", emoji: "📊", color: "#8B92A8" },
  { id: "politics", label: "Politics", emoji: "🏛️", color: "#60A5FA" },
  { id: "crypto", label: "Crypto", emoji: "💎", color: "#F97316" },
  { id: "sports", label: "Sports", emoji: "⚽", color: "#34D399" },
  { id: "culture", label: "Culture", emoji: "🎬", color: "#F472B6" },
  { id: "finance", label: "Finance", emoji: "💰", color: "#FBBF24" },
  { id: "weather", label: "Weather", emoji: "🌦️", color: "#38BDF8" },
] as const;

export const SUBCATEGORIES: Record<string, { id: string; label: string }[]> = {
  politics: [
    { id: "elections", label: "Elections" },
    { id: "geopolitics", label: "Geopolitics" },
    { id: "trump", label: "Trump" },
  ],
  crypto: [
    { id: "bitcoin", label: "Bitcoin" },
    { id: "ethereum", label: "Ethereum" },
    { id: "altcoins", label: "Altcoins" },
    { id: "defi_web3", label: "DeFi / Web3" },
    { id: "memecoins", label: "Memecoins" },
    { id: "prices", label: "Prices" },
  ],
  sports: [
    { id: "nba", label: "NBA" },
    { id: "nfl", label: "NFL" },
    { id: "soccer", label: "Soccer" },
    { id: "mlb", label: "MLB" },
    { id: "combat", label: "Combat" },
    { id: "other", label: "Other" },
  ],
  culture: [
    { id: "tech_ai", label: "Tech / AI" },
    { id: "entertainment", label: "Entertainment" },
    { id: "music", label: "Music" },
    { id: "social_media", label: "Social Media" },
  ],
  finance: [
    { id: "fed_rates", label: "Fed / Rates" },
    { id: "stocks", label: "Stocks" },
    { id: "economy", label: "Economy" },
  ],
  weather: [
    { id: "temperature", label: "Temperature" },
    { id: "earthquakes", label: "Earthquakes" },
    { id: "hurricanes", label: "Hurricanes" },
    { id: "climate", label: "Climate" },
  ],
};

export const SORT_OPTIONS = [
  { value: "hot", label: "Hottest" },
  { value: "volume", label: "Volume" },
  { value: "competitive", label: "Competitive" },
  { value: "newest", label: "Newest" },
  { value: "ending_soon", label: "Ending Soon" },
] as const;

// Category color lookup (matches Badges.tsx categoryConfig)
export const CATEGORY_COLORS: Record<string, string> = {
  hot: "#F97316",
  all: "#8B92A8",
  politics: "#60A5FA",
  crypto: "#F97316",
  sports: "#34D399",
  culture: "#F472B6",
  finance: "#FBBF24",
  weather: "#38BDF8",
};
