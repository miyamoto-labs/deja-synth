import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, authData, source, version } = body;

    if (!userId || !authData) {
      return NextResponse.json(
        { error: 'Missing userId or authData' },
        { status: 400, headers }
      );
    }

    console.log('[capture-auth] ✅ Received auth from', source, version, 'for user', userId);
    console.log('[capture-auth] Auth data keys:', Object.keys(authData));
    console.log('[capture-auth] localStorage keys:', Object.keys(authData.localStorage || {}));
    console.log('[capture-auth] Cookies count:', authData.cookies?.length || 0);

    // Extract important auth tokens
    const auth = {
      bearerToken: null as string | null,
      magicApiKey: null as string | null,
      clobApiKey: null as string | null,
      proxyWallet: null as string | null,
    };

    // Look for API keys in localStorage
    const ls = authData.localStorage || {};
    
    if (ls['poly_clob_api_key_map']) {
      console.log('[capture-auth] 🎯 Found CLOB API key!');
      auth.clobApiKey = ls['poly_clob_api_key_map'];
    }
    
    if (ls['polymarket.auth.proxyWallet']) {
      console.log('[capture-auth] 🎯 Found proxy wallet!');
      auth.proxyWallet = ls['polymarket.auth.proxyWallet'];
    }

    if (ls['polymarket.auth.params']) {
      console.log('[capture-auth] 🎯 Found auth params!');
    }

    console.log('[capture-auth] ✅ Successfully processed auth for user', userId);
    console.log('[capture-auth] Has CLOB key:', !!auth.clobApiKey);
    console.log('[capture-auth] Has proxy wallet:', !!auth.proxyWallet);

    // Save auth to file for reuse
    const authFilePath = path.join(process.cwd(), 'polymarket-auth.json');
    const savedData = {
      userId,
      capturedAt: new Date().toISOString(),
      auth,
      fullData: authData
    };
    
    try {
      fs.writeFileSync(authFilePath, JSON.stringify(savedData, null, 2));
      console.log('[capture-auth] 💾 Saved auth to:', authFilePath);
    } catch (err) {
      console.error('[capture-auth] Failed to save auth:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Auth captured successfully',
      hasClobKey: !!auth.clobApiKey,
      hasProxyWallet: !!auth.proxyWallet,
    }, { headers });

  } catch (error: any) {
    console.error('[capture-auth] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers }
    );
  }
}
