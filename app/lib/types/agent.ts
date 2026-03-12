/**
 * TypeScript types for Agent Trading System
 */

export type AgentStatus = 'CREATED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';

export type StrategyType = 'TOP_SIGNALS' | 'COPY_TRADER' | 'CUSTOM';

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

export type TradeOutcome = 'YES' | 'NO';

export type OrderType = 'market' | 'limit';

export type TradeStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED' | 'CANCELLED';

export interface RiskConfig {
  profile: RiskProfile;
  positionSize: number; // % of balance per trade (1-10)
  maxOpenPositions: number; // 1-10
  dailyLossLimit: number; // USD
  stopLossPercent?: number; // Auto-close at -X% loss
  takeProfitPercent?: number; // Auto-close at +X% profit
}

export interface StrategyConfig {
  type: StrategyType;

  // For 'TOP_SIGNALS'
  minConfidence?: number; // 0-100
  maxMarkets?: number;

  // For 'COPY_TRADER'
  traderIds?: string[];

  // For 'CUSTOM'
  customRules?: {
    categories?: string[];
    minLiquidity?: number;
    maxPrice?: number;
    keywords?: string[];
  };
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  status: AgentStatus;
  strategyType: StrategyType;
  strategyConfig: StrategyConfig;
  riskConfig: RiskConfig;
  walletId: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface WalletAddresses {
  solana: string;
  ethereum: string;
  bitcoin: string;
  tron: string;
}

export interface AgentWallet {
  id: string;
  userId: string;
  name: string;
  addresses: WalletAddresses;
  encryptedPrivateKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: string;
  agentId: string;
  marketId: string;
  marketTitle: string;
  outcome: TradeOutcome;
  orderType: OrderType;
  status: TradeStatus;

  // Entry
  entryAmount: number;
  entryPrice: number;
  entryShares: number;
  entryTimestamp: string;

  // Exit
  exitAmount?: number;
  exitPrice?: number;
  exitShares?: number;
  exitTimestamp?: string;

  // P&L
  pnl?: number;
  pnlPercent?: number;

  // Metadata
  signalSource?: string;
  signalConfidence?: number;
  reason?: string;
  error?: string;
}

export interface PerformanceMetrics {
  balance: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalTrades: number;
  openPositions: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

export interface LeaderboardEntry {
  rank: number;
  entityId: string;
  entityName: string;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
}

// Validation helpers
export const RISK_PROFILES: Record<RiskProfile, RiskConfig> = {
  conservative: {
    profile: 'conservative',
    positionSize: 2,
    maxOpenPositions: 2,
    dailyLossLimit: 25,
    stopLossPercent: 15,
    takeProfitPercent: 30,
  },
  moderate: {
    profile: 'moderate',
    positionSize: 5,
    maxOpenPositions: 3,
    dailyLossLimit: 50,
    stopLossPercent: 20,
    takeProfitPercent: 50,
  },
  aggressive: {
    profile: 'aggressive',
    positionSize: 10,
    maxOpenPositions: 5,
    dailyLossLimit: 100,
    stopLossPercent: 30,
    takeProfitPercent: 100,
  },
};

export function validateRiskConfig(config: RiskConfig): string[] {
  const errors: string[] = [];

  if (config.positionSize < 1 || config.positionSize > 10) {
    errors.push('Position size must be between 1% and 10%');
  }

  if (config.maxOpenPositions < 1 || config.maxOpenPositions > 10) {
    errors.push('Max open positions must be between 1 and 10');
  }

  if (config.dailyLossLimit < 10 || config.dailyLossLimit > 200) {
    errors.push('Daily loss limit must be between $10 and $200');
  }

  return errors;
}

export function validateStrategyConfig(config: StrategyConfig): string[] {
  const errors: string[] = [];

  if (config.type === 'TOP_SIGNALS') {
    if (config.minConfidence && (config.minConfidence < 0 || config.minConfidence > 100)) {
      errors.push('Min confidence must be between 0 and 100');
    }
  }

  if (config.type === 'COPY_TRADER') {
    if (!config.traderIds || config.traderIds.length === 0) {
      errors.push('At least one trader ID is required for copy trading');
    }
  }

  return errors;
}
