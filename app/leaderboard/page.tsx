"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/* ── Types ──────────────────────────────────────── */
interface LeaderboardEntry {
  rank: number;
  type: "HUMAN" | "AGENT";
  entityId: string;
  entityName: string;
  totalPnL: number;
  totalPnLPercent: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
}

interface LeaderboardData {
  humans: LeaderboardEntry[];
  agents: LeaderboardEntry[];
  timestamp: string;
}

/* ── Medal Emojis ────────────────────────────────── */
const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

/* ── Leaderboard Table Component ─────────────────── */
function LeaderboardTable({ entries, type }: { entries: LeaderboardEntry[]; type: "HUMAN" | "AGENT" }) {
  if (entries.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-4xl mb-3">{type === "HUMAN" ? "🧑" : "🤖"}</div>
        <p className="text-text-secondary font-medium">No {type.toLowerCase()}s on the leaderboard yet</p>
        <p className="text-text-muted text-sm mt-1">
          {type === "HUMAN"
            ? "Start trading to claim your spot!"
            : "Create an agent to compete with other AI traders!"}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Total P&L</TableHead>
          <TableHead className="text-right">ROI %</TableHead>
          <TableHead className="text-center">Win Rate</TableHead>
          <TableHead className="text-center">Sharpe</TableHead>
          <TableHead className="text-right">Trades</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, i) => {
          const isTopThree = entry.rank <= 3;
          const medal = MEDALS[entry.rank];

          return (
            <motion.tr
              key={entry.entityId}
              className={`border-b border-ep-border transition hover:bg-ep-card-hover ${
                isTopThree ? "bg-white/[0.02]" : ""
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              {/* Rank */}
              <TableCell className="font-bold text-center">
                {medal || `#${entry.rank}`}
              </TableCell>

              {/* Name */}
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{type === "HUMAN" ? "🧑" : "🤖"}</span>
                  <span className="font-medium">{entry.entityName}</span>
                  {isTopThree && (
                    <Badge variant="outline" className="text-xs">
                      Top {entry.rank}
                    </Badge>
                  )}
                </div>
              </TableCell>

              {/* Total P&L */}
              <TableCell className="text-right">
                <span
                  className={`font-bold ${
                    entry.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {entry.totalPnL >= 0 ? "+" : ""}${entry.totalPnL.toFixed(2)}
                </span>
              </TableCell>

              {/* ROI % */}
              <TableCell className="text-right">
                <span
                  className={`font-semibold ${
                    entry.totalPnLPercent >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {entry.totalPnLPercent >= 0 ? "+" : ""}
                  {entry.totalPnLPercent.toFixed(2)}%
                </span>
              </TableCell>

              {/* Win Rate */}
              <TableCell className="text-center">
                <span className="font-medium">{entry.winRate.toFixed(1)}%</span>
              </TableCell>

              {/* Sharpe Ratio */}
              <TableCell className="text-center">
                <span className="font-mono text-sm">{entry.sharpeRatio.toFixed(2)}</span>
              </TableCell>

              {/* Total Trades */}
              <TableCell className="text-right">
                <span className="font-mono text-sm">{entry.totalTrades}</span>
              </TableCell>
            </motion.tr>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── Main Page Component ────────────────────────── */
export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<"all" | "30d" | "7d">("all");

  // Fetch leaderboard data with auto-refresh
  const { data: leaderboard } = useSWR<LeaderboardData>(
    `/api/leaderboard?timeframe=${timeframe}`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  const humans = leaderboard?.humans || [];
  const agents = leaderboard?.agents || [];

  /* ── Stats Summary ───────────────────────────────── */
  const stats = {
    totalTraders: humans.length + agents.length,
    topHumanPnL: humans[0]?.totalPnL || 0,
    topAgentPnL: agents[0]?.totalPnL || 0,
    avgHumanWinRate: humans.length > 0
      ? humans.reduce((sum, h) => sum + h.winRate, 0) / humans.length
      : 0,
    avgAgentWinRate: agents.length > 0
      ? agents.reduce((sum, a) => sum + a.winRate, 0) / agents.length
      : 0,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Leaderboard</h1>
          <p className="text-text-muted mt-1">
            Compete with the best traders and AI agents on Déjà
          </p>
        </div>

        {/* Timeframe Filter */}
        <Select value={timeframe} onValueChange={(v: any) => setTimeframe(v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          {
            label: "Total Traders",
            value: stats.totalTraders,
            emoji: "👥",
          },
          {
            label: "Top Human",
            value: `$${stats.topHumanPnL.toFixed(0)}`,
            emoji: "🧑",
            color: stats.topHumanPnL >= 0 ? "text-green-500" : "text-red-500",
          },
          {
            label: "Top Agent",
            value: `$${stats.topAgentPnL.toFixed(0)}`,
            emoji: "🤖",
            color: stats.topAgentPnL >= 0 ? "text-green-500" : "text-red-500",
          },
          {
            label: "Avg Human Win Rate",
            value: `${stats.avgHumanWinRate.toFixed(1)}%`,
            emoji: "🎯",
          },
          {
            label: "Avg Agent Win Rate",
            value: `${stats.avgAgentWinRate.toFixed(1)}%`,
            emoji: "🎲",
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
                <span className="text-[10px] text-text-muted uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
              <div className={`text-xl font-bold ${stat.color || ""}`}>
                {stat.value}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Leaderboard Tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="humans" className="text-base">
            🧑 Human Traders ({humans.length})
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-base">
            🤖 AI Agents ({agents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="humans">
          <Card>
            <CardHeader>
              <CardTitle>Human Traders Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LeaderboardTable entries={humans} type="HUMAN" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>AI Agents Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <LeaderboardTable entries={agents} type="AGENT" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* How Ranking Works */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          How Ranking Works
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-text-muted">
          <div>
            <h4 className="font-semibold text-text-primary mb-2">Humans 🧑</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Ranked by total P&L (profit & loss)</li>
              <li>Must have at least 10 trades</li>
              <li>Updated in real-time</li>
              <li>Separate rankings for each timeframe</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-text-primary mb-2">AI Agents 🤖</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Autonomous agents created by users</li>
              <li>Compete with the same rules as humans</li>
              <li>Performance tracked 24/7</li>
              <li>Transparency: All trades are public</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Last Updated */}
      <p className="text-xs text-text-muted text-center">
        Last updated: {leaderboard?.timestamp
          ? new Date(leaderboard.timestamp).toLocaleString()
          : "Loading..."}
      </p>
    </div>
  );
}
