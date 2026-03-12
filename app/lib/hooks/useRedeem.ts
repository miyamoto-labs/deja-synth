'use client';

import { useState, useCallback } from 'react';
import { usePrivyWallet } from '@/app/lib/contexts/PrivyWalletContext';
import { useTradingSession } from './useTradingSession';
import { useUsdcBalance } from './useUsdcBalance';
import { BrowserBuilderConfig } from '@/app/lib/browser-builder-config';
import { encodeFunctionData, createPublicClient, http, fallback } from 'viem';
import { polygon } from 'viem/chains';

/* ── Constants ─────────────────────────────────── */
const RELAYER_URL = 'https://relayer-v2.polymarket.com/';

// Polymarket contract addresses (Polygon mainnet)
const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const;
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const;
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;

const PARENT_COLLECTION_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

// Binary market: YES=index 0 (indexSet=1), NO=index 1 (indexSet=2)
const INDEX_SETS = [BigInt(1), BigInt(2)];

/* ── ABI fragments ─────────────────────────────── */

const CTF_REDEEM_ABI = [{
  name: 'redeemPositions',
  type: 'function',
  inputs: [
    { name: 'collateralToken', type: 'address' },
    { name: 'parentCollectionId', type: 'bytes32' },
    { name: 'conditionId', type: 'bytes32' },
    { name: 'indexSets', type: 'uint256[]' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const;

// NegRiskAdapter takes AMOUNTS (actual token counts), NOT indexSets.
// amounts[0] = number of YES tokens, amounts[1] = number of NO tokens.
const NEG_RISK_REDEEM_ABI = [{
  name: 'redeemPositions',
  type: 'function',
  inputs: [
    { name: 'conditionId', type: 'bytes32' },
    { name: 'amounts', type: 'uint256[]' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const;

const PAYOUT_DENOMINATOR_ABI = [{
  name: 'payoutDenominator',
  type: 'function',
  inputs: [{ name: 'conditionId', type: 'bytes32' }],
  outputs: [{ type: 'uint256' }],
  stateMutability: 'view',
}] as const;

const BALANCE_OF_ABI = [{
  name: 'balanceOf',
  type: 'function',
  inputs: [
    { name: 'account', type: 'address' },
    { name: 'id', type: 'uint256' },
  ],
  outputs: [{ type: 'uint256' }],
  stateMutability: 'view',
}] as const;

/* ── On-chain public client with RPC fallback ──── */
// Uses multiple RPCs so a single broken endpoint doesn't kill everything.
// viem's fallback() automatically tries the next RPC if one fails.
const onchainClient = createPublicClient({
  chain: polygon,
  transport: fallback([
    http('https://polygon-bor-rpc.publicnode.com'),
    http('https://polygon.llamarpc.com'),
    http('https://polygon-rpc.com'),
  ]),
});

/* ── Helpers ───────────────────────────────────── */

function buildCtfCalldata(conditionId: `0x${string}`) {
  return {
    calldata: encodeFunctionData({
      abi: CTF_REDEEM_ABI,
      functionName: 'redeemPositions',
      args: [USDC_ADDRESS, PARENT_COLLECTION_ID, conditionId, INDEX_SETS],
    }),
    target: CTF_ADDRESS,
    label: 'CTF',
  };
}

function buildNegRiskCalldata(conditionId: `0x${string}`, amounts: [bigint, bigint]) {
  return {
    calldata: encodeFunctionData({
      abi: NEG_RISK_REDEEM_ABI,
      functionName: 'redeemPositions',
      args: [conditionId, amounts],
    }),
    target: NEG_RISK_ADAPTER,
    label: 'NegRiskAdapter',
  };
}

/** Submit a redemption tx and wait for on-chain result. */
async function submitAndWait(
  relayClient: any,
  target: string,
  calldata: `0x${string}`,
  label: string,
): Promise<{ hash: string } | { failed: true; hash?: string }> {
  console.log(`[useRedeem] Submitting via ${label} → ${target.slice(0, 10)}...`);

  const txResponse = await relayClient.execute(
    [{ to: target, data: calldata, value: '0' }],
  );

  const txId = txResponse.transactionID;
  console.log(`[useRedeem] ${label} tx submitted:`, txId);

  // SDK .wait() polls up to 100× at 2s = ~3.3 min. Returns undefined on STATE_FAILED.
  const finalTx = await txResponse.wait();

  if (finalTx) {
    const hash = finalTx.transactionHash || txId;
    console.log(`[useRedeem] ✅ ${label} redemption confirmed:`, hash);
    return { hash };
  }

  // Transaction failed — get details
  try {
    const check = await relayClient.getTransaction(txId);
    const txn = Array.isArray(check) ? check[0] : check;
    console.warn(`[useRedeem] ${label} tx failed:`, txn?.state, txn?.transactionHash);
    return { failed: true, hash: txn?.transactionHash };
  } catch {
    return { failed: true };
  }
}

/* ── Hook ──────────────────────────────────────── */
export type RedeemStatus = 'idle' | 'redeeming' | 'polling' | 'success' | 'error';

export function useRedeem() {
  const { walletClient } = usePrivyWallet();
  const { session } = useTradingSession();
  const { refetch: refetchBalance } = useUsdcBalance();

  const [status, setStatus] = useState<RedeemStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redeem = useCallback(
    async (conditionId: string, negRisk: boolean = false, assetId?: string, outcomeIndex?: number) => {
      setError(null);
      setTxHash(null);

      if (!walletClient || !session?.safeAddress) {
        setError('Wallet not connected or trading session not initialized');
        setStatus('error');
        return false;
      }

      if (!conditionId) {
        setError('Missing condition ID for redemption');
        setStatus('error');
        return false;
      }

      try {
        setStatus('redeeming');
        const conditionHex = conditionId as `0x${string}`;
        const safeAddr = session.safeAddress as `0x${string}`;

        // ── Verify wallet chain ──────────────────────────────────
        if (walletClient.chain?.id !== 137) {
          throw new Error('Wallet is on the wrong network. Please switch to Polygon and try again.');
        }

        // ── Check on-chain resolution ────────────────────────────
        try {
          const denom = await onchainClient.readContract({
            address: CTF_ADDRESS,
            abi: PAYOUT_DENOMINATOR_ABI,
            functionName: 'payoutDenominator',
            args: [conditionHex],
          });
          if (BigInt(denom) === 0n) {
            throw new Error(
              'This market is not resolved on-chain yet. ' +
              'The oracle has not finalized the result. ' +
              'Try again in a few hours.',
            );
          }
        } catch (rpcErr: any) {
          if (rpcErr.message?.includes('not resolved')) throw rpcErr;
          console.warn('[useRedeem] RPC check skipped:', rpcErr.message);
        }

        // ── Check token balance on-chain ─────────────────────────
        // For NegRisk: balance is REQUIRED (we need actual amounts).
        // For CTF: balance is optional (CTF uses indexSets, not amounts).
        let tokenBalance = 0n;
        if (assetId) {
          try {
            tokenBalance = await onchainClient.readContract({
              address: CTF_ADDRESS,
              abi: BALANCE_OF_ABI,
              functionName: 'balanceOf',
              args: [safeAddr, BigInt(assetId)],
            }) as bigint;
            console.log(`[useRedeem] CTF balanceOf(${safeAddr.slice(0, 8)}..., ${assetId.slice(0, 12)}...) = ${tokenBalance}`);
            if (tokenBalance === 0n) {
              throw new Error(
                'No tokens found in your wallet for this position. ' +
                'It may have already been redeemed.',
              );
            }
          } catch (balErr: any) {
            if (balErr.message?.includes('No tokens found')) throw balErr;
            // For NegRisk, we CANNOT proceed without the balance — hard fail
            if (negRisk) {
              throw new Error(
                'Unable to read your token balance from the blockchain. ' +
                'This is required for NegRisk redemptions. ' +
                'Please try again in a moment. ' +
                `(RPC error: ${balErr.message})`,
              );
            }
            // For CTF, balance check is informational — we can proceed
            console.warn('[useRedeem] Balance check skipped (CTF):', balErr.message);
          }
        } else {
          // No assetId provided
          if (negRisk) {
            throw new Error(
              'Missing asset ID — cannot redeem NegRisk position without knowing the token ID.',
            );
          }
          console.warn('[useRedeem] No assetId provided — skipping balance check (CTF)');
        }

        // ── Check Safe deployment ────────────────────────────────
        try {
          const resp = await fetch(`${RELAYER_URL}deployed?address=${safeAddr}`);
          const data = await resp.json();
          if (!data.deployed) {
            throw new Error('Your trading wallet is not set up yet. Make a deposit first.');
          }
        } catch (err: any) {
          if (err.message?.includes('not set up')) throw err;
          console.warn('[useRedeem] Safe check skipped:', err.message);
        }

        // ── Create RelayClient ───────────────────────────────────
        const { RelayClient } = await import('@polymarket/builder-relayer-client');
        const relayClient = new RelayClient(
          RELAYER_URL,
          137,
          walletClient as any,
          new BrowserBuilderConfig() as any,
        );

        // ── Build calldata ───────────────────────────────────────
        let tx: { calldata: `0x${string}`; target: string; label: string };

        if (negRisk) {
          // NegRiskAdapter takes AMOUNTS: [yesTokenCount, noTokenCount]
          // We need to place the user's token balance at the correct index.
          const idx = outcomeIndex ?? 0;
          const amounts: [bigint, bigint] = idx === 0
            ? [tokenBalance, 0n]
            : [0n, tokenBalance];
          console.log(`[useRedeem] NegRisk amounts: [${amounts[0]}, ${amounts[1]}] (outcomeIndex=${idx}, balance=${tokenBalance})`);

          // Final safety check — never submit [0, 0]
          if (amounts[0] === 0n && amounts[1] === 0n) {
            throw new Error(
              'Token balance is zero — cannot redeem. ' +
              'This position may have already been redeemed.',
            );
          }

          tx = buildNegRiskCalldata(conditionHex, amounts);
        } else {
          // CTF uses indexSets (bitmask): [1, 2] for YES/NO binary markets
          tx = buildCtfCalldata(conditionHex);
        }

        console.log(`[useRedeem] Submitting: ${tx.label} (negRisk=${negRisk})`);
        setStatus('polling');

        const result = await submitAndWait(relayClient, tx.target, tx.calldata, tx.label);

        if ('failed' in result) {
          throw new Error(
            'Redemption transaction failed on-chain. ' +
            'The market may not be fully resolved yet, ' +
            'or the position was already redeemed. Try again later.',
          );
        }

        setTxHash(result.hash);
        setStatus('success');

        // Refresh USDC balance
        refetchBalance();
        setTimeout(() => refetchBalance(), 3000);
        setTimeout(() => refetchBalance(), 8000);

        return true;
      } catch (err: any) {
        console.error('[useRedeem] ❌ Error:', err?.message);
        setError(err?.message || 'Redemption failed');
        setStatus('error');
        return false;
      }
    },
    [walletClient, session, refetchBalance],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
  }, []);

  return {
    redeem,
    reset,
    status,
    txHash,
    error,
    isReady: !!walletClient && !!session?.safeAddress,
    safeAddress: session?.safeAddress,
  };
}
