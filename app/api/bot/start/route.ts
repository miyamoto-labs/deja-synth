import { NextResponse } from 'next/server';
import { getSupabase } from '@/app/lib/supabase-server';
import { encrypt } from '@/app/lib/crypto';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

const VALID_PLANS = ['quick_shot', 'day_pass', 'marathon', 'arcade'] as const;
const VALID_MARKETS = ['BTC-5m', 'ETH-5m', 'MULTI', 'SYNTH'] as const;

const PLAN_CONFIG: Record<string, { seconds: number; credits: number }> = {
  quick_shot: { seconds: 3600, credits: 5 },
  day_pass: { seconds: 86400, credits: 20 },
  marathon: { seconds: 604800, credits: 50 },
  arcade: { seconds: 86400 * 365, credits: 0 }, // unlimited time, ends on bet exhaustion
};

/**
 * POST /api/bot/start
 * Create a new bot rental session.
 * Generates a fresh wallet, encrypts the private key, stores in Supabase.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletAddress, plan, market, bankroll, betAmount, settings } = body;

    // ── Validate inputs ──
    if (!walletAddress || !plan || !market || bankroll == null) {
      return NextResponse.json(
        { error: 'Missing required fields: walletAddress, plan, market, bankroll' },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
        { status: 400 }
      );
    }

    if (!VALID_MARKETS.includes(market)) {
      return NextResponse.json(
        { error: `Invalid market. Must be one of: ${VALID_MARKETS.join(', ')}` },
        { status: 400 }
      );
    }

    const bankrollNum = Number(bankroll);
    const isArcade = plan === 'arcade';
    const minBankroll = isArcade ? 10 : 25;
    if (isNaN(bankrollNum) || bankrollNum < minBankroll || bankrollNum > 500) {
      return NextResponse.json(
        { error: `Bankroll must be between $${minBankroll} and $500` },
        { status: 400 }
      );
    }

    // ── Validate bet amount (arcade mode) ──
    const VALID_BET_AMOUNTS = [1, 2, 5, 10];
    const betAmountNum = Number(betAmount) || 1;
    if (isArcade && !VALID_BET_AMOUNTS.includes(betAmountNum)) {
      return NextResponse.json(
        { error: 'Bet amount must be $1, $2, $5, or $10' },
        { status: 400 }
      );
    }

    const address = walletAddress.toLowerCase();
    const supabase = getSupabase();

    // ── Check for existing active session ──
    const { data: existing } = await supabase
      .from('ep_bot_sessions')
      .select('id, status')
      .eq('wallet_address', address)
      .in('status', ['pending', 'active', 'paused'])
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'You already have an active bot session. Stop it before starting a new one.' },
        { status: 409 }
      );
    }

    // ── Generate bot wallet (non-arcade gets its own wallet) ──
    const botWallet = isArcade ? null : ethers.Wallet.createRandom();
    const encryptedPrivateKey = isArcade ? null : encrypt(botWallet!.privateKey);

    // ── Plan config ──
    const config = PLAN_CONFIG[plan];
    const now = new Date().toISOString();

    // ── Insert session ──
    const { data: session, error } = await supabase
      .from('ep_bot_sessions')
      .insert({
        wallet_address: address,
        status: 'active',
        plan,
        mode: isArcade ? 'arcade' : 'auto',
        credits_usdc: config.credits,
        bankroll_usdc: bankrollNum,
        market,
        settings: isArcade ? {} : (settings || {}),
        bot_wallet_address: isArcade ? null : botWallet!.address.toLowerCase(),
        bot_private_key_encrypted: encryptedPrivateKey,
        total_seconds: config.seconds,
        used_seconds: 0,
        starting_balance: bankrollNum,
        current_balance: bankrollNum,
        bets_remaining: isArcade ? Math.floor(bankrollNum / betAmountNum) : 0,
        bet_amount: isArcade ? betAmountNum : null,
        started_at: now,
      })
      .select('id, bot_wallet_address, mode, bets_remaining, bet_amount')
      .single();

    if (error) throw error;

    return NextResponse.json({
      sessionId: session.id,
      botWalletAddress: session.bot_wallet_address,
      depositAmount: config.credits + bankrollNum,
      plan,
      market,
      totalSeconds: config.seconds,
      mode: session.mode,
      betsRemaining: session.bets_remaining,
      betAmount: Number(session.bet_amount) || 1,
    });
  } catch (err: any) {
    console.error('Bot start error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to start bot session' },
      { status: 500 }
    );
  }
}
