# CLAUDE.md — Instructions for AI agents working on easypoly-landing

## CRITICAL: Git Workflow

### Before doing ANYTHING:
1. Run `git checkout main && git pull origin main`
2. Verify with `git branch` — you MUST see `* main`
3. Check `git log --oneline -5` to confirm you have the latest commits

### Small changes (bug fixes, tweaks, config):
- Work directly on `main`, commit and push

### Big features (new pages, major refactors):
- Create a feature branch FROM latest main: `git checkout -b feature/my-feature main`
- Work on the branch, commit regularly
- When done: merge into main via `git checkout main && git merge feature/my-feature`
- Push main: `git push origin main`
- Do NOT push feature branches to origin unless the user asks for a PR

### NEVER:
- Work on a stale/old branch — ALWAYS branch from latest `main`
- Delete or revert existing features you didn't create
- Remove imports, components, or pages that already exist unless explicitly asked
- Push feature branches to origin (this triggers Vercel preview deploys)
- Assume you're on the right branch — always verify with `git branch`

### If you find yourself on a branch that isn't `main`:
- STOP. Run `git checkout main && git pull origin main` before continuing
- Do NOT make changes on random branches

## Build & Deploy

- **Build:** `npm run build` (Next.js 14)
- **Deploy:** Auto-deploys to Vercel on push to `main`. A post-commit hook triggers the deploy.
- **Production URL:** https://deja.market
- **Dev server:** `npm run dev` (port 3000)
- **Only `main` deploys to production.** Feature branches should NOT be pushed to origin.

## Project Structure

- `app/dashboard/` — Main dashboard pages (markets, picks, traders, shadow, portfolio, etc.)
- `app/dashboard/layout.tsx` — Dashboard layout with top navbar + mobile bottom nav
- `app/api/` — Next.js API routes
- `app/components/ui/` — Shared UI components
- `app/lib/hooks/` — React hooks (useRedeem, usePrivyClobClient, etc.)
- `app/lib/stores/` — Zustand stores

## Key Architecture

- **Polymarket integration**: CLOB trading via `@polymarket/clob-client`, relay transactions via `@polymarket/builder-relayer-client`
- **Wallet**: Privy embedded wallets with Safe (Gnosis) smart wallets on Polygon
- **Two redemption paths**:
  - CTF contract (`0x4D97...6045`): uses `indexSets` — for `negativeRisk: false` markets
  - NegRiskAdapter (`0xd91E...5296`): uses `amounts` (actual token balances) — for `negativeRisk: true` markets
- **RPC**: Uses viem `fallback()` with multiple Polygon RPCs — do NOT rely on env var `NEXT_PUBLIC_POLYGON_RPC_URL`

## Current Mobile Nav (bottom bar)

Markets, Picks, Traders (center pill), Shadow, Portfolio

## Current Desktop Nav (top bar)

Markets, Picks, Traders, Shadow, Synth, News, Portfolio

## Style & Conventions

- Tailwind CSS with custom design tokens (ep-bg, ep-card, ep-border, accent, profit, loss, etc.)
- Framer Motion for animations
- Dark theme only
- Use existing component patterns — check `app/components/ui/` before creating new ones

## What NOT to change without asking

- Navbar items or layout structure
- Landing page CTAs or hero section
- Wallet/auth flow
- Redeem logic (`useRedeem.ts`)
- Trade execution logic
- Existing page routes or components — do not delete files you didn't create
