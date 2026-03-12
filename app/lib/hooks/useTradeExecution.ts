'use client';

import { useCallback, useRef, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { useUserStore } from '@/app/lib/stores/user-store';

/* ── Types ──────────────────────────────────────── */

export interface ExecuteTradeParams {
  tokenId: string;
  side: 'BUY' | 'SELL';
  /** Dollar amount to spend */
  amount: number;
  /** Price per share (0–1) */
  price: number;
  /** YES or NO */
  direction: string;
  /** Attribution: 'pick' | 'signal' | 'manual' */
  source?: string;
  sourceId?: string;
  marketSlug?: string;
}

export interface TradeResult {
  success: boolean;
  orderID?: string;
  message?: string;
  error?: string;
}

/**
 * Hook that handles the full trade execution flow:
 *
 * 1. Gets MetaMask signer (the user's private key stays in the wallet)
 * 2. Fetches stored API creds from our server
 * 3. Creates a ClobClient with signer + creds
 * 4. Signs the order client-side (EIP-712 — prompts MetaMask)
 * 5. Sends the signed order to our server for submission
 *    with builder attribution headers
 */
export function useTradeExecution() {
  const { walletAddress } = useUserStore();
  const [isExecuting, setIsExecuting] = useState(false);

  // Cache creds for the session to avoid repeated fetches
  const credsCache = useRef<{
    key: string;
    secret: string;
    passphrase: string;
  } | null>(null);

  const executeTrade = useCallback(
    async (params: ExecuteTradeParams): Promise<TradeResult> => {
      if (!walletAddress) {
        return { success: false, error: 'Wallet not connected' };
      }

      setIsExecuting(true);

      try {
        // ── 1. Get MetaMask signer ────────────────
        if (!window.ethereum) {
          return { success: false, error: 'No wallet detected. Please install MetaMask.' };
        }

        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const signerAddress = await signer.getAddress();

        // Verify the signer matches the connected wallet
        if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          return {
            success: false,
            error: `Wallet mismatch. Connected: ${walletAddress.slice(0, 8)}..., MetaMask: ${signerAddress.slice(0, 8)}...`,
          };
        }

        // ── 2. Fetch API creds ────────────────────
        if (!credsCache.current) {
          const credsRes = await fetch(`/api/wallet/creds?wallet=${walletAddress}`);
          if (!credsRes.ok) {
            const err = await credsRes.json().catch(() => ({}));
            return {
              success: false,
              error: err.error || 'Failed to fetch credentials. Please reconnect your wallet.',
            };
          }
          credsCache.current = await credsRes.json();
        }

        const creds = credsCache.current!;

        // ── 3. Create ClobClient with signer ──────
        // Shim: Polymarket CLOB client expects ethers v5 _signTypedData,
        // but ethers v6 uses signTypedData (no underscore).
        const signerShim = new Proxy(signer, {
          get(target, prop, receiver) {
            if (prop === '_signTypedData') {
              return target.signTypedData.bind(target);
            }
            return Reflect.get(target, prop, receiver);
          },
        });

        const { ClobClient } = await import('@polymarket/clob-client');

        const clobClient = new ClobClient(
          'https://clob.polymarket.com',
          137,
          signerShim as any,
          {
            key: creds.key,
            secret: creds.secret,
            passphrase: creds.passphrase,
          }
        );

        // ── 4. Sign the order (MetaMask popup) ───
        // Round size UP to avoid sub-$1 dust from floating-point math (CLOB min = $1)
        const effectiveAmount = Math.max(params.amount, 1.01);
        const size = Math.ceil((effectiveAmount / params.price) * 100) / 100;

        const signedOrder = await clobClient.createOrder({
          tokenID: params.tokenId,
          side: params.side as any,
          size,
          price: params.price,
        });

        // ── 5. Submit signed order to our server ──
        const submitRes = await fetch('/api/trade/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signedOrder,
            walletAddress,
            direction: params.direction,
            amount: params.amount,
            price: params.price,
            source: params.source || null,
            sourceId: params.sourceId || null,
            marketSlug: params.marketSlug || null,
          }),
        });

        const result = await submitRes.json();

        if (result.success) {
          return {
            success: true,
            orderID: result.orderID,
            message: result.message || `Order placed: ${params.side} $${params.amount}`,
          };
        } else {
          return {
            success: false,
            error: result.error || 'Order submission failed',
          };
        }
      } catch (err: any) {
        console.error('Trade execution error:', err);

        // Handle common MetaMask errors
        if (err.code === 4001 || err.message?.includes('rejected')) {
          return { success: false, error: 'Transaction rejected in wallet' };
        }
        if (err.message?.includes('Signer is needed')) {
          return { success: false, error: 'Wallet signing required. Please approve in MetaMask.' };
        }

        // Clear cached creds on auth errors
        if (err.message?.includes('401') || err.message?.includes('credential')) {
          credsCache.current = null;
        }

        return {
          success: false,
          error: err.message || 'Something went wrong',
        };
      } finally {
        setIsExecuting(false);
      }
    },
    [walletAddress]
  );

  // Allow cache invalidation (e.g., after wallet reconnect)
  const clearCredsCache = useCallback(() => {
    credsCache.current = null;
  }, []);

  return { executeTrade, isExecuting, clearCredsCache };
}
