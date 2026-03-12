/**
 * Real Polymarket API Service
 * Uses unbrowse_replay to call captured internal APIs
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TradeParams {
  walletAddress: string;
  marketId: string;
  outcome: 'YES' | 'NO';
  amount: number; // USDC
  orderType: 'market' | 'limit';
  limitPrice?: number;
}

export interface Position {
  id: string;
  marketId: string;
  marketTitle: string;
  outcome: 'YES' | 'NO';
  shares: number;
  entryPrice: number;
  currentPrice: number;
  entryValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface Market {
  id: string;
  slug: string;
  title: string;
  description: string;
  outcomes: string[];
  prices: Record<string, number>;
  volume: number;
  liquidity: number;
  endDate: string;
  resolved: boolean;
}

export interface OrderResult {
  orderId: string;
  status: string;
  filled: boolean;
  shares: number;
  price: number;
  transactionHash?: string;
}

/**
 * Call Polymarket API via unbrowse_replay
 */
async function callPolymarketAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  try {
    // Build unbrowse_replay command
    const bodyArg = body ? `--body '${JSON.stringify(body)}'` : '';
    const cmd = `openclaw unbrowse_replay --service polymarket --endpoint "${method} ${endpoint}" ${bodyArg}`;

    console.log('Calling Polymarket API:', method, endpoint);
    const { stdout } = await execAsync(cmd);

    // Parse response
    const response = JSON.parse(stdout);
    
    if (response.error) {
      throw new Error(response.error);
    }

    return response.data || response;
  } catch (error: any) {
    console.error('Polymarket API error:', error);
    
    // Handle auth refresh on 401/403
    if (error.message.includes('401') || error.message.includes('403')) {
      console.error('Auth expired - need to re-login to Polymarket');
      throw new Error('Polymarket auth expired - please re-login');
    }

    throw error;
  }
}

/**
 * Place a market order on Polymarket
 */
export async function placeMarketOrder(
  params: TradeParams
): Promise<OrderResult> {
  try {
    console.log('Placing order:', params);

    // Call Polymarket order endpoint
    // Endpoint varies based on captured API structure
    const orderData = {
      marketId: params.marketId,
      outcome: params.outcome,
      amount: params.amount,
      type: params.orderType,
      price: params.limitPrice,
    };

    const response = await callPolymarketAPI('/orders', 'POST', orderData);

    return {
      orderId: response.orderId || response.id || `order_${Date.now()}`,
      status: response.status || 'pending',
      filled: response.filled || false,
      shares: response.shares || params.amount / (params.limitPrice || 0.5),
      price: response.price || params.limitPrice || 0.5,
      transactionHash: response.transactionHash || response.txHash,
    };
  } catch (error: any) {
    console.error('Error placing order:', error);
    throw new Error(`Failed to place order: ${error.message}`);
  }
}

/**
 * Get open positions for a wallet
 */
export async function getOpenPositions(
  walletAddress: string
): Promise<Position[]> {
  try {
    console.log('Getting positions for wallet:', walletAddress);

    // Call positions endpoint
    const response = await callPolymarketAPI(`/positions?wallet=${walletAddress}`);

    const positions = response.positions || response.data || [];

    return positions.map((p: any) => ({
      id: p.id || p.positionId,
      marketId: p.marketId || p.market_id,
      marketTitle: p.marketTitle || p.market_title || 'Unknown Market',
      outcome: p.outcome || p.side,
      shares: parseFloat(p.shares || p.amount || '0'),
      entryPrice: parseFloat(p.entryPrice || p.entry_price || '0'),
      currentPrice: parseFloat(p.currentPrice || p.current_price || '0'),
      entryValue: parseFloat(p.entryValue || p.entry_value || '0'),
      currentValue: parseFloat(p.currentValue || p.current_value || '0'),
      pnl: parseFloat(p.pnl || '0'),
      pnlPercent: parseFloat(p.pnlPercent || p.pnl_percent || '0'),
    }));
  } catch (error: any) {
    console.error('Error getting positions:', error);
    throw new Error(`Failed to get positions: ${error.message}`);
  }
}

/**
 * Close a position (sell shares)
 */
export async function closePosition(
  positionId: string,
  shares?: number
): Promise<OrderResult> {
  try {
    console.log('Closing position:', positionId, shares);

    const closeData = {
      positionId,
      shares,
    };

    const response = await callPolymarketAPI('/positions/close', 'POST', closeData);

    return {
      orderId: response.orderId || response.id || `order_${Date.now()}`,
      status: response.status || 'completed',
      filled: response.filled !== false,
      shares: shares || 0,
      price: response.price || 0.5,
      transactionHash: response.transactionHash || response.txHash,
    };
  } catch (error: any) {
    console.error('Error closing position:', error);
    throw new Error(`Failed to close position: ${error.message}`);
  }
}

/**
 * Get market details by slug
 */
export async function getMarket(marketSlug: string): Promise<Market> {
  try {
    console.log('Getting market:', marketSlug);

    const response = await callPolymarketAPI(`/markets/slug/${marketSlug}`);

    const market = response.market || response;

    return {
      id: market.id || market.marketId,
      slug: market.slug || marketSlug,
      title: market.title || market.question,
      description: market.description || '',
      outcomes: market.outcomes || ['YES', 'NO'],
      prices: market.prices || { YES: 0.5, NO: 0.5 },
      volume: parseFloat(market.volume || '0'),
      liquidity: parseFloat(market.liquidity || '0'),
      endDate: market.endDate || market.end_date,
      resolved: market.resolved || false,
    };
  } catch (error: any) {
    console.error('Error getting market:', error);
    throw new Error(`Failed to get market: ${error.message}`);
  }
}

/**
 * Get current market price for an outcome
 */
export async function getMarketPrice(
  marketId: string,
  outcome: 'YES' | 'NO'
): Promise<number> {
  try {
    const response = await callPolymarketAPI(`/prices/${marketId}`);
    
    const prices = response.prices || response;
    return parseFloat(prices[outcome] || '0.5');
  } catch (error: any) {
    console.error('Error getting market price:', error);
    return 0.5; // Default to 50/50
  }
}

/**
 * Check if order is filled
 */
export async function checkOrderStatus(orderId: string): Promise<OrderResult> {
  try {
    console.log('Checking order status:', orderId);

    const response = await callPolymarketAPI(`/orders/${orderId}`);

    const order = response.order || response;

    return {
      orderId: order.id || orderId,
      status: order.status || 'pending',
      filled: order.filled || order.status === 'filled',
      shares: parseFloat(order.shares || '0'),
      price: parseFloat(order.price || '0'),
      transactionHash: order.transactionHash || order.txHash,
    };
  } catch (error: any) {
    console.error('Error checking order status:', error);
    throw new Error(`Failed to check order status: ${error.message}`);
  }
}

/**
 * Helper function to calculate P&L for a position
 */
export function calculatePnL(position: Position): {
  pnl: number;
  pnlPercent: number;
} {
  const pnl = position.currentValue - position.entryValue;
  const pnlPercent = (pnl / position.entryValue) * 100;

  return { pnl, pnlPercent };
}

/**
 * Refresh authentication (re-login)
 */
export async function refreshAuth(): Promise<void> {
  try {
    console.log('Refreshing Polymarket auth...');
    
    // This would trigger a re-login flow
    // For now, we'll just log and throw
    throw new Error('Auth refresh not implemented - please manually re-login to Polymarket');
  } catch (error: any) {
    console.error('Error refreshing auth:', error);
    throw error;
  }
}
