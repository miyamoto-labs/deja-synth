import { NextResponse } from 'next/server';
import {
  createPublicClient, createWalletClient, http, fallback,
  erc20Abi, parseEther,
} from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getSupabase } from '@/app/lib/supabase-server';
import { decrypt } from '@/app/lib/crypto';

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
 * POST /api/wallet/setup-copytrade-approvals
 * Sets up Polymarket on-chain approvals for an existing copytrade wallet.
 * Uses the stored encrypted private key + gas funder.
 *
 * Body: { walletAddress: "0x..." } (the user's auth wallet)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const funderKey = process.env.COPYTRADE_GAS_FUNDER_KEY;
    if (!funderKey) {
      return NextResponse.json({ error: 'Gas funder not configured' }, { status: 500 });
    }

    const authWallet = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // Look up copytrade wallet
    const { data: authUser } = await supabase
      .from('ep_users')
      .select('copytrade_wallet')
      .eq('wallet_address', authWallet)
      .single();

    if (!authUser?.copytrade_wallet) {
      return NextResponse.json({ error: 'No copytrade wallet found' }, { status: 404 });
    }

    // Get encrypted private key
    const { data: ctWallet } = await supabase
      .from('ep_users')
      .select('encrypted_private_key, clob_api_key, clob_api_secret, clob_api_passphrase')
      .eq('wallet_address', authUser.copytrade_wallet)
      .single();

    if (!ctWallet?.encrypted_private_key) {
      return NextResponse.json({ error: 'Private key not found' }, { status: 404 });
    }

    const privateKey = decrypt(ctWallet.encrypted_private_key).trim();

    const publicClient = createPublicClient({
      chain: polygon,
      transport: fallback(POLYGON_RPCS),
    });

    // Check if approvals already set
    const ctAddr = authUser.copytrade_wallet as `0x${string}`;
    const existingAllowance = await publicClient.readContract({
      address: USDC_TOKEN,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [ctAddr, EXCHANGE],
    });

    if (existingAllowance > 0n) {
      return NextResponse.json({ success: true, message: 'Approvals already set' });
    }

    // Fund with gas
    const trimmedFunderKey = funderKey.trim();
    const funderAccount = privateKeyToAccount(trimmedFunderKey as `0x${string}`);
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

    console.log(`[copytrade-approvals] Sending gas to ${authUser.copytrade_wallet}...`);
    const gasTxHash = await funderClient.sendTransaction({
      to: ctAddr,
      value: parseEther('0.05'),
    });
    await publicClient.waitForTransactionReceipt({ hash: gasTxHash, confirmations: 1 });

    // Submit all 7 approval transactions in parallel (nonce-based)
    const baseNonce = await publicClient.getTransactionCount({ address: ctAccount.address });
    const approvalCalls = [
      ...[CTF_TOKEN, EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map((spender, i) => ({
        address: USDC_TOKEN as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve' as const,
        args: [spender as `0x${string}`, MAX_UINT256],
        nonce: baseNonce + i,
      })),
      ...[EXCHANGE, NEG_RISK_EXCH, NEG_RISK_ADPT].map((operator, i) => ({
        address: CTF_TOKEN as `0x${string}`,
        abi: ERC1155_SET_APPROVAL_ABI,
        functionName: 'setApprovalForAll' as const,
        args: [operator as `0x${string}`, true],
        nonce: baseNonce + 4 + i,
      })),
    ];

    console.log(`[copytrade-approvals] Submitting 7 txs (nonce ${baseNonce}-${baseNonce + 6})...`);
    const hashes = await Promise.all(
      approvalCalls.map((call) => ctClient.writeContract(call as any))
    );
    await publicClient.waitForTransactionReceipt({ hash: hashes[hashes.length - 1], confirmations: 1 });
    console.log(`[copytrade-approvals] All 7 approvals confirmed`);

    // Sync CLOB cache
    if (ctWallet.clob_api_key) {
      try {
        const { ClobClient } = await import('@polymarket/clob-client');
        const signerShim = {
          getAddress: async () => authUser.copytrade_wallet,
          _signTypedData: async () => '0x', // dummy — not needed for updateBalanceAllowance
        };
        const authedClient = new ClobClient(
          'https://clob.polymarket.com',
          137,
          signerShim as any,
          {
            key: decrypt(ctWallet.clob_api_key),
            secret: decrypt(ctWallet.clob_api_secret),
            passphrase: decrypt(ctWallet.clob_api_passphrase),
          },
        );
        await authedClient.updateBalanceAllowance({ asset_type: 'COLLATERAL' as any });
        await authedClient.updateBalanceAllowance({ asset_type: 'CONDITIONAL' as any });
        console.log('[copytrade-approvals] CLOB cache synced');
      } catch (syncErr: any) {
        console.warn('[copytrade-approvals] CLOB cache sync failed (non-fatal):', syncErr?.message);
      }
    }

    console.log(`[copytrade-approvals] All approvals set for ${authUser.copytrade_wallet}`);
    return NextResponse.json({ success: true, message: 'All 7 approvals set' });
  } catch (err: any) {
    console.error('Setup copytrade approvals error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to set up approvals' },
      { status: 500 }
    );
  }
}
