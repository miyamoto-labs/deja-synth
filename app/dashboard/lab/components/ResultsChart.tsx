"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface EquityCurvePoint {
  date: string;
  equity: number;
}

interface ResultsChartProps {
  equityCurve: EquityCurvePoint[];
}

export function ResultsChart({ equityCurve }: ResultsChartProps) {
  // Format data for chart
  const chartData = equityCurve.map((point) => ({
    date: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    equity: point.equity,
  }));

  const startingEquity = equityCurve[0]?.equity || 0;
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || 0;
  const isProfit = finalEquity >= startingEquity;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">Equity Curve</h2>
        <div className="text-right">
          <p className="text-sm text-text-muted">Starting Capital</p>
          <p className="text-lg font-bold text-foreground">
            ${startingEquity.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-muted">Final Capital</p>
          <p className={`text-lg font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
            ${finalEquity.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isProfit ? "#10b981" : "#ef4444"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isProfit ? "#10b981" : "#ef4444"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#888"
              tick={{ fill: "#888" }}
              tickLine={{ stroke: "#888" }}
            />
            <YAxis
              stroke="#888"
              tick={{ fill: "#888" }}
              tickLine={{ stroke: "#888" }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Equity"]}
              labelStyle={{ color: "#888" }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={isProfit ? "#10b981" : "#ef4444"}
              strokeWidth={3}
              fill="url(#colorEquity)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <div className="text-center">
          <p className="text-sm text-text-muted">Profit/Loss</p>
          <p className={`text-xl font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
            ${(finalEquity - startingEquity).toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-text-muted">Return %</p>
          <p className={`text-xl font-bold ${isProfit ? "text-green-400" : "text-red-400"}`}>
            {(((finalEquity - startingEquity) / startingEquity) * 100).toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-text-muted">Data Points</p>
          <p className="text-xl font-bold text-foreground">{equityCurve.length}</p>
        </div>
      </div>
    </div>
  );
}
