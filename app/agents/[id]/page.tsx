"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/* ── Types ──────────────────────────────────────── */
interface AgentDetails {
  id: string;
  name: string;
  emoji?: string;
  status: string;
  strategyType: string;
  strategyConfig: any;
  riskConfig: any;
  wallet: {
    addresses: any;
    balance: number;
  };
  performance: {
    totalPnL: number;
    totalPnLPercent: number;
    winRate: number;
    totalTrades: number;
    wins: number;
    losses: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  trades: Array<{
    id: string;
    marketTitle: string;
    outcome: string;
    amount: number;
    entryPrice: number;
    exitPrice?: number;
    pnl?: number;
    pnlPercent?: number;
    status: string;
    timestamp: string;
  }>;
  performanceHistory: Array<{
    timestamp: string;
    balance: number;
    pnl: number;
  }>;
}

/* ── Status Badge ───────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    CREATED: { label: "Created", color: "bg-gray-500" },
    RUNNING: { label: "Active", color: "bg-green-500" },
    PAUSED: { label: "Paused", color: "bg-yellow-500" },
    STOPPED: { label: "Stopped", color: "bg-red-500" },
    ERROR: { label: "Error", color: "bg-red-600" },
  };

  const { label, color } = config[status] || { label: status, color: "bg-gray-500" };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color} ${status === "RUNNING" ? "animate-pulse" : ""}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────── */
export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const { data: agent, mutate } = useSWR<AgentDetails>(
    `/api/agents/${params.id}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  /* ── Agent Actions ──────────────────────────────── */
  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/agents/${params.id}/${action}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error(`Failed to ${action} agent`);

      toast({ title: `Agent ${action}ed successfully` });
      mutate();
    } catch (error) {
      toast({
        title: `Failed to ${action} agent`,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleStop = async () => {
    await handleAction("stop");
    setShowStopConfirm(false);
  };

  /* ── Loading State ───────────────────────────────── */
  if (!agent) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading agent...
        </div>
      </div>
    );
  }

  const perf = agent.performance;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push("/agents")}
            className="mb-2 -ml-2"
          >
            ← Back to Agents
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{agent.emoji || "🤖"}</span>
            <div>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={agent.status} />
                <Badge variant="outline">{agent.strategyType.replace(/_/g, " ")}</Badge>
                <Badge variant="outline" className="capitalize">{agent.riskConfig.profile} Risk</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {agent.status === "RUNNING" && (
            <>
              <Button variant="outline" onClick={() => handleAction("pause")}>
                ⏸ Pause
              </Button>
              <Dialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
                <DialogTrigger asChild>
                  <Button variant="destructive">⏹ Stop</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Stop Agent?</DialogTitle>
                    <DialogDescription>
                      This will permanently stop the agent. You can start it again later,
                      but all pending orders will be cancelled.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" onClick={() => setShowStopConfirm(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleStop}>
                      Stop Agent
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {agent.status === "PAUSED" && (
            <Button onClick={() => handleAction("resume")}>▶️ Resume</Button>
          )}

          {(agent.status === "CREATED" || agent.status === "STOPPED") && (
            <Button onClick={() => handleAction("start")}>🚀 Start Trading</Button>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total P&L",
            value: `${perf.totalPnL >= 0 ? "+" : ""}$${perf.totalPnL.toFixed(2)}`,
            subValue: `${perf.totalPnLPercent >= 0 ? "+" : ""}${perf.totalPnLPercent.toFixed(2)}%`,
            color: perf.totalPnL >= 0 ? "text-green-500" : "text-red-500",
          },
          {
            label: "Win Rate",
            value: `${perf.winRate.toFixed(1)}%`,
            subValue: `${perf.wins}W / ${perf.losses}L`,
          },
          {
            label: "Sharpe Ratio",
            value: perf.sharpeRatio.toFixed(2),
            subValue: "Risk-adjusted return",
          },
          {
            label: "Max Drawdown",
            value: `${perf.maxDrawdown.toFixed(1)}%`,
            subValue: "Peak to trough",
            color: "text-red-500",
          },
        ].map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-4">
              <div className="text-xs text-text-muted uppercase mb-1">{metric.label}</div>
              <div className={`text-2xl font-bold ${metric.color || ""}`}>
                {metric.value}
              </div>
              <div className="text-xs text-text-muted mt-1">{metric.subValue}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agent.performanceHistory || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#666"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#666" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "P&L"]}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#00d4aa"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Trades, Positions, Settings */}
      <Tabs defaultValue="trades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
          <TabsTrigger value="positions">Open Positions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Trade History */}
        <TabsContent value="trades">
          <Card>
            <CardContent className="p-0">
              {agent.trades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agent.trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {trade.marketTitle}
                        </TableCell>
                        <TableCell>{trade.outcome}</TableCell>
                        <TableCell>${trade.amount.toFixed(2)}</TableCell>
                        <TableCell>{trade.entryPrice.toFixed(3)}</TableCell>
                        <TableCell>
                          {trade.exitPrice ? trade.exitPrice.toFixed(3) : "—"}
                        </TableCell>
                        <TableCell>
                          {trade.pnl !== undefined ? (
                            <span
                              className={trade.pnl >= 0 ? "text-green-500" : "text-red-500"}
                            >
                              {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={trade.status === "CLOSED" ? "outline" : "default"}>
                            {trade.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-text-muted">
                          {new Date(trade.timestamp).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-text-secondary font-medium">No trades yet</p>
                  <p className="text-text-muted text-sm mt-1">
                    Trades will appear here once your agent starts trading
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Positions */}
        <TabsContent value="positions">
          <Card>
            <CardContent className="p-0">
              {agent.trades.filter((t) => t.status === "OPEN").length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Entry Price</TableHead>
                      <TableHead>Current P&L</TableHead>
                      <TableHead>Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agent.trades
                      .filter((t) => t.status === "OPEN")
                      .map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="font-medium max-w-xs truncate">
                            {trade.marketTitle}
                          </TableCell>
                          <TableCell>{trade.outcome}</TableCell>
                          <TableCell>${trade.amount.toFixed(2)}</TableCell>
                          <TableCell>{trade.entryPrice.toFixed(3)}</TableCell>
                          <TableCell>
                            {trade.pnl !== undefined ? (
                              <span
                                className={trade.pnl >= 0 ? "text-green-500" : "text-red-500"}
                              >
                                {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-text-muted">
                            {new Date(trade.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">💤</div>
                  <p className="text-text-secondary font-medium">No open positions</p>
                  <p className="text-text-muted text-sm mt-1">
                    Your agent will open positions based on your strategy
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-text-muted mb-1">Balance</div>
                  <div className="text-2xl font-bold">
                    ${agent.wallet.balance.toFixed(2)} USDC
                  </div>
                </div>

                <div>
                  <div className="text-sm text-text-muted mb-1">Wallet Address (Polygon)</div>
                  <div className="font-mono text-xs break-all p-3 bg-ep-surface rounded border border-ep-border">
                    {agent.wallet.addresses?.ethereum || "No address"}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1">
                    💰 Add Funds
                  </Button>
                  <Button variant="outline" className="flex-1">
                    📤 Withdraw
                  </Button>
                  <Button variant="outline" className="flex-1">
                    🔑 Export Key
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strategy Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-text-muted">Strategy</div>
                    <div className="font-medium">{agent.strategyType.replace(/_/g, " ")}</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-muted">Risk Profile</div>
                    <div className="font-medium capitalize">{agent.riskConfig.profile}</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-muted">Position Size</div>
                    <div className="font-medium">{agent.riskConfig.positionSize}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-muted">Max Positions</div>
                    <div className="font-medium">{agent.riskConfig.maxOpenPositions}</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-muted">Daily Loss Limit</div>
                    <div className="font-medium">${agent.riskConfig.dailyLossLimit}</div>
                  </div>
                  <div>
                    <div className="text-sm text-text-muted">Stop Loss</div>
                    <div className="font-medium">{agent.riskConfig.stopLoss}%</div>
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-4">
                  ⚙️ Edit Configuration
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-500">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-muted mb-4">
                  Permanently delete this agent. This action cannot be undone.
                </p>
                <Button variant="destructive" className="w-full">
                  🗑️ Delete Agent
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
