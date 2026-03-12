import { NextResponse } from "next/server";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { message, page, walletAddress } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Please enter some feedback" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    await supabase.from("ep_beta_feedback").insert({
      message: message.trim(),
      page: page || null,
      user_wallet: walletAddress?.toLowerCase() || null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
