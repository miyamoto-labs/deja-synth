'use client';

import { useTradePanel } from './TradePanel';
import { ActionButton } from './ActionButton';
import { CATEGORY_COLORS } from '@/app/dashboard/markets/constants';

interface FeaturedMarket {
  market_id: string;
  question: string;
  category: string;
  yes_price: number;
  no_price: number;
  yes_token: string;
  no_token: string;
  volume: number;
  end_date: string;
  hotness: number;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function timeRemaining(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86_400_000);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function FeaturedCard({ market }: { market: FeaturedMarket }) {
  const { openTrade } = useTradePanel();
  const color = CATEGORY_COLORS[market.category] || '#8B92A8';

  const handleBet = (side: 'YES' | 'NO') => {
    openTrade({
      type: 'market',
      side,
      market: {
        market_id: market.market_id,
        question: market.question,
        yes_price: market.yes_price,
        no_price: market.no_price,
        yes_token: market.yes_token || '',
        no_token: market.no_token || '',
      },
    });
  };

  const yesPercent = Math.round(market.yes_price * 100);
  const noPercent = Math.round(market.no_price * 100);

  return (
    <div
      className="ep-card relative overflow-hidden flex-shrink-0 w-[280px] sm:w-[320px] snap-start"
      style={{ minHeight: 180 }}
    >
      {/* Top gradient border */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${color}80, ${color}40, ${color}80)`,
        }}
      />

      {/* Mesh gradient overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          background: `radial-gradient(ellipse at 20% 0%, ${color}, transparent 70%)`,
        }}
      />

      <div className="relative p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color, background: `${color}18` }}
          >
            Featured
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {timeRemaining(market.end_date)}
          </span>
        </div>

        <h3 className="font-display text-sm sm:text-[15px] font-semibold text-text-primary leading-snug line-clamp-2 flex-1">
          {market.question}
        </h3>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-text-muted">YES </span>
            <span className="font-mono font-bold text-profit text-sm">{yesPercent}¢</span>
          </div>
          <div>
            <span className="text-text-muted">NO </span>
            <span className="font-mono font-bold text-loss text-sm">{noPercent}¢</span>
          </div>
          <div className="ml-auto text-text-muted">
            Vol <span className="font-mono text-text-secondary">{formatVolume(market.volume)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <ActionButton variant="yes" size="sm" fullWidth onClick={() => handleBet('YES')}>
            Bet {market.yes_label || 'YES'}
          </ActionButton>
          <ActionButton variant="no" size="sm" fullWidth onClick={() => handleBet('NO')}>
            Bet {market.no_label || 'NO'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export function FeaturedMarketBanner({ markets }: { markets: FeaturedMarket[] }) {
  if (!markets.length) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Trending Now
      </h2>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide -mx-1 px-1">
        {markets.map((m) => (
          <FeaturedCard key={m.market_id} market={m} />
        ))}
      </div>
    </div>
  );
}
