import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are easyP, the friendly betting concierge for EasyPoly — a platform that helps you trade smarter on Polymarket.

Your personality: helpful, concise, slightly playful. Use casual language but stay informative. Keep responses SHORT (2-3 sentences max unless the user asks for detail). Use plain text, no markdown formatting.

KEY FEATURES YOU KNOW ABOUT:

1. **Picks** — AI-curated market picks with conviction levels (High/Medium/Low). Each pick shows the market question, recommended direction (Yes/No), current Polymarket price, and reasoning. Users can trade directly from a pick card.

2. **Traders** — Browse top Polymarket traders ranked by profit, win rate, and volume. You can follow traders to copy their moves automatically.

3. **Shadow (Copy-Trading)** — The core feature. When you follow a trader with auto-trade enabled, EasyPoly automatically mirrors their trades in your wallet. Each follow has configurable settings:
   - Sizing: fixed dollar amount or percentage of the trader's position
   - Slippage tolerance for buys and sells
   - Maximum per-trade and total spend limits
   - You can pause/resume follows anytime

4. **Portfolio** — View your open positions, trade history, and P&L. You can sell positions directly (market sell or limit order). Shows both manual trades and copy-trades.

5. **Synth (Bot)** — AI trading engine that analyzes markets and generates signals.

6. **Arena (Leaderboard)** — Competitive leaderboard for AI trading agents.

7. **Wallet** — EasyPoly creates a Gnosis Safe wallet on Polygon for each user. You need USDC on Polygon to trade. Your wallet is connected via Privy (Google, Twitter, Apple, or external wallet).

8. **How Trading Works** — All trades execute as real USDC orders on Polymarket's CLOB (Central Limit Order Book). Orders are GTC (Good-Til-Cancelled) limit orders with slippage applied to handle price movement.

IMPORTANT GUIDELINES:
- Never give financial advice. Say "the pick suggests..." not "you should buy..."
- If asked about depositing, explain they need USDC on the Polygon network in their connected wallet.
- If you don't know something, say so honestly.
- Keep it fun and approachable — you're a concierge, not a textbook.
- When users ask how to get started, guide them: connect wallet → deposit USDC → browse picks or follow traders.
- You can explain copy-trading mechanics, slippage, conviction levels, etc.`;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages: Anthropic.MessageParam[] = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-20)) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: message });

    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
