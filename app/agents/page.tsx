"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";

/* ── Types ──────────────────────────────────────── */
interface Agent {
  id: string;
  name: string;
  emoji?: string;
  status: "CREATED" | "RUNNING" | "PAUSED" | "STOPPED" | "ERROR";
  strategyType: string;
  riskConfig: {
    profile: string;
  };
  performance?: {
    totalPnL: number;
    totalPnLPercent: number;
    winRate: number;
  };
  createdAt: string;
  startedAt?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/* ── Status Badge ───────────────────────────────── */
function StatusBadge({ status }: { status: Agent["status"] }) {
  const config = {
    CREATED: { label: "Created", color: "bg-gray-500" },
    RUNNING: { label: "Active", color: "bg-green-500" },
    PAUSED: { label: "Paused", color: "bg-yellow-500" },
    STOPPED: { label: "Stopped", color: "bg-red-500" },
    ERROR: { label: "Error", color: "bg-red-600" },
  };

  const { label, color } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

/* ── Agent Card Component ───────────────────────── */
function AgentCard({ agent, onAction }: { agent: Agent; onAction: (action: string) => void }) {
  const router = useRouter();
  const pnl = agent.performance?.totalPnL || 0;
  const pnlPercent = agent.performance?.totalPnLPercent || 0;
  const winRate = agent.performance?.winRate || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:border-accent transition cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">{agent.emoji || "🤖"}</span>
                {agent.name}
              </CardTitle>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={agent.status} />
                <Badge variant="outline" className="text-xs">
                  {agent.strategyType.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-xl font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </div>
              <div className="text-xs text-text-muted">
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs text-text-muted">Win Rate</div>
              <div className="text-sm font-semibold">{winRate.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Risk</div>
              <div className="text-sm font-semibold capitalize">{agent.riskConfig.profile}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Status</div>
              <div className="text-sm font-semibold">{agent.status}</div>
            </div>
          </div>

          <div className="flex gap-2">
            {agent.status === "RUNNING" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction("pause");
                  }}
                  className="flex-1"
                >
                  ⏸ Pause
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction("stop");
                  }}
                  className="flex-1"
                >
                  ⏹ Stop
                </Button>
              </>
            )}

            {agent.status === "PAUSED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("resume");
                }}
                className="flex-1"
              >
                ▶️ Resume
              </Button>
            )}

            {(agent.status === "CREATED" || agent.status === "STOPPED") && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction("start");
                }}
                className="flex-1"
              >
                🚀 Start
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => router.push(`/agents/${agent.id}`)}
              className="flex-1"
            >
              View Details →
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Main Page Component ────────────────────────── */
export default function AgentsPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Fetch agents with auto-refresh
  const { data: agents, mutate } = useSWR<Agent[]>("/api/agents", fetcher, {
    refreshInterval: 5000, // Refresh every 5 seconds
  });

  /* ── Agent Actions ──────────────────────────────── */
  const handleAgentAction = async (agentId: string, action: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}/${action}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error(`Failed to ${action} agent`);

      toast({ title: `Agent ${action}ed successfully` });
      mutate(); // Refresh agents list
    } catch (error) {
      toast({
        title: `Failed to ${action} agent`,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  /* ── Loading State ───────────────────────────────── */
  if (!agents) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading agents...
        </div>
      </div>
    );
  }

  /* ── Empty State ─────────────────────────────────── */
  if (agents.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">🤖</div>
          <h2 className="text-2xl font-bold">No Agents Yet</h2>
          <p className="text-text-muted max-w-md">
            Create your first trading agent to start autonomous trading on Polymarket.
          </p>
          <Button
            size="lg"
            onClick={() => router.push("/agents/new")}
            className="mt-4"
          >
            🚀 Create Your First Agent
          </Button>
        </div>
      </div>
    );
  }

  /* ── Summary Stats ───────────────────────────────── */
  const stats = {
    total: agents.length,
    running: agents.filter((a) => a.status === "RUNNING").length,
    totalPnL: agents.reduce((sum, a) => sum + (a.performance?.totalPnL || 0), 0),
    avgWinRate: agents.reduce((sum, a) => sum + (a.performance?.winRate || 0), 0) / agents.length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Trading Agents</h1>
          <p className="text-text-muted text-sm mt-1">
            Manage your autonomous trading agents
          </p>
        </div>
        <Button onClick={() => router.push("/agents/new")}>
          + Create New Agent
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Agents", value: stats.total, emoji: "🤖" },
          { label: "Active", value: stats.running, emoji: "🟢" },
          {
            label: "Total P&L",
            value: `${stats.totalPnL >= 0 ? "+" : ""}$${stats.totalPnL.toFixed(2)}`,
            emoji: stats.totalPnL >= 0 ? "📈" : "📉",
            color: stats.totalPnL >= 0 ? "text-green-500" : "text-red-500",
          },
          {
            label: "Avg Win Rate",
            value: `${stats.avgWinRate.toFixed(1)}%`,
            emoji: "🎯",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{stat.emoji}</span>
                <span className="text-xs text-text-muted uppercase">{stat.label}</span>
              </div>
              <div className={`text-2xl font-bold ${stat.color || ""}`}>
                {stat.value}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Agents Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onAction={(action) => handleAgentAction(agent.id, action)}
          />
        ))}
      </div>
    </div>
  );
}
