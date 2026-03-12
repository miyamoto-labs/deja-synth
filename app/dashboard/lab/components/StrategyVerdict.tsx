"use client";

interface StrategyVerdictProps {
  metrics: {
    total_return_pct: number;
    win_rate: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    profit_factor: number;
  };
  strategyName: string;
}

export function StrategyVerdict({ metrics, strategyName }: StrategyVerdictProps) {
  // Calculate overall score
  const getScore = () => {
    let score = 0;
    
    // Return % (0-40 points)
    if (metrics.total_return_pct > 50) score += 40;
    else if (metrics.total_return_pct > 30) score += 30;
    else if (metrics.total_return_pct > 15) score += 20;
    else if (metrics.total_return_pct > 5) score += 10;
    
    // Win rate (0-20 points)
    if (metrics.win_rate > 60) score += 20;
    else if (metrics.win_rate > 55) score += 15;
    else if (metrics.win_rate > 50) score += 10;
    else if (metrics.win_rate > 45) score += 5;
    
    // Sharpe ratio (0-20 points)
    if (metrics.sharpe_ratio > 2.5) score += 20;
    else if (metrics.sharpe_ratio > 2.0) score += 15;
    else if (metrics.sharpe_ratio > 1.5) score += 10;
    else if (metrics.sharpe_ratio > 1.0) score += 5;
    
    // Max drawdown (0-20 points, lower is better)
    if (metrics.max_drawdown_pct < 10) score += 20;
    else if (metrics.max_drawdown_pct < 15) score += 15;
    else if (metrics.max_drawdown_pct < 20) score += 10;
    else if (metrics.max_drawdown_pct < 30) score += 5;
    
    return score;
  };

  const score = getScore();
  
  // Determine verdict
  const getVerdict = () => {
    if (score >= 80) return {
      grade: "A+",
      verdict: "EXCELLENT STRATEGY",
      recommendation: "Highly recommended for live trading",
      color: "emerald",
      emoji: "🏆",
      action: "Deploy This Strategy"
    };
    if (score >= 65) return {
      grade: "A",
      verdict: "STRONG PERFORMER",
      recommendation: "Good choice for most traders",
      color: "green",
      emoji: "✅",
      action: "Use This Strategy"
    };
    if (score >= 50) return {
      grade: "B",
      verdict: "SOLID STRATEGY",
      recommendation: "Decent results, consider with small position",
      color: "blue",
      emoji: "👍",
      action: "Test Small Position"
    };
    if (score >= 35) return {
      grade: "C",
      verdict: "MEDIOCRE",
      recommendation: "Needs improvement before live trading",
      color: "yellow",
      emoji: "⚠️",
      action: "Optimize Parameters"
    };
    return {
      grade: "D",
      verdict: "POOR PERFORMANCE",
      recommendation: "Do not use - try different strategy",
      color: "red",
      emoji: "❌",
      action: "Pick Another Strategy"
    };
  };

  const verdict = getVerdict();

  const colorClasses = {
    emerald: {
      bg: "from-emerald-500/20 to-green-500/20",
      border: "border-emerald-500/50",
      text: "text-emerald-400",
      badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500",
      button: "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
    },
    green: {
      bg: "from-green-500/20 to-emerald-500/20",
      border: "border-green-500/50",
      text: "text-green-400",
      badge: "bg-green-500/20 text-green-400 border-green-500",
      button: "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
    },
    blue: {
      bg: "from-blue-500/20 to-cyan-500/20",
      border: "border-blue-500/50",
      text: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-400 border-blue-500",
      button: "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
    },
    yellow: {
      bg: "from-yellow-500/20 to-orange-500/20",
      border: "border-yellow-500/50",
      text: "text-yellow-400",
      badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500",
      button: "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
    },
    red: {
      bg: "from-red-500/20 to-rose-500/20",
      border: "border-red-500/50",
      text: "text-red-400",
      badge: "bg-red-500/20 text-red-400 border-red-500",
      button: "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
    }
  };

  const colors = colorClasses[verdict.color as keyof typeof colorClasses];

  return (
    <div className={`bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-2xl p-8`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="text-6xl">{verdict.emoji}</div>
          <div>
            <div className={`text-3xl font-black ${colors.text} mb-1`}>
              {verdict.verdict}
            </div>
            <div className="text-gray-300 text-lg">
              {strategyName}
            </div>
          </div>
        </div>
        
        <div className={`px-6 py-3 ${colors.badge} border-2 rounded-xl font-black text-2xl`}>
          {verdict.grade}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-2">💡 Recommendation</div>
          <div className="text-white text-lg font-medium">{verdict.recommendation}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Risk Level</div>
            <div className={`text-lg font-bold ${colors.text}`}>
              {metrics.max_drawdown_pct < 15 ? "LOW" : metrics.max_drawdown_pct < 25 ? "MEDIUM" : "HIGH"}
            </div>
          </div>
          <div className="bg-black/30 rounded-lg p-3">
            <div className="text-gray-400 text-xs mb-1">Consistency</div>
            <div className={`text-lg font-bold ${colors.text}`}>
              {metrics.win_rate > 55 ? "HIGH" : metrics.win_rate > 48 ? "MEDIUM" : "LOW"}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button 
          className={`flex-1 ${colors.button} text-black font-bold py-4 px-6 rounded-xl text-lg shadow-lg transition-all hover:scale-[1.02]`}
        >
          {verdict.action}
        </button>
        <button className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border-2 border-gray-700 transition-all">
          Compare Strategies
        </button>
        <button className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl border-2 border-gray-700 transition-all">
          Export Results
        </button>
      </div>
    </div>
  );
}
