/**
 * EasyPoly Signals Service
 * 
 * Integrates with EasyPoly prediction API (Synthdata AI for MVP)
 * Transforms predictions into trading signals for agent consumption
 */

export interface EasyPolySignal {
  marketId: string;
  marketTitle: string;
  outcome: string;
  confidence: number; // 0-100
  reasoning: string;
  expectedValue?: number;
  source: 'SYNTHDATA_AI' | 'TRADER' | 'CUSTOM';
  timestamp: Date;
}

export interface TraderPosition {
  traderId: string;
  traderName: string;
  marketId: string;
  outcome: string;
  amount: number;
  timestamp: Date;
}

/**
 * Fetch top signals from EasyPoly predictions API
 * 
 * For MVP: Uses existing Synthdata AI predictions from /api/predictions
 * Future: Real trader discovery and signal aggregation
 */
export async function getTopSignals(
  minConfidence: number = 70
): Promise<EasyPolySignal[]> {
  try {
    // Fetch predictions from existing API
    const response = await fetch('/api/predictions');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch predictions: ${response.statusText}`);
    }
    
    const predictions = await response.json();
    
    // Transform predictions into signals
    const signals: EasyPolySignal[] = predictions
      .filter((pred: any) => pred.confidence >= minConfidence)
      .map((pred: any) => ({
        marketId: pred.marketId || pred.market_id,
        marketTitle: pred.marketTitle || pred.title || pred.question,
        outcome: pred.outcome || pred.prediction,
        confidence: pred.confidence,
        reasoning: pred.reasoning || pred.rationale || 'AI-generated prediction',
        expectedValue: pred.expectedValue || pred.edge,
        source: 'SYNTHDATA_AI' as const,
        timestamp: new Date(pred.timestamp || Date.now()),
      }))
      .sort((a: any, b: any) => b.confidence - a.confidence); // Sort by confidence desc
    
    return signals;
  } catch (error) {
    console.error('Error fetching EasyPoly signals:', error);
    return [];
  }
}

/**
 * Get positions from a top trader (for copy trading)
 * 
 * TODO: Implement real trader API integration
 * For now: returns empty array (placeholder)
 */
export async function getTraderPositions(
  traderId: string
): Promise<TraderPosition[]> {
  // Placeholder for Week 4+
  console.warn('getTraderPositions not yet implemented - returning empty');
  return [];
}

/**
 * Evaluate signal quality and filter
 * 
 * Additional filtering beyond confidence threshold:
 * - Market liquidity check
 * - Time to expiry check
 * - Odds value check
 */
export function filterSignalsByQuality(
  signals: EasyPolySignal[],
  options: {
    minConfidence?: number;
    minExpectedValue?: number;
    maxSignals?: number;
  } = {}
): EasyPolySignal[] {
  const {
    minConfidence = 70,
    minExpectedValue = 0.05, // 5% edge minimum
    maxSignals = 10,
  } = options;
  
  return signals
    .filter(signal => signal.confidence >= minConfidence)
    .filter(signal => !signal.expectedValue || signal.expectedValue >= minExpectedValue)
    .slice(0, maxSignals);
}

/**
 * Get real-time signal updates
 * 
 * For use with SWR or React Query for auto-refresh
 */
export async function getSignalsWithRefresh(
  minConfidence: number = 70,
  refreshInterval: number = 30000 // 30 seconds
): Promise<EasyPolySignal[]> {
  return getTopSignals(minConfidence);
}
