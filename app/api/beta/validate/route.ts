import { NextResponse } from "next/server";
import {
  BETA_CODES,
  BETA_COOKIE_NAME,
  BETA_COOKIE_MAX_AGE,
  MASTER_CODE,
} from "@/app/lib/beta-codes";
import { getSupabase } from "@/app/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "Please enter a beta code" },
        { status: 400 }
      );
    }

    const normalizedCode = code.trim().toUpperCase();

    // Quick check against hardcoded list first
    if (!BETA_CODES.has(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: "Invalid beta code" },
        { status: 401 }
      );
    }

    // Master code skips single-use check
    if (normalizedCode !== MASTER_CODE) {
      // Check if code is already claimed in DB
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from("ep_beta_codes")
        .select("code, claimed_at")
        .eq("code", normalizedCode)
        .single();

      if (existing?.claimed_at) {
        // Code already used — but check if it's the same person re-entering
        // (they already have the cookie, so this is a re-validation)
        const cookieHeader = request.headers.get("cookie") || "";
        const hasValidCookie = cookieHeader.includes(`${BETA_COOKIE_NAME}=${normalizedCode}`);
        if (!hasValidCookie) {
          return NextResponse.json(
            { success: false, error: "This code has already been used" },
            { status: 401 }
          );
        }
      }

      // Claim the code if not yet claimed
      if (!existing?.claimed_at) {
        await supabase
          .from("ep_beta_codes")
          .update({ claimed_at: new Date().toISOString() })
          .eq("code", normalizedCode);
      }
    }

    // Set httpOnly cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set(BETA_COOKIE_NAME, normalizedCode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: BETA_COOKIE_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }
}
