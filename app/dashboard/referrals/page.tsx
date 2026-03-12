"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";
import { WalletConnectButton, PointsTierBadge } from "@/app/components/ui";
import { timeAgo } from "@/app/lib/utils/timeAgo";

/* ── Types ──────────────────────────────────────── */
interface PointsSummary {
  total_points: number;
  tier: string;
  referral_count: number;
  trade_count: number;
}

interface PointsActivity {
  id: string;
  points: number;
  reason: string;
  created_at: string;
}

interface Referral {
  id: string;
  wallet: string;
  status: string;
  joinedAt: string;
}

const REASON_LABEL: Record<string, { label: string; emoji: string }> = {
  signup: { label: "Signed up", emoji: "\u{1F44B}" },
  referral: { label: "Referred a friend", emoji: "\u{1F91D}" },
  trade: { label: "Executed trade", emoji: "\u{1F4B0}" },
  pick_followed: { label: "Copied a pick", emoji: "\u{1F3AF}" },
  daily_login: { label: "Daily login", emoji: "\u{2615}" },
};

/* ── Page ───────────────────────────────────────── */
export default function ReferralsPage() {
  const { walletAddress, isConnected } = useUserStore();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [activity, setActivity] = useState<PointsActivity[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = referralCode
    ? `https://deja.market/?ref=${referralCode}`
    : "";

  const fetchData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [codeRes, summaryRes, statsRes] = await Promise.all([
        fetch(`/api/referrals/code?wallet=${walletAddress}`),
        fetch(`/api/points/summary?wallet=${walletAddress}`),
        fetch(`/api/referrals/stats?wallet=${walletAddress}`),
      ]);

      if (codeRes.ok) {
        const d = await codeRes.json();
        setReferralCode(d.code);
      }
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        setSummary(d.summary);
        setRank(d.rank);
        setActivity(d.activity || []);
      }
      if (statsRes.ok) {
        const d = await statsRes.json();
        setReferrals(d.referrals || []);
      }
    } catch (err) {
      console.error("Referrals fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [fetchData, isConnected, walletAddress]);

  /* ── Clipboard ─────────────────────────── */
  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(
      `I'm using Déjà for AI-powered prediction market picks. Join me and earn points: ${referralLink}`
    );
    window.open(`https://x.com/intent/tweet?text=${text}`, "_blank");
  };

  const shareTelegram = () => {
    const url = encodeURIComponent(referralLink);
    const text = encodeURIComponent("Check out Déjà — AI picks for prediction markets!");
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  /* ── Wallet Gate ─────────────────────────── */
  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="ep-card p-8 sm:p-12 text-center max-w-md space-y-4">
          <div className="text-4xl">{"\u{1F517}"}</div>
          <h2 className="font-display text-xl font-bold">Connect Your Wallet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Connect your wallet to get your unique referral link and
            start earning points.
          </p>
          <WalletConnectButton variant="inline" />
        </div>
      </div>
    );
  }

  /* ── Loading ─────────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-text-muted">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading referrals...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────── */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold">Referrals</h1>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          Invite friends, earn points, and climb the leaderboard
        </p>
      </div>

      {/* ── Referral Link Card ──────────────── */}
      <motion.div
        className="ep-card p-5 sm:p-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
          Your Referral Link
        </h2>

        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg bg-ep-surface border border-ep-border px-4 py-2.5 font-mono text-sm text-accent truncate">
            {referralLink || "Generating..."}
          </div>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-accent text-ep-bg px-4 py-2.5 text-sm font-semibold hover:bg-accent/90 transition flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {copied ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              )}
            </svg>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p className="text-xs text-text-muted mt-2">
          Your code: <span className="font-mono text-text-primary">{referralCode || "..."}</span>
          {" · "}
          <span className="text-accent font-semibold">+250 points</span> per referral
        </p>

        {/* Share buttons */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={shareTwitter}
            className="flex items-center gap-2 rounded-lg bg-ep-surface border border-ep-border px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-ep-border-bright transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
          <button
            onClick={shareTelegram}
            className="flex items-center gap-2 rounded-lg bg-ep-surface border border-ep-border px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-ep-border-bright transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Share on Telegram
          </button>
        </div>
      </motion.div>

      {/* ── Stats Grid ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Points", value: summary?.total_points || 0, accent: true },
          { label: "Rank", value: rank ? `#${rank}` : "—", accent: false },
          { label: "Referrals", value: summary?.referral_count || 0, accent: false },
          { label: "Trades", value: summary?.trade_count || 0, accent: false },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="ep-card p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              {stat.label}
            </span>
            <div className={`mt-1 text-lg sm:text-xl font-mono font-bold ${
              stat.accent ? "text-accent" : "text-text-primary"
            }`}>
              {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
            </div>
            {stat.label === "Total Points" && summary && (
              <div className="mt-1">
                <PointsTierBadge tier={summary.tier} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── Points Activity ─────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Points Activity</h2>
        {activity.length > 0 ? (
          <div className="space-y-2">
            {activity.slice(0, 10).map((item, i) => {
              const cfg = REASON_LABEL[item.reason] || { label: item.reason, emoji: "\u{2B50}" };
              return (
                <motion.div
                  key={item.id}
                  className="ep-card p-3 sm:p-4 flex items-center justify-between"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{cfg.emoji}</span>
                    <div>
                      <p className="text-sm text-text-primary">{cfg.label}</p>
                      <p className="text-[10px] text-text-muted">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold text-accent">
                    +{item.points}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="ep-card p-8 text-center">
            <div className="text-2xl mb-2">{"\u{2B50}"}</div>
            <p className="text-text-secondary text-sm">No points earned yet</p>
            <p className="text-text-muted text-xs mt-1">
              Start trading and referring friends to earn points
            </p>
          </div>
        )}
      </div>

      {/* ── Referred Users ──────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Referred Users</h2>
        {referrals.length > 0 ? (
          <div className="space-y-2">
            {referrals.map((ref, i) => (
              <motion.div
                key={ref.id}
                className="ep-card p-3 sm:p-4 flex items-center justify-between"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                    {ref.wallet.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-mono text-text-primary">{ref.wallet}</p>
                    <p className="text-[10px] text-text-muted">{timeAgo(ref.joinedAt)}</p>
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    color: ref.status === "active" ? "#00F0A0" : "#60A5FA",
                    background: ref.status === "active" ? "rgba(0,240,160,0.12)" : "rgba(96,165,250,0.12)",
                    border: `1px solid ${ref.status === "active" ? "#00F0A020" : "#60A5FA20"}`,
                  }}
                >
                  {ref.status.toUpperCase()}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="ep-card p-8 text-center">
            <div className="text-2xl mb-2">{"\u{1F465}"}</div>
            <p className="text-text-secondary text-sm">No referrals yet</p>
            <p className="text-text-muted text-xs mt-1">
              Share your referral link to start growing your network
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
