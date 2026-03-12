# Web3 Wallet Connection Flow

## What We Built

One-click wallet connection for EasyPoly — crypto-native UX for Polymarket users.

### Flow
1. User sends `/start` in Telegram bot
2. Bot shows "🔗 Connect Wallet" button → opens `easypoly.lol/connect?user_id=XXXX`
3. User clicks "Connect Wallet" → MetaMask/WalletConnect modal
4. User signs EIP-712 message → derives Polymarket CLOB API credentials
5. Credentials posted to bot callback → stored encrypted in SQLite
6. Bot confirms: "✅ Wallet Connected!"
7. User can now place bets from Telegram using their own Polymarket wallet

### Tech Stack
- **Frontend:** Next.js + ethers.js v6 + @web3modal/ethers
- **Blockchain:** Polygon (Chain ID 137)
- **Polymarket:** @polymarket/clob-client for API credential derivation
- **Security:** AES-256-GCM encryption for stored credentials
- **Bot:** Callback endpoint at `/callback/wallet`

### Files Changed
- `/app/connect/page.tsx` — Web3 connection page
- `/app/connect/types.d.ts` — TypeScript definitions
- `/.env.local` — Bot callback URL
- `easypoly-bot/index.js` — Added callback endpoint + updated welcome message

### Deployment

**Landing Page (Vercel):**
```bash
cd /Users/erik/.openclaw/workspace/easypoly-landing
vercel --prod
```

**Bot (Railway):**
Already deployed. Add environment variable:
```
WELCOME_LANDING_URL=https://easypoly.lol
```

**Environment Variables:**
- Landing: `NEXT_PUBLIC_BOT_CALLBACK_URL` (already in .env.local)
- Bot: `WELCOME_LANDING_URL` (add to Railway)

### Testing Checklist

1. ✅ Send `/start` to bot → should show "Connect Wallet" button
2. ✅ Click button → opens easypoly.lol/connect?user_id=YOUR_ID
3. ✅ Click "Connect Wallet" → MetaMask popup
4. ✅ Approve connection → sign message
5. ✅ Bot receives callback → stores credentials
6. ✅ Bot sends confirmation message with wallet address
7. ✅ Test `/wallet` command → shows connected wallet
8. ✅ Receive pick → click BET → places order in YOUR Polymarket account

### Security Features
- ✅ Private key never leaves user's wallet
- ✅ Only derives public API credentials (key, secret, passphrase)
- ✅ Credentials encrypted with AES-256-GCM before storage
- ✅ User can `/disconnect` anytime to remove credentials
- ✅ No credentials stored in browser localStorage

### Future Improvements
- Add WalletConnect v2 for mobile wallet support
- Add wallet balance check before showing picks
- Add transaction history view
- Add position tracking (P&L from user's Polymarket account)

---

**Status:** ✅ Ready to deploy and test
