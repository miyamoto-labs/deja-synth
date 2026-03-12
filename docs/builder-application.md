# EasyPoly — Polymarket Builder Program Application

## Who We Are

EasyPoly is an AI-powered Polymarket trading platform and the world's first prediction market arcade game. Built by a solo developer, launched February 2026.

**Live at:** easypoly.com
**Dashboard:** easypoly.com/dashboard
**Arcade:** easypoly.com/dashboard/bot
**Telegram Bot:** @EasyPolyBot

---

## What We Built

### 1. AI Picks Engine
- Scans 500+ active Polymarket markets every 10 minutes
- Proprietary conviction scoring system (0-100) combining edge detection, volume analysis, liquidity depth, and price momentum
- Generates actionable picks with entry price, target, stop-loss, risk/reward ratio, and time horizon
- Plain-English AI explanations for every pick ("Buy YES at 42c, target 65c — edge detected because...")
- Telegram alerts for high-conviction picks pushed to our community

### 2. Click-to-Bet BTC Arcade (World's First Prediction Market Game)
- One-click $1 bets on BTC 5-minute and 15-minute price windows
- Real Polymarket CLOB orders — every bet is a real trade on Polymarket's order book
- Live BTC price chart with comet animation tracking real Binance data
- Interactive Snake game overlay: collectibles and obstacles spawn at price levels on the chart while users wait for resolution
- Weekly jackpot pool funded by spread fees
- Leaderboard with ROI/win-rate rankings

### 3. Social Copy Trading
- Follow tracked whale wallets
- Auto-execution: automatically mirror trader signals with configurable position sizing
- Daily trade limits and signal deduplication

### 4. Full Trading Dashboard
- Portfolio tracking with P&L analytics
- Performance history and win rate calculations
- Quick-buy buttons ($5/$25/$50) directly from pick cards
- Conviction gauge visualization (animated circular progress with color coding)

### 5. Points & Gamification System
- XP earned from trades, referrals, daily logins, arcade play
- Tiered rewards: Bronze → Silver → Gold → Diamond
- Leaderboard driving competition and retention

---

## Builder Code Integration (Already Live)

We've already integrated the `@polymarket/builder-signing-sdk` across **all three order submission paths** in our application. Every trade placed through EasyPoly carries builder attribution:

**Path 1 — Arcade Click-to-Bet** (`/api/bot/click-bet`)
Uses `BuilderConfig` with `ClobClient` for $1 arcade bets on BTC/ETH time-window markets.

**Path 2 — Server-Side Trade Execution** (`/api/trade/execute`)
Uses `BuilderConfig` with `ClobClient` for AI pick execution and auto-trade follows. Handles user's encrypted CLOB credentials server-side.

**Path 3 — Client-Signed Order Submission** (`/api/trade/submit`)
HMAC-based builder attribution headers for MetaMask-signed orders. User signs via EIP-712, we attach builder headers on submission.

All three routes are production-ready and processing real orders. We can provide transaction hashes demonstrating builder attribution on live trades.

---

## Why EasyPoly Drives Unique Volume

### Gamification Brings New Users to Polymarket
The arcade game is designed for users who would never visit Polymarket.com directly. Crypto-curious gamers and casual users engage with $1 BTC predictions as entertainment — every play is a real CLOB order generating volume.

### AI Lowers the Barrier to Entry
Most Polymarket users struggle to find edges across 500+ markets. Our conviction engine does the research, presents actionable picks in plain English, and offers one-click execution. This converts passive observers into active traders.

### Auto-Execution Multiplies Volume Per User
Our upcoming Standing Orders feature lets Pro users set rules like "auto-bet $25 on any pick with conviction >= 85." This creates recurring, automated volume from a single user setup — compounding builder revenue over time.

### Retention Through Game Mechanics
Points, XP, leaderboards, jackpot pools, and the Snake game keep users coming back. Higher retention = more trades = more builder revenue.

---

## Growth Roadmap

### Shipping Now
- **Standing Orders** — "Set and forget" auto-execution on AI picks matching conviction thresholds. Pro-only feature driving recurring volume.
- **Public Portfolio** — EasyPoly bets its own highest-conviction picks publicly. "Skin in the game" trust signal driving new user acquisition.

### Coming Next
- **Cross-Market Arb Scanner** — Scan Polymarket vs Metaculus vs Kalshi vs Manifold for price divergences. Surfaces unique opportunities that drive informed trading volume.
- **Mobile-First Arcade** — PWA optimized for mobile betting, expanding our reach to mobile-native users.

---

## Technical Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, Framer Motion, Zustand
- **Backend:** Next.js API routes, Supabase (PostgreSQL), Railway (Python engine)
- **Polymarket:** `@polymarket/clob-client` v5.2.1, `@polymarket/builder-signing-sdk` v5.2.1
- **Data:** Binance WebSocket (live BTC/ETH), Gamma API (market resolution), custom conviction engine (Python)
- **Security:** AES-256-GCM encrypted CLOB credentials, server-side order execution, wallet-gated sessions

---

## Summary

EasyPoly is the only Polymarket interface that combines AI-powered market scanning, real-money arcade gaming, and social copy trading — all with builder attribution on every order. We're driving volume from user segments that traditional Polymarket frontends don't reach: casual gamers, AI-assisted beginners, and set-and-forget auto-traders.

We're already live, already placing attributed orders, and building features that compound volume growth. Partnering through the Builder Program would align our incentives to drive even more volume to Polymarket's CLOB.

---

*Application by Erik — solo builder of EasyPoly*
*Contact: [your email]*
*GitHub: [your repo]*
