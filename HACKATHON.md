# Deja. Synth — AI Edge Detection for Polymarket

**Category:** Best Prediction Markets Tool
**Live:** [deja.market/dashboard/bot](https://deja.market/dashboard/bot)
**GitHub:** [miyamoto-labs/deja-synth](https://github.com/miyamoto-labs/deja-synth)
**Team:** Erik Austheim — Founder & Developer, Miyamoto Labs

---

## What It Does

Deja. Synth is a real-time prediction market trading platform that uses Synthdata's Monte Carlo simulations to find tradeable edges on Polymarket crypto markets. When Synth's AI probability diverges from Polymarket's price by 5%+, the platform flags the edge, recommends an optimal bet size using Kelly Criterion, and lets users trade it in one click.

**Assets:** BTC, ETH, SOL | **Timeframes:** 15-minute, Hourly

## How It Uses the Synthdata API

**1. Edge Detection** — The server-side proxy (`/api/synth/markets`) queries Synth's prediction endpoints for all 6 asset/timeframe combinations:

```
GET /insights/polymarket/up-down/hourly?asset=BTC
GET /insights/polymarket/up-down/15min?asset=ETH
Authorization: Apikey {SYNTH_API_KEY}
```

Response fields used: `synth_probability_up`, `polymarket_probability_up`, `synth_outcome`, `slug`, `current_price`, `start_price`, `event_start_time`, `event_end_time`, `best_bid_price`, `best_ask_price`

**2. Signal Classification** — The frontend computes edge strength in real-time:

```
edge = (synth_probability_up - polymarket_probability_up) * 100
```

- |edge| >= 5%: Tradeable signal (highlighted)
- |edge| >= 10%: Strong signal (fire indicator, purple glow)
- Direction: positive = UP underpriced, negative = DOWN underpriced

**3. Kelly Criterion Bet Sizing** — Synth's probability feeds into a half-Kelly formula to recommend optimal position sizes:

```
b = (1 / polymarket_price) - 1     // payout odds
f* = (b × synth_prob - (1 - synth_prob)) / (2 × b)   // half-Kelly fraction
recommended_bet = f* × bankroll     // clamped $1–$100
```

When Synth detects an edge, the platform shows "Kelly suggests $X" — a clickable recommendation that sets the bet amount. This turns Synth's raw probability into an actionable position sizing decision.

**4. One-Click Execution** — Signals feed directly into Polymarket's CLOB. The platform resolves Synth's `slug` to Polymarket token IDs via the Gamma API, then places orders through an embedded Privy wallet (Gnosis Safe on Polygon). No external wallet needed.

**5. Auto-Resolution** — After market end time, the platform polls resolution status and updates P&L in real-time.

## Technical Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS, Framer Motion |
| Real-time prices | Binance WebSocket (BTC/ETH/SOL) with shared singleton connections, rAF-throttled rendering |
| Charts | Custom canvas-based MiniRaceView with live price overlay |
| Synth integration | Server-side proxy with per-market caching (5min TTL), staggered requests (200ms), 8s timeout per call |
| Bet sizing | Half-Kelly Criterion using Synth probability vs Polymarket implied odds |
| Trading | Polymarket CLOB via `@polymarket/clob-client`, relay via `@polymarket/builder-relayer-client` |
| Wallets | Privy embedded wallets with Gnosis Safe (gasless on Polygon) |
| Database | Supabase (Postgres) — trade logging, portfolio, user management |

## What Makes It Different

**Full trading platform, not a dashboard.** Users don't just see Synth's predictions — they trade them instantly on Polymarket with real USDC. The platform handles wallet provisioning, order execution, position tracking, and resolution.

**Two layers of Synth intelligence.** Edge detection tells you *what* to trade. Kelly sizing tells you *how much* to bet. Both are driven by Synth's Monte Carlo probability, giving users a complete decision framework.

**Production infrastructure.** Synth is embedded inside a broader prediction market ecosystem (80+ markets, trader discovery, shadow copy-trading, portfolio management). This shows Synth's API powering real trading decisions at scale, not a proof-of-concept.

**Real-time UX.** Live Binance WebSocket prices, countdown timers, edge strength indicators, expandable order panels with share calculations — designed for traders who want to act on Synth signals immediately.

---

**Erik Austheim** — 3+ years Polymarket trading experience, Norway-based builder
Contact: dostoyevskyai@gmail.com | GitHub: [miyamoto-labs](https://github.com/miyamoto-labs)
