import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';
import {
  createPublicClient, createWalletClient, http, fallback,
  erc20Abi, encodeFunctionData, parseEther,
} from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getSupabase } from '@/app/lib/supabase-server';
import { encrypt } from '@/app/lib/crypto';

export const dynamic = 'force-dynamic';

/* ── Polymarket contract addresses (Polygon) ── */
const USDC_TOKEN    = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
const CTF_TOKEN     = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as const;
const EXCHANGE      = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' as const;
const NEG_RISK_EXCH = '0xC5d563A36AE78145C45a50134d48A1215220f80a' as const;
const NEG_RISK_ADPT = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as const;
const MAX_UINT256   = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

const ERC1155_SET_APPROVAL_ABI = [{
  name: 'setApprovalForAll',
  type: 'function',
  inputs: [
    { name: 'operator', type: 'address' },
    { name: 'approved', type: 'bool' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
}] as const;

const POLYGON_RPCS = [
  http('https://polygon-bor-rpc.publicnode.com'),
  http('https://rpc.ankr.com/polygon'),
  http('https://polygon.llamarpc.com'),
];

/**
 * POST /api/wallet/generate-copytrade
 * Generates a dedicated copy-trade wallet for fast server-side execution.
 *
 * Flow:
 * 1. Generate random Ethereum keypair
 * 2. Derive Polymarket CLOB API credentials
 * 3. Fund with gas (MATIC) from funder wallet
 * 4. Submit all 7 Polymarket approval transactions
 * 5. Sync CLOB balance cache
 * 6. Encrypt everything and store in ep_users
 * 7. Link copytrade wallet to user's auth wallet
 *
 * Body: { walletAddress: "0x..." } (the user's auth/login wallet)
 * Returns: { success: true, copytradeWallet: "0x..." }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const authWallet = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Check if user exists
    const { data: authUser } = await supabase
      .from('ep_users')
      .select('id, copytrade_wallet')
      .eq('wallet_address', authWallet)
      .single();

    if (!authUser) {
      return NextResponse.json(
        { error: 'Please connect your wallet first before setting up copy trading.' },
        { status: 404 }
      );
    }

    // Check if already has a copytrade wallet
    if (authUser.copytrade_wallet) {
      return NextResponse.json({
        success: true,
        copytradeWallet: authUser.copytrade_wallet,
        alreadyExists: true,
      });
    }

    // 1. Generate random keypair
    const newWallet = Wallet.createRandom();
    const privateKey = newWallet.privateKey; // 0x-prefixed hex
    const copytradeAddress = newWallet.address.toLowerCase();

    // 2. Derive CLOB API credentials
    const signerShim = new Proxy(newWallet, {
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
    );

    const credentials = await clobClient.createOrDeriveApiKey();
    if (!credentials.key || !credentials.secret || !credentials.passphrase) {
      return NextResponse.json(
        { error: 'Failed to derive CLOB API credentials. Please try again.' },
        { status: 500 }
      );
    }

    // 3. Set up on-chain approvals (requires gas funder)
    const funderKey = process.env.COPYTRADE_GAS_FUNDER_KEY;
    if (funderKey) {
      try {
        const publicClient = createPublicClient({
          chain: polygon,
          transport: fallback(POLYGON_RPCS),
        });

        const funderAccount = privateKeyToAccount(funderKey.trim() as `0x${string}`);
        const funderClient = createWalletClient({
          account: funderAccount,
          chain: polygon,
          transport: fallback(POLYGON_RPCS),
        });

        const ctAccount = privateKeyToAccount(privateKey as `0x${string}`);
        const ctClient = createWalletClient({
          account: ctAccount,
          chain: polygon,
          transport: fallback(POLYGON_RPCS),
        });

        // 3a. Send gas money (0.02 POL ≈ $0.01, enough for ~7 approval txs)
        console.log(`[copytrade-wallet] Sending gas to ${copytradeAddress}...`);
        const gasTxHash = await funderClient.sendTransaction({
          to: copytradeAddress as `0x${string}`,
          value: parseEther('0.05'),
        });
        await publicClient.waitForTransactionReceipt({ hash: gasTxHash, confirmations: 1 });
        console.log(`[copytrade-wallet] Gas funded: ${gasTxHash}`);

        // 3b. Submit all 7 approval transactions in parallel (nonce-based)
        // This avoids Vercel timeout by sending all txs at once instead of sequentially
        const baseNonce = await publicClient.getTransactionCount({ address: ctAccount.address });
        const approvalCalls = [
          // 4 USDC approvals
          ...[CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map((spender, i) => ({
            address: USDC_TOKEN as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve' as const,
            args: [spender as `0x${string}`, MAX_UINT256],
            nonce: baseNonce + i,
          })),
          // 3 CTF approvals
          ...[EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map((operator, i) => ({
            address: CTF_TOKEN as `0x${string}`,
            abi: ERC1155_SET_APPROVAL_ABI,
            functionName: 'setApprovalForAll' as const,
            args: [operator as `0x${string}`, true],
            nonce: baseNonce + 4 + i,
          })),
        ];

        // Fire all 7 transactions without waiting between them
        console.log(`[copytrade-wallet] Submitting 7 approval txs (nonce ${baseNonce}-${baseNonce + 6})...`);
        const hashes = await Promise.all(
          approvalCalls.map((call) => ctClient.writeContract(call as any))
        );

        // Wait only for the last tx to confirm (guarantees all prior ones are mined)
        await publicClient.waitForTransactionReceipt({ hash: hashes[hashes.length - 1], confirmations: 1 });
        console.log(`[copytrade-wallet] All 7 approvals confirmed`);

        // 3c. Sync CLOB balance cache
        try {
          const authedClient = new ClobClient(
            'https://clob.polymarket.com',
            137,
            signerShim as any,
            { key: credentials.key, secret: credentials.secret, passphrase: credentials.passphrase },
          );
          await authedClient.updateBalanceAllowance({ asset_type: 'COLLATERAL' as any });
          await authedClient.updateBalanceAllowance({ asset_type: 'CONDITIONAL' as any });
          console.log('[copytrade-wallet] CLOB balance cache synced');
        } catch (syncErr: any) {
          console.warn('[copytrade-wallet] CLOB cache sync failed (non-fatal):', syncErr?.message);
        }

        console.log(`[copytrade-wallet] All 7 approvals set for ${copytradeAddress}`);
      } catch (approvalErr: any) {
        // Log but don't fail — wallet is still usable, approvals can be retried
        console.error('[copytrade-wallet] Approval setup failed (wallet still created):', approvalErr?.message);
      }
    } else {
      console.warn('[copytrade-wallet] COPYTRADE_GAS_FUNDER_KEY not set — skipping on-chain approvals');
    }

    // 4. Encrypt everything
    const encPrivateKey = encrypt(privateKey);
    const encApiKey = encrypt(credentials.key);
    const encApiSecret = encrypt(credentials.secret);
    const encApiPassphrase = encrypt(credentials.passphrase);

    // 5. Create ep_users row for the copytrade wallet
    const { error: insertErr } = await supabase.from('ep_users').insert({
      wallet_address: copytradeAddress,
      eoa_address: copytradeAddress,
      clob_api_key: encApiKey,
      clob_api_secret: encApiSecret,
      clob_api_passphrase: encApiPassphrase,
      encrypted_private_key: encPrivateKey,
      parent_wallet: authWallet,
      last_connected: new Date().toISOString(),
    });

    if (insertErr) throw insertErr;

    // 6. Link copytrade wallet to the auth user's record
    const { error: updateErr } = await supabase
      .from('ep_users')
      .update({ copytrade_wallet: copytradeAddress })
      .eq('wallet_address', authWallet);

    if (updateErr) throw updateErr;

    console.log(`[copytrade-wallet] Generated ${copytradeAddress} for auth user ${authWallet}`);

    return NextResponse.json({
      success: true,
      copytradeWallet: copytradeAddress,
      alreadyExists: false,
    });
  } catch (err: any) {
    console.error('Generate copytrade wallet error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate copytrade wallet' },
      { status: 500 }
    );
  }
}
