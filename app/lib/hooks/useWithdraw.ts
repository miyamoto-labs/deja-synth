'use client';

import { useState, useCallback } from 'react';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { useTradingSession } from './useTradingSession';
import { useUsdcBalance } from './useUsdcBalance';
import { useOnchainBalance } from './useOnchainBalance';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';
import { isAddress, encodeFunctionData, parseUnits } from 'viem';

/* ── Constants ─────────────────────────────────── */
export const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const; // USDC.e (bridged) on Polygon
export const USDC_NATIVE_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as const; // USDC (native) on Polygon
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';

// Minimal ERC-20 transfer ABI
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export type TokenChoice = 'usdc.e' | 'usdc';

/* ── Hook ──────────────────────────────────────── */
export type WithdrawStatus = 'idle' | 'confirming' | 'sending' | 'polling' | 'success' | 'error';

export function useWithdraw() {
  const { walletClient } = usePrivyWallet();
  const { session } = useTradingSession();
  const { balance: clobBalance, refetch: refetchClobBalance } = useUsdcBalance();
  const { usdc: onchainUsdc, usdce: onchainUsdce, refetch: refetchOnchain } = useOnchainBalance();

  const [status, setStatus] = useState<WithdrawStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useCallback(
    async (toAddress: string, amount: number, token: TokenChoice = 'usdc.e') => {
      setError(null);
      setTxHash(null);

      // Validate inputs
      if (!isAddress(toAddress)) {
        setError('Invalid destination address');
        setStatus('error');
        return false;
      }

      if (amount <= 0) {
        setError('Amount must be greater than 0');
        setStatus('error');
        return false;
      }

      const availableBalance = token === 'usdc.e' ? onchainUsdce : onchainUsdc;
      if (availableBalance !== null && amount > availableBalance) {
        setError(`Insufficient ${token === 'usdc.e' ? 'USDC.e' : 'USDC'} balance. You have $${availableBalance.toFixed(2)}`);
        setStatus('error');
        return false;
      }

      if (!walletClient || !session?.safeAddress) {
        setError('Wallet not connected or trading session not initialized');
        setStatus('error');
        return false;
      }

      try {
        setStatus('sending');

        // Import SDK modules
        const { RelayClient } = await import('@polymarket/builder-relayer-client');

        const builderConfig = new BrowserBuilderConfig();

        const relayClient = new RelayClient(
          RELAYER_URL,
          137,
          walletClient as any,
          builderConfig as any
        );

        // Pick the right token contract
        const tokenAddress = token === 'usdc.e' ? USDC_E_ADDRESS : USDC_NATIVE_ADDRESS;

        // Encode the ERC-20 transfer call
        const usdcAmount = parseUnits(amount.toString(), 6); // Both have 6 decimals
        const calldata = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, usdcAmount],
        });

        // Execute via the Polymarket Relayer (executes as the Safe)
        const txResponse = await relayClient.execute(
          [{ to: tokenAddress, data: calldata, value: '0' }],
        );

        setStatus('polling');

        // Poll for on-chain confirmation (up to ~60s: 20 polls × 3s each)
        const result = await relayClient.pollUntilState(
          txResponse.transactionID,
          ['STATE_MINED', 'STATE_CONFIRMED'],
          'STATE_FAILED',
          20,
          3000
        );

        if (!result) {
          throw new Error('Transaction confirmation timed out — check Polygonscan for status');
        }

        if ((result as any).state === 'STATE_FAILED') {
          throw new Error('Withdrawal transaction failed on-chain');
        }

        setTxHash((result as any).transactionHash || txResponse.transactionID);
        setStatus('success');
        refetchClobBalance();
        refetchOnchain();
        return true;
      } catch (err: any) {
        console.error('[useWithdraw] Error:', err);
        setError(err?.message || 'Withdrawal failed');
        setStatus('error');
        return false;
      }
    },
    [walletClient, session, onchainUsdc, onchainUsdce, refetchClobBalance, refetchOnchain]
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return {
    withdraw,
    reset,
    status,
    txHash,
    error,
    clobBalance,
    onchainUsdc,
    onchainUsdce,
    safeAddress: session?.safeAddress,
  };
}
