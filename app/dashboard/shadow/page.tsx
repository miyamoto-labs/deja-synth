"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import StatsGrid from "../components/StatsGrid";
import { useUserStore } from "@/app/lib/stores/user-store";
import { AutoTradeQueue } from "@/app/components/ui/AutoTradeQueue";
import { useToast } from "@/app/components/ui/Toast";
import { useCopytradeBalance } from "@/app/lib/hooks/useCopytradeBalance";
import { usePrivyWallet } from "@/app/lib/contexts/PrivyWalletContext";
import { erc20Abi, parseUnits } from "viem";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatPnl(val: number): string {
  if (!val) return "$0";
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

/* ── Toggle Switch ─────────────────────────────── */
function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2"
      title={label}
    >
      <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${on ? "bg-accent" : "bg-white/10"}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </div>
      {label && <span className="text-xs text-gray-400">{label}</span>}
    </button>
  );
}

/* ── Tier / Style badges ──────────────────────── */
function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    whale: "bg-blue-500/20 text-blue-400",
    mid: "bg-violet-500/20 text-violet-400",
    small: "bg-amber-500/20 text-amber-400",
    micro: "bg-gray-500/20 text-gray-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${colors[tier] || colors.micro}`}>
      {tier}
    </span>
  );
}

function StyleBadge({ style }: { style: string }) {
  const colors: Record<string, string> = {
    degen: "bg-pink-500/20 text-pink-400",
    sniper: "bg-cyan-500/20 text-cyan-400",
    grinder: "bg-emerald-500/20 text-emerald-400",
    whale: "bg-blue-500/20 text-blue-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${colors[style] || "bg-gray-500/20 text-gray-400"}`}>
      {style}
    </span>
  );
}

