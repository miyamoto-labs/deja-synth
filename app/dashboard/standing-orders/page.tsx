"use client";

import { useState, useEffect, useCallback } from "react";
import { useUserStore } from "@/app/lib/stores/user-store";
import { motion, AnimatePresence } from "framer-motion";
import StandingOrderCard from "@/app/components/ui/StandingOrderCard";
import StandingOrderForm from "@/app/components/ui/StandingOrderForm";
import StandingOrderHistory from "@/app/components/ui/StandingOrderHistory";

interface StandingOrder {
  id: string;
  user_wallet: string;
  min_conviction: number;
  max_conviction: number;
  direction_filter: string | null;
  category_filter: string[] | null;
  amount: number;
  daily_limit: number;
  total_limit: number | null;
  active: boolean;
  paused_until: string | null;
  pause_reason: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
  todayExecutions: number;
  totalExecutions: number;
}

export default function StandingOrdersPage() {
  const { walletAddress, isConnected } = useUserStore();
  const [orders, setOrders] = useState<StandingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<StandingOrder | null>(null);
  const [tab, setTab] = useState<"rules" | "history">("rules");

  const fetchOrders = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`/api/standing-orders?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCreate = async (data: any) => {
    const res = await fetch("/api/standing-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, ...data }),
    });
    if (res.ok) {
      setShowForm(false);
      fetchOrders();
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    const res = await fetch("/api/standing-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, wallet: walletAddress, ...data }),
    });
    if (res.ok) {
      setEditingOrder(null);
      fetchOrders();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/standing-orders", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, wallet: walletAddress }),
    });
    if (res.ok) fetchOrders();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await handleUpdate(id, { active });
  };

  /* ── Not connected ───────────────────────────── */
  if (!isConnected) {
    return (
      <div className="space-y-6 pt-6">
        <h1 className="text-2xl font-display font-bold">Standing Orders</h1>
        <div className="ep-card p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-display font-semibold text-text-primary text-lg">Connect Your Wallet</h3>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Connect your wallet to create standing orders that auto-execute trades on AI picks matching your criteria.
          </p>
        </div>
      </div>
    );
  }

  /* ── Full UI ────────────────────────────────── */
  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Standing Orders</h1>
          <p className="text-sm text-text-muted mt-1">
            Set it and forget it. Auto-bet on AI picks matching your rules.
          </p>
        </div>
        <button
          onClick={() => { setEditingOrder(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-ep-bg rounded-lg text-sm font-semibold hover:bg-accent/90 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Rule
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ep-border/30 rounded-lg w-fit">
        <button
          onClick={() => setTab("rules")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            tab === "rules" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"
          }`}
        >
          Rules ({orders.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
            tab === "history" ? "bg-accent/10 text-accent" : "text-text-muted hover:text-text-primary"
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      {tab === "rules" ? (
        <div className="space-y-4">
          {loading ? (
            <div className="ep-card p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-accent/30 border-t-accent rounded-full mx-auto" />
              <p className="text-sm text-text-muted mt-3">Loading standing orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="ep-card p-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/5 border border-accent/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-display font-semibold text-text-primary text-lg">No Standing Orders Yet</h3>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                Create your first rule to auto-execute trades when AI picks match your conviction threshold.
              </p>
              <button
                onClick={() => { setEditingOrder(null); setShowForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-ep-bg rounded-lg text-sm font-semibold hover:bg-accent/90 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create First Rule
              </button>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <StandingOrderCard
                    order={order}
                    onToggle={(active) => handleToggle(order.id, active)}
                    onEdit={() => { setEditingOrder(order); setShowForm(true); }}
                    onDelete={() => handleDelete(order.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      ) : (
        <StandingOrderHistory wallet={walletAddress!} />
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <StandingOrderForm
            order={editingOrder}
            onSubmit={editingOrder
              ? (data) => handleUpdate(editingOrder.id, data)
              : handleCreate
            }
            onClose={() => { setShowForm(false); setEditingOrder(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
