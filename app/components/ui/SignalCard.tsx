'use client';

import { motion } from 'framer-motion';
import { TierBadge, StyleBadge } from './Badges';
import { ActionButton } from './ActionButton';
import { useTradePanel } from './TradePanel';
import { useUserStore } from '@/app/lib/stores/user-store';

interface CopySignal {
  id: string;
  trader_id: string;
  market_id: string;
  direction: string;
  amount: number;
  price: number;
  timestamp: string;
  trader?: {
    alias: string;
    wallet_address: string;
    roi: number;
    win_rate: number;
    bankroll_tier: string;
    trading_style: string;
  };
  market?: {
    question: string;
    category: string;
  };
}

interface SignalCardProps {
  signal: CopySignal;
  className?: string;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatUsd(val: number) {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// Turn slug-style IDs into readable text
function prettifyMarketId(id: string) {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(And|Or|In|On|At|By|Of|The|To|For|Is|A)\b/g, w => w.toLowerCase())
    .replace(/^\w/, c => c.toUpperCase())
    .slice(0, 80);
}

export function SignalCard({ signal, className = '' }: SignalCardProps) {
  const { openTrade } = useTradePanel();
  const { isFollowing } = useUserStore();
  const isFollowedTrader = isFollowing(signal.trader_id);
  const trader = signal.trader;
  const market = signal.market;
  const isYes = signal.direction?.toUpperCase() === 'YES';
  const side = isYes ? 'YES' : 'NO';

  const handleFollow = () => {
    openTrade({
      type: 'signal',
      signal: {
        id: signal.id,
        trader_id: signal.trader_id,
        market_id: signal.market_id,
        direction: signal.direction,
        amount: signal.amount,
        price: signal.price,
        trader: signal.trader ? {
          alias: signal.trader.alias,
          roi: signal.trader.roi,
          win_rate: signal.trader.win_rate,
          bankroll_tier: signal.trader.bankroll_tier,
          trading_style: signal.trader.trading_style,
        } : undefined,
        market: signal.market ? {
          question: signal.market.question,
        } : undefined,
      },
      side: side as 'YES' | 'NO',
    });
  };

  return (
    <motion.div
      className={`ep-card p-4 ${className}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Trader Info */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: trader?.bankroll_tier === 'whale' ? 'rgba(52, 211, 153, 0.15)' :
              trader?.bankroll_tier === 'mid' ? 'rgba(251, 191, 36, 0.15)' :
              trader?.bankroll_tier === 'small' ? 'rgba(96, 165, 250, 0.15)' :
              'rgba(167, 139, 250, 0.15)',
            color: trader?.bankroll_tier === 'whale' ? '#34D399' :
              trader?.bankroll_tier === 'mid' ? '#FBBF24' :
              trader?.bankroll_tier === 'small' ? '#60A5FA' :
              '#A78BFA',
          }}
        >
          {(trader?.alias || '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">
              {trader?.alias || signal.trader_id?.slice(0, 8)}
            </span>
            {isFollowedTrader && (
              <span className="text-[10px] text-accent" title="Copying">★</span>
            )}
            <TierBadge tier={trader?.bankroll_tier || 'unknown'} />
            {trader?.trading_style?.toLowerCase() !== trader?.bankroll_tier?.toLowerCase() && (
              <StyleBadge style={trader?.trading_style || 'unknown'} />
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-text-muted">
              ROI <span className="font-mono text-profit">{(trader?.roi || 0).toFixed(0)}%</span>
            </span>
            <span className="text-xs text-text-muted">
              WR <span className="font-mono text-text-secondary">{(trader?.win_rate || 0).toFixed(0)}%</span>
            </span>
          </div>
        </div>
        <span className="text-[11px] text-text-muted shrink-0">
          {timeAgo(signal.timestamp)}
        </span>
      </div>

      {/* Signal Action */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded ${
            isYes ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'
          }`}
        >
          {isYes ? '▲ Bought YES' : '▼ Bought NO'}
        </span>
        <span className="font-mono text-sm font-semibold text-text-primary">
          {formatUsd(signal.amount)}
        </span>
        <span className="text-xs text-text-muted">
          @ {(signal.price * 100).toFixed(0)}¢
        </span>
      </div>

      {/* Market */}
      <p className="text-sm text-text-secondary line-clamp-2 mb-3">
        {market?.question || prettifyMarketId(signal.market_id)}
      </p>

      {/* Follow Button */}
      <ActionButton
        variant="accent"
        size="sm"
        fullWidth
        onClick={handleFollow}
      >
        Copy This Trade
      </ActionButton>
    </motion.div>
  );
}