/* ── Per-trader Settings Panel ─────────────────── */
function CopySettingsPanel({
  follow,
  traderId,
  onSave,
  onRemove,
  saving,
}: {
  follow: any;
  traderId: string;
  onSave: (traderId: string, settings: any) => void;
  onRemove: (traderId: string) => void;
  saving: boolean;
}) {
  const [sizingMode, setSizingMode] = useState<'fixed' | 'percentage'>(follow.sizing_mode || 'fixed');
  const [amt, setAmt] = useState(follow.amount_per_trade || 10);
  const [pctValue, setPctValue] = useState(follow.sizing_value || 10);
  const [maxDaily, setMaxDaily] = useState(follow.max_daily_trades || 5);
  const [copyBuy, setCopyBuy] = useState(follow.copy_buy ?? true);
  const [copySell, setCopySell] = useState(follow.copy_sell ?? false);
  const [totalLimit, setTotalLimit] = useState<string>(follow.total_spend_limit != null ? String(follow.total_spend_limit) : "");
  const [maxTrade, setMaxTrade] = useState<string>(follow.max_per_trade != null ? String(follow.max_per_trade) : "");
  const [minSize, setMinSize] = useState<string>(follow.min_trade_size != null ? String(follow.min_trade_size) : "");
  const [maxMarket, setMaxMarket] = useState<string>(follow.max_per_market != null ? String(follow.max_per_market) : "");
  const [slipBuy, setSlipBuy] = useState(follow.slippage_buy_pct || 10);
  const [slipSell, setSlipSell] = useState(follow.slippage_sell_pct || 10);
  const [stopLoss, setStopLoss] = useState<string>(follow.stop_loss_pct != null ? String(follow.stop_loss_pct) : "");
  const [takeProfit, setTakeProfit] = useState<string>(follow.take_profit_pct != null ? String(follow.take_profit_pct) : "");
  const [slBuffer, setSlBuffer] = useState(follow.sl_buffer_pct ?? 15);

  const handleSave = () => {
    onSave(traderId, {
      amount_per_trade: sizingMode === 'fixed' ? Math.max(1, amt) : 10,
      max_daily_trades: Math.max(1, maxDaily),
      sizing_mode: sizingMode,
      sizing_value: sizingMode === 'percentage' ? pctValue : amt,
      copy_buy: copyBuy,
      copy_sell: copySell,
      total_spend_limit: totalLimit ? parseFloat(totalLimit) : null,
      max_per_trade: maxTrade ? parseFloat(maxTrade) : null,
      min_trade_size: minSize ? parseFloat(minSize) : null,
      max_per_market: maxMarket ? parseFloat(maxMarket) : null,
      slippage_buy_pct: slipBuy,
      slippage_sell_pct: slipSell,
      stop_loss_pct: stopLoss ? parseFloat(stopLoss) : null,
      take_profit_pct: takeProfit ? parseFloat(takeProfit) : null,
      sl_buffer_pct: stopLoss ? slBuffer : null,
    });
  };

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-ep-border bg-ep-bg/50 p-4 text-xs">
      {/* Copy Actions */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Copy Actions</div>
        <div className="flex items-center gap-6">
          <Toggle on={copyBuy} onChange={() => setCopyBuy(!copyBuy)} label="Copy Buy" />
          <Toggle on={copySell} onChange={() => setCopySell(!copySell)} label="Copy Sell" />
        </div>
      </div>

      {/* Trade Sizing */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Trade Sizing</div>

        {/* Sizing Mode Toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setSizingMode('fixed')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
              sizingMode === 'fixed' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
            }`}
          >
            Fixed $
          </button>
          <button
            onClick={() => setSizingMode('percentage')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
              sizingMode === 'percentage' ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
            }`}
          >
            % of Trader
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sizingMode === 'fixed' ? (
            <label className="space-y-1">
              <span className="text-gray-500">Amount/Trade ($)</span>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={1} max={500} value={amt}
                  onChange={(e) => setAmt(Number(e.target.value))}
                  className="flex-1 accent-accent h-1"
                />
                <input
                  type="number" min={1} value={amt}
                  onChange={(e) => setAmt(Number(e.target.value) || 1)}
                  className="w-16 rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
                />
              </div>
              <div className="flex gap-1.5 mt-1">
                {[5, 10, 25, 50, 100].map((v) => (
                  <button key={v} onClick={() => setAmt(v)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${amt === v ? "bg-accent/15 text-accent" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                  >${v}</button>
                ))}
              </div>
            </label>
          ) : (
            <label className="space-y-1">
              <span className="text-gray-500">Copy % of Trader</span>
              <div className="flex items-center gap-1">
                <input
                  type="range" min={1} max={100} value={pctValue}
                  onChange={(e) => setPctValue(Number(e.target.value))}
                  className="flex-1 accent-accent h-1"
                />
                <span className="w-16 font-mono text-text-primary text-right">{pctValue}%</span>
              </div>
              <div className="flex gap-1.5 mt-1">
                {[5, 10, 25, 50].map((v) => (
                  <button key={v} onClick={() => setPctValue(v)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${pctValue === v ? "bg-accent/15 text-accent" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                  >{v}%</button>
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-1">E.g. trader buys $500, you buy ${Math.round(500 * pctValue / 100)}</p>
            </label>
          )}
          <label className="space-y-1">
            <span className="text-gray-500">Max/Trade ($)</span>
            <input
              type="number" min={1} value={maxTrade} placeholder="No Limit"
              onChange={(e) => setMaxTrade(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Min Signal Size ($)</span>
            <input
              type="number" min={0} value={minSize} placeholder="No Filter"
              onChange={(e) => setMinSize(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </label>
        </div>
      </div>

      {/* Risk Limits */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Risk Limits</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-500">Max Daily Trades</span>
            <div className="flex gap-1.5">
              {[3, 5, 10, 25, 50].map((v) => (
                <button key={v} onClick={() => setMaxDaily(v)}
                  className={`rounded px-2 py-1 text-[10px] font-medium transition ${maxDaily === v ? "bg-accent/15 text-accent" : "bg-white/5 text-gray-500 hover:bg-white/10"}`}
                >{v}</button>
              ))}
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Total Spend Limit ($)</span>
            <input
              type="number" min={0} value={totalLimit} placeholder="No Limit"
              onChange={(e) => setTotalLimit(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            {follow.total_spend_limit && (
              <div className="mt-1">
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, ((parseFloat(follow.total_spent) || 0) / follow.total_spend_limit) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-gray-500">
                  ${parseFloat(follow.total_spent || 0).toFixed(0)} / ${follow.total_spend_limit} spent
                </span>
              </div>
            )}
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Max/Market ($)</span>
            <input
              type="number" min={1} value={maxMarket} placeholder="No Limit"
              onChange={(e) => setMaxMarket(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
          </label>
        </div>
      </div>

      {/* Stop Loss / Take Profit */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Stop Loss / Take Profit</div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-red-400">Stop Loss (%)</span>
            <input
              type="number" min={1} max={95} value={stopLoss} placeholder="Disabled"
              onChange={(e) => setStopLoss(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
            />
          </label>
          <label className="space-y-1">
            <span className="text-green-400">Take Profit (%)</span>
            <input
              type="number" min={1} max={500} value={takeProfit} placeholder="Disabled"
              onChange={(e) => setTakeProfit(e.target.value)}
              className="w-full rounded border border-ep-border bg-ep-bg px-2 py-1 font-mono text-text-primary placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500/50"
            />
          </label>
        </div>
        {stopLoss && (
          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-red-400">SL Exit Buffer (%)</span>
              <span className="font-mono text-text-primary">{slBuffer}%</span>
            </div>
            <input type="range" min={5} max={50} step={1} value={slBuffer}
              onChange={(e) => setSlBuffer(Number(e.target.value))}
              className="w-full accent-red-500" />
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>5% tighter</span><span>50% safer fill</span>
            </div>
          </div>
        )}
      </div>

      {/* Slippage */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Slippage (Price Tolerance)</div>
        {(slipBuy < 10 || slipSell < 10) && (
          <div className="mb-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-400">
            ⚠️ Slippage below 10% often causes auto-copy trades to fail. Prediction market prices move fast — we recommend 10%+ for reliable execution.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-gray-500">Buy Tolerance</span>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={20} step={1} value={slipBuy}
                onChange={(e) => setSlipBuy(Number(e.target.value))}
                className="flex-1 accent-accent h-1" />
              <span className={`font-mono w-10 text-right ${slipBuy < 10 ? 'text-yellow-400' : 'text-text-primary'}`}>{slipBuy}%</span>
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-gray-500">Sell Tolerance</span>
            <div className="flex items-center gap-2">
              <input type="range" min={1} max={20} step={1} value={slipSell}
                onChange={(e) => setSlipSell(Number(e.target.value))}
                className="flex-1 accent-accent h-1" />
              <span className={`font-mono w-10 text-right ${slipSell < 10 ? 'text-yellow-400' : 'text-text-primary'}`}>{slipSell}%</span>
            </div>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <button
          onClick={() => onRemove(traderId)}
          className="text-red-400/70 hover:text-red-400 text-xs transition"
        >
          Remove Trader
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-black hover:bg-accent/90 transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Shadow Page ──────────────────────────── */
export default function ShadowPage() {
  const [traders, setTraders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [expandedTrader, setExpandedTrader] = useState<string | null>(searchParams.get("trader"));
  const [savingTrader, setSavingTrader] = useState<string | null>(null);

  const { isConnected, walletAddress, fetchFollows, copytradeWallet } = useUserStore();
  const { toast } = useToast();
  const { formatted: ctBalance, loading: ctBalanceLoading, refetch: refetchCtBalance } = useCopytradeBalance(copytradeWallet);
  const { walletClient } = usePrivyWallet();

  // Fund modal state
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState("");
  const [fundStatus, setFundStatus] = useState<"idle" | "sending" | "confirming" | "success" | "error">("idle");
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);

  const USDC_BRIDGED = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

  const handleFund = useCallback(async () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount <= 0) {
      setFundError("Enter a valid amount");
      return;
    }
    if (!walletClient || !copytradeWallet) {
      setFundError("Wallet not connected");
      return;
    }

    setFundError(null);
    setFundTxHash(null);
    setFundStatus("sending");

    try {
      const hash = await walletClient.writeContract({
        address: USDC_BRIDGED,
        abi: erc20Abi,
        functionName: "transfer",
        args: [copytradeWallet as `0x${string}`, parseUnits(fundAmount, 6)],
        chain: { id: 137, name: "Polygon", nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 }, rpcUrls: { default: { http: ["https://polygon-rpc.com"] } } },
      });

      setFundTxHash(hash);
      setFundStatus("confirming");

      // Poll for confirmation
      const { createPublicClient, http } = await import("viem");
      const { polygon } = await import("viem/chains");
      const pub = createPublicClient({ chain: polygon, transport: http("https://polygon-bor-rpc.publicnode.com") });
      await pub.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60_000 });

      setFundStatus("success");
      toast("success", "Funded!", `$${amount.toFixed(2)} USDC sent to your copy-trade wallet`);
      refetchCtBalance();
      setFundAmount("");
    } catch (err: any) {
      console.error("[FundCopytrade] Error:", err);
      if (err?.message?.includes("User rejected") || err?.message?.includes("denied")) {
        setFundError("Transaction rejected");
      } else {
        setFundError(err?.shortMessage || err?.message || "Transfer failed");
      }
      setFundStatus("error");
    }
  }, [fundAmount, walletClient, copytradeWallet, toast, refetchCtBalance]);

  // Approval setup state
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "pending" | "done" | "error">("idle");

  const handleSetupApprovals = useCallback(async () => {
    if (!walletAddress) return;
    setApprovalStatus("pending");
    try {
      const res = await fetch("/api/wallet/setup-copytrade-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setApprovalStatus("done");
        toast("success", "Activated!", data.message || "Copytrade wallet is ready to trade");
      } else {
        setApprovalStatus("error");
        toast("error", "Failed", data.error || "Could not set up approvals");
      }
    } catch {
      setApprovalStatus("error");
      toast("error", "Error", "Failed to set up trading approvals");
    }
  }, [walletAddress, toast]);

  const loadShadowData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (walletAddress) params.set("walletAddress", walletAddress);
      const url = `/api/dashboard/shadow${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setTraders(data.traders || []);
      setStats(data.stats || {});
    } catch (err) {
      console.error("Failed to load shadow data:", err);
    }
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    loadShadowData();
    const interval = setInterval(loadShadowData, 60000);
    return () => clearInterval(interval);
  }, [loadShadowData]);

  useEffect(() => {
    if (isConnected && walletAddress) fetchFollows();
  }, [isConnected, walletAddress, fetchFollows]);

  /* ── Save settings for a trader ─────────────── */
  const handleSaveSettings = useCallback(async (traderId: string, settings: any) => {
    if (!walletAddress) return;
    setSavingTrader(traderId);
    try {
      const res = await fetch("/api/follows/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, traderId, ...settings }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await fetchFollows();
      loadShadowData();
      toast("success", "Settings Saved", "Copy settings updated.");
    } catch (err: any) {
      toast("error", "Save Failed", err?.message || "Could not save settings.");
    } finally {
      setSavingTrader(null);
    }
  }, [walletAddress, fetchFollows, loadShadowData, toast]);

  /* ── Set trade mode (off / manual / auto) ─────── */
  const handleSetTradeMode = useCallback(async (traderId: string, mode: 'off' | 'manual' | 'auto') => {
    if (!walletAddress) return;
    const payload: Record<string, any> = { walletAddress, traderId };
    if (mode === 'off') {
      payload.active = false;
    } else {
      payload.active = true;
      payload.auto_trade = mode === 'auto';
    }
    try {
      const res = await fetch("/api/follows/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await fetchFollows();
      loadShadowData();
      const labels = { off: ["Off", "Copy trading paused."], manual: ["Manual Mode", "You\u2019ll be notified to review trades."], auto: ["Auto Mode", "Trades execute automatically."] };
      toast("success", labels[mode][0], labels[mode][1]);
    } catch (err: any) {
      toast("error", "Update Failed", err?.message || "Could not update.");
    }
  }, [walletAddress, fetchFollows, loadShadowData, toast]);

  /* ── Remove trader (unfollow) ───────────────── */
  const handleRemoveTrader = useCallback(async (traderId: string) => {
    if (!walletAddress) return;
    try {
      const res = await fetch("/api/follows/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, traderId, action: "deactivate" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      await fetchFollows();
      loadShadowData();
      setExpandedTrader(null);
      toast("success", "Removed", "Trader removed from your copy list.");
    } catch (err: any) {
      toast("error", "Remove Failed", err?.message || "Could not remove trader.");
    }
  }, [walletAddress, fetchFollows, loadShadowData, toast]);

  /* ── Loading state ──────────────────────────── */
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400">
        <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading...
      </div>
    );
  }

  /* ── Stats cards ────────────────────────────── */
  const statsCards = [
    { label: "Traders Copied", value: String(stats?.total_copied || 0), icon: "picks" as const, sub: "In your shadow list" },
    { label: "Active", value: String(stats?.active_count || 0), icon: "winrate" as const, sub: "Auto-trading enabled" },
    { label: "Daily Budget", value: stats?.daily_budget != null ? `$${stats.daily_budget}` : "Variable", icon: "markets" as const, sub: stats?.daily_budget_variable ? "% mode — depends on trader activity" : "Max daily exposure" },
    {
      label: "Total Spent",
      value: `$${(stats?.total_spent || 0).toLocaleString()}`,
      icon: "pnl" as const,
      sub: "Lifetime copy spend",
      trend: "neutral" as const,
    },
  ];

  /* ── Not connected ──────────────────────────── */
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">My Copy Traders</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your copy-trade settings</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-ep-card p-12 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-400 font-medium">Connect your wallet to manage copy traders</p>
          <p className="mt-2 text-sm text-gray-500">Your shadow list is private to your wallet.</p>
        </div>
      </div>
    );
  }

  /* ── Empty state ────────────────────────────── */
  if (traders.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">My Copy Traders</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your copy-trade settings</p>
        </div>
        <StatsGrid stats={statsCards} />
        <div className="rounded-xl border border-white/5 bg-ep-card p-12 text-center">
          <div className="text-4xl mb-4">👻</div>
          <p className="text-gray-400 font-medium">No traders yet</p>
          <p className="mt-2 text-sm text-gray-500">Browse our elite traders and start copy-trading.</p>
          <Link
            href="/dashboard/traders"
            className="mt-4 inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-black hover:bg-accent/90 transition"
          >
            Browse Traders
          </Link>
        </div>
      </div>
    );
  }

  /* ── Main dashboard ─────────────────────────── */
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            My Copy Traders
            <span className="ml-2 rounded-full bg-accent/15 px-2.5 py-0.5 text-sm font-medium text-accent">
              {traders.length}
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-400">Manage your copy-trade settings for each trader</p>
        </div>
        <Link
          href="/dashboard/traders"
          className="rounded-lg border border-ep-border px-4 py-2 text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition"
        >
          + Add Trader
        </Link>
      </div>

      {/* Stats */}
      <StatsGrid stats={statsCards} />

      {/* Copytrade wallet info */}
      {copytradeWallet && (
        <div className="rounded-xl border border-ep-border/50 bg-ep-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1">Copy-Trade Wallet (Polygon)</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-text-primary truncate">{copytradeWallet}</span>
              <span className="text-sm font-semibold text-white whitespace-nowrap">
                {ctBalanceLoading ? "..." : ctBalance ?? "$0.00"}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            {approvalStatus !== "done" && (
              <button
                onClick={handleSetupApprovals}
                disabled={approvalStatus === "pending"}
                className="rounded-lg bg-profit/20 border border-profit/30 px-3 py-1.5 text-xs font-bold text-profit hover:bg-profit/30 transition disabled:opacity-50"
              >
                {approvalStatus === "pending" ? "Activating..." : approvalStatus === "error" ? "Retry Activate" : "Activate Trading"}
              </button>
            )}
            <button
              onClick={() => { setShowFundModal(true); setFundStatus("idle"); setFundError(null); setFundTxHash(null); }}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black hover:bg-accent/90 transition"
            >
              Fund Wallet
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(copytradeWallet);
                toast("success", "Copied", "Wallet address copied to clipboard");
              }}
              className="rounded-lg border border-ep-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-white/5 hover:text-white transition"
            >
              Copy Address
            </button>
            <button
              onClick={async () => {
                if (!walletAddress) return;
                if (!confirm("Your private key gives full access to this wallet's funds. Only export it in a safe, private environment.\n\nContinue?")) return;
                try {
                  const res = await fetch("/api/wallet/export-copytrade-key", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ walletAddress }),
                  });
                  const data = await res.json();
                  if (data.privateKey) {
                    await navigator.clipboard.writeText(data.privateKey);
                    toast("success", "Private Key Copied", "Stored in your clipboard. Keep it safe!");
                  } else {
                    toast("error", "Failed", data.error || "Could not export key");
                  }
                } catch {
                  toast("error", "Error", "Failed to export private key");
                }
              }}
              className="rounded-lg border border-loss/30 px-3 py-1.5 text-xs font-medium text-loss/70 hover:bg-loss/10 hover:text-loss transition"
            >
              Export Key
            </button>
          </div>
        </div>
      )}

      {/* Fund Copytrade Wallet Modal */}
      {showFundModal && copytradeWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => fundStatus !== "sending" && fundStatus !== "confirming" && setShowFundModal(false)}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-ep-border bg-ep-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Fund Copy-Trade Wallet</h3>
              <button onClick={() => fundStatus !== "sending" && fundStatus !== "confirming" && setShowFundModal(false)} className="text-gray-500 hover:text-white transition text-xl leading-none">&times;</button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Transfer USDC.e from your connected wallet to your copy-trade wallet on Polygon.
            </p>

            {/* Preset amounts */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[10, 25, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setFundAmount(String(amt))}
                  className={`rounded-lg border py-2 text-xs font-semibold transition ${
                    fundAmount === String(amt)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-ep-border text-gray-400 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Custom amount input */}
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Custom amount"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                className="w-full rounded-lg border border-ep-border bg-black/30 py-2.5 pl-7 pr-16 text-sm text-white placeholder-gray-600 focus:border-accent focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gray-500">USDC.e</span>
            </div>

            {/* Error */}
            {fundError && (
              <p className="text-xs text-loss mb-3">{fundError}</p>
            )}

            {/* Tx hash */}
            {fundTxHash && (
              <a
                href={`https://polygonscan.com/tx/${fundTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-accent hover:underline mb-3 truncate"
              >
                View on Polygonscan &rarr;
              </a>
            )}

            {/* Action button */}
            {fundStatus === "success" ? (
              <button
                onClick={() => setShowFundModal(false)}
                className="w-full rounded-lg bg-profit/20 py-2.5 text-sm font-bold text-profit"
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleFund}
                disabled={fundStatus === "sending" || fundStatus === "confirming" || !fundAmount}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-black hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fundStatus === "sending" ? "Confirm in wallet..." : fundStatus === "confirming" ? "Confirming..." : "Send USDC"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Two-column layout: Traders (left) + Queue (right) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Trader Cards — left / main */}
        <div id="traders-section" className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold">Your Traders</h2>
          <p className="mt-1 text-xs text-gray-500">Click a trader to configure copy settings</p>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {traders.map((t: any) => {
            const follow = t.follow || {};
            const isExpanded = expandedTrader === t.id;
            const isOff = follow.active === false;
            const isAuto = !isOff && follow.auto_trade === true;
            const isManual = !isOff && !isAuto;
            const roi = t.roi || 0;

            return (
              <div
                key={t.id}
                className={`rounded-xl border bg-ep-card p-4 transition ${
                  isAuto ? "border-accent/20" : isManual ? "border-blue-500/20" : "border-white/5"
                } ${isExpanded ? "ring-1 ring-accent/20" : "hover:border-white/10"}`}
              >
                {/* Card Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      roi > 0 ? "bg-accent/15 text-accent" : "bg-red-500/15 text-red-400"
                    }`}>
                      {(t.alias || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{t.alias || "Unknown"}</span>
                        <TierBadge tier={t.bankroll_tier || "micro"} />
                        <StyleBadge style={t.trading_style || "degen"} />
                      </div>
                      <a
                        href={`https://polymarket.com/profile/${t.wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-gray-500 hover:text-accent transition"
                      >
                        {shortenAddress(t.wallet_address || "")}
                      </a>
                    </div>
                  </div>

                  {/* Off / Manual / Auto mode selector */}
                  <div className="flex shrink-0 rounded-lg overflow-hidden border border-white/10 text-[10px] font-semibold self-end sm:self-auto">
                    <button
                      onClick={() => handleSetTradeMode(t.id, 'off')}
                      className={`px-2.5 py-1.5 transition ${
                        isOff
                          ? "bg-white/10 text-gray-300"
                          : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => handleSetTradeMode(t.id, 'manual')}
                      className={`px-2.5 py-1.5 transition ${
                        isManual
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      onClick={() => handleSetTradeMode(t.id, 'auto')}
                      className={`px-2.5 py-1.5 transition ${
                        isAuto
                          ? "bg-accent/15 text-accent"
                          : "bg-white/5 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      Auto
                    </button>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className={`font-mono text-sm font-bold ${roi > 0 ? "text-accent" : "text-red-400"}`}>
                      {roi > 0 ? "+" : ""}{Number(roi).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-gray-500">ROI</div>
                  </div>
                  <div>
                    <div className={`font-mono text-sm font-bold ${(t.total_pnl || 0) > 0 ? "text-accent" : "text-red-400"}`}>
                      {(t.total_pnl || 0) > 0 ? "+" : ""}{formatPnl(t.total_pnl || 0)}
                    </div>
                    <div className="text-[10px] text-gray-500">PnL</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold text-text-primary">
                      {t.win_rate ? `${(t.win_rate > 1 ? t.win_rate : t.win_rate * 100).toFixed(0)}%` : "--"}
                    </div>
                    <div className="text-[10px] text-gray-500">Win Rate</div>
                  </div>
                  <div>
                    <div className="font-mono text-sm font-bold text-text-primary">{t.trade_count || "--"}</div>
                    <div className="text-[10px] text-gray-500">Trades</div>
                  </div>
                </div>

                {/* Copy status bar */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="text-gray-400">
                    {isOff ? (
                      <><span className="text-gray-600">●</span> Off</>
                    ) : (
                      <>
                        <span className={isAuto ? "text-accent" : "text-blue-400"}>●</span>{" "}
                        {isAuto ? "Auto" : "Manual"} ·{" "}
                        {follow.sizing_mode === 'percentage'
                          ? `${follow.sizing_value || 10}% of trades`
                          : `$${follow.amount_per_trade || 10}/trade`
                        }, {follow.max_daily_trades || 5}/day
                        {follow.copy_buy && !follow.copy_sell && " · Buy only"}
                        {!follow.copy_buy && follow.copy_sell && " · Sell only"}
                        {follow.copy_buy && follow.copy_sell && " · Buy + Sell"}
                        {follow.stop_loss_pct && <span className="text-red-400"> · SL {follow.stop_loss_pct}%</span>}
                        {follow.take_profit_pct && <span className="text-green-400"> · TP {follow.take_profit_pct}%</span>}
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => setExpandedTrader(isExpanded ? null : t.id)}
                    className={`rounded px-2 py-0.5 font-medium transition ${
                      isExpanded ? "bg-accent/15 text-accent" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    {isExpanded ? "Close" : "Settings"}
                  </button>
                </div>

                {/* Spend progress */}
                {follow.total_spend_limit && (
                  <div className="mt-2">
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, ((parseFloat(follow.total_spent) || 0) / follow.total_spend_limit) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500">
                      ${parseFloat(follow.total_spent || 0).toFixed(0)} / ${follow.total_spend_limit} limit
                    </span>
                  </div>
                )}

                {/* Expandable Settings Panel */}
                {isExpanded && (
                  <CopySettingsPanel
                    follow={follow}
                    traderId={t.id}
                    onSave={handleSaveSettings}
                    onRemove={handleRemoveTrader}
                    saving={savingTrader === t.id}
                  />
                )}
              </div>
            );
          })}
          </div>
        </div>

        {/* Auto-Trade Queue — right sidebar */}
        <div className="w-full lg:w-[380px] lg:sticky lg:top-20 shrink-0">
          <AutoTradeQueue />
        </div>
      </div>
    </div>
  );
}
