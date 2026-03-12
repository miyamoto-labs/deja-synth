"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface StandingOrder {
  id: string;
  min_conviction: number;
  max_conviction: number;
  direction_filter: string | null;
  category_filter: string[] | null;
  amount: number;
  daily_limit: number;
  total_limit: number | null;
  label: string | null;
}

interface StandingOrderFormProps {
  order: StandingOrder | null; // null = create mode
  onSubmit: (data: any) => void;
  onClose: () => void;
}

const AMOUNT_PRESETS = [5, 10, 25, 50];
const DAILY_LIMIT_PRESETS = [3, 5, 10, 20];
const CATEGORIES = ["Crypto", "Politics", "Sports", "Science", "Entertainment", "Business"];

export default function StandingOrderForm({ order, onSubmit, onClose }: StandingOrderFormProps) {
  const isEdit = !!order;

  const [label, setLabel] = useState(order?.label || "");
  const [minConviction, setMinConviction] = useState(order?.min_conviction || 80);
  const [maxConviction] = useState(order?.max_conviction || 100);
  const [directionFilter, setDirectionFilter] = useState<string | null>(order?.direction_filter || null);
  const [amount, setAmount] = useState(order?.amount || 10);
  const [customAmount, setCustomAmount] = useState("");
  const [dailyLimit, setDailyLimit] = useState(order?.daily_limit || 5);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(order?.category_filter || []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const finalAmount = customAmount ? parseFloat(customAmount) : amount;
      await onSubmit({
        label: label || null,
        minConviction,
        maxConviction,
        directionFilter,
        categoryFilter: selectedCategories.length > 0 ? selectedCategories : null,
        amount: finalAmount,
        dailyLimit,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg bg-ep-bg border border-ep-border rounded-2xl overflow-hidden"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ep-border/50">
          <h2 className="text-lg font-display font-bold">
            {isEdit ? "Edit Standing Order" : "Create Standing Order"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-ep-border/30 transition">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Label */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Name (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. High Conviction Bets"
              className="w-full px-3 py-2 rounded-lg bg-ep-border/20 border border-ep-border/40 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/50 focus:outline-none transition"
            />
          </div>

          {/* Conviction threshold */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Minimum Conviction Score
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={50}
                max={99}
                value={minConviction}
                onChange={(e) => setMinConviction(parseInt(e.target.value))}
                className="flex-1 accent-accent"
              />
              <span className={`text-lg font-bold tabular-nums min-w-[3rem] text-right ${
                minConviction >= 85 ? "text-emerald-400" : minConviction >= 70 ? "text-yellow-400" : "text-text-primary"
              }`}>
                {minConviction}%
              </span>
            </div>
            <p className="text-xs text-text-muted">
              {minConviction >= 90
                ? "Very selective — only the strongest picks"
                : minConviction >= 80
                  ? "High quality — most recommended threshold"
                  : minConviction >= 70
                    ? "Moderate — more trades, lower average conviction"
                    : "Aggressive — many trades, wider conviction range"}
            </p>
          </div>

          {/* Direction filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Direction</label>
            <div className="flex gap-2">
              {[
                { value: null, label: "Any" },
                { value: "YES", label: "YES only" },
                { value: "NO", label: "NO only" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setDirectionFilter(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    directionFilter === opt.value
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-ep-border/20 text-text-muted border border-transparent hover:border-ep-border/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Categories (optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    selectedCategories.includes(cat)
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-ep-border/20 text-text-muted border border-transparent hover:border-ep-border/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Leave empty for all categories.
            </p>
          </div>

          {/* Amount per trade */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Amount Per Trade</label>
            <div className="flex gap-2">
              {AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => { setAmount(preset); setCustomAmount(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    amount === preset && !customAmount
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-ep-border/20 text-text-muted border border-transparent hover:border-ep-border/40"
                  }`}
                >
                  ${preset}
                </button>
              ))}
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom"
                  className="w-full pl-7 pr-2 py-2 rounded-lg bg-ep-border/20 border border-ep-border/40 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-accent/50 focus:outline-none transition"
                  min={1}
                  max={1000}
                />
              </div>
            </div>
          </div>

          {/* Daily limit */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Daily Trade Limit</label>
            <div className="flex gap-2">
              {DAILY_LIMIT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDailyLimit(preset)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    dailyLimit === preset
                      ? "bg-accent/10 text-accent border border-accent/30"
                      : "bg-ep-border/20 text-text-muted border border-transparent hover:border-ep-border/40"
                  }`}
                >
                  {preset}/day
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Max daily spend: ${(customAmount ? parseFloat(customAmount) || amount : amount) * dailyLimit}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ep-border/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-primary transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-accent text-ep-bg rounded-lg text-sm font-semibold hover:bg-accent/90 transition disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-ep-bg/30 border-t-ep-bg rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
