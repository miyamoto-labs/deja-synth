import { NextResponse } from "next/server";

const BACKEND_URL = process.env.STRATEGYLAB_BACKEND_URL || "http://localhost:8001";

const MOCK_STRATEGIES = {
  strategies: [
    {
      name: "Gopfan2 Strategy",
      edge_threshold: 0.15,
      confidence_threshold: 0.80,
      position_size: 100,
      timeframe: "1h",
      asset: "BTC"
    },
    {
      name: "Scalper",
      edge_threshold: 0.10,
      confidence_threshold: 0.70,
      position_size: 50,
      timeframe: "1h",
      asset: "BTC"
    },
    {
      name: "Sniper",
      edge_threshold: 0.20,
      confidence_threshold: 0.85,
      position_size: 150,
      timeframe: "24h",
      asset: "BTC"
    },
    {
      name: "Diversified",
      edge_threshold: 0.12,
      confidence_threshold: 0.75,
      position_size: 100,
      timeframe: "1h",
      asset: "BTC"
    },
    {
      name: "Conservative",
      edge_threshold: 0.18,
      confidence_threshold: 0.90,
      position_size: 75,
      timeframe: "24h",
      asset: "BTC"
    },
    {
      name: "Aggressive",
      edge_threshold: 0.08,
      confidence_threshold: 0.65,
      position_size: 200,
      timeframe: "1h",
      asset: "BTC"
    }
  ]
};

export async function GET() {
  try {
    // Try backend first
    try {
      const response = await fetch(`${BACKEND_URL}/strategies`, {
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch (backendError) {
      console.log("Backend unavailable, using mock strategies");
    }

    // Fall back to mock data
    return NextResponse.json(MOCK_STRATEGIES);
    
  } catch (error) {
    console.error("Strategies API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch strategies" },
      { status: 500 }
    );
  }
}
