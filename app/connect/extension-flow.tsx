'use client';

import { useState, useEffect } from 'react';

const EXTENSION_ID = 'YOUR_EXTENSION_ID'; // Will be set after Chrome Web Store submission
const BOT_CALLBACK_URL = process.env.NEXT_PUBLIC_BOT_CALLBACK_URL || 'https://easypoly-bot-production.up.railway.app/callback/wallet';

export default function ExtensionConnectPage() {
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [telegramUserId, setTelegramUserId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Get Telegram user ID from URL
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    if (userId) setTelegramUserId(userId);

    // Check if extension is installed
    checkExtensionInstalled();

    // Listen for connection status from extension
    window.addEventListener('message', handleExtensionMessage);

    return () => window.removeEventListener('message', handleExtensionMessage);
  }, []);

  async function checkExtensionInstalled() {
    // Try to communicate with extension
    try {
      // Send message to extension (will fail if not installed)
      const response = await new Promise((resolve) => {
        window.postMessage({ type: 'EASYPOLY_PING', source: 'landing' }, '*');
        
        const timeout = setTimeout(() => resolve(null), 1000);
        
        const handler = (event: MessageEvent) => {
          if (event.data?.type === 'EASYPOLY_PONG') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(true);
          }
        };
        
        window.addEventListener('message', handler);
      });

      setExtensionInstalled(!!response);
    } catch {
      setExtensionInstalled(false);
    }
  }

  function handleExtensionMessage(event: MessageEvent) {
    if (event.data?.type === 'EASYPOLY_CONNECTED') {
      setConnected(true);
      setError('');
    } else if (event.data?.type === 'EASYPOLY_ERROR') {
      setError(event.data.message);
    }
  }

  function triggerExtensionConnect() {
    if (!telegramUserId) {
      setError('Please open this link from the Telegram bot');
      return;
    }

    // Send userId to extension via localStorage (shared storage)
    localStorage.setItem('easypoly_user_id', telegramUserId);

    // Tell extension to start capture
    window.postMessage({
      type: 'EASYPOLY_START_CAPTURE',
      source: 'landing',
      userId: telegramUserId
    }, '*');

    // Open Polymarket in new tab
    window.open('https://polymarket.com', '_blank');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🎯 EasyPoly</h1>
          <p className="text-white/80">One-click Polymarket connection</p>
        </div>

        {!telegramUserId && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
            ⚠️ Please open this link from the Telegram bot
          </div>
        )}

        {/* Extension Check */}
        {extensionInstalled === null && (
          <div className="bg-white/5 rounded-lg p-6 text-center">
            <div className="animate-spin text-4xl mb-4">⚙️</div>
            <p className="text-white/80">Checking for extension...</p>
          </div>
        )}

        {/* Extension Not Installed */}
        {extensionInstalled === false && (
          <div className="space-y-6">
            <div className="bg-white/5 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Step 1: Install Extension</h2>
              <p className="text-white/80 mb-6">
                Install the EasyPoly Chrome extension for one-click connection.
              </p>
              
              <a
                href={`https://chrome.google.com/webstore/detail/${EXTENSION_ID}`}
                target="_blank"
                className="block w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-4 rounded-xl text-center transition-all transform hover:scale-105"
              >
                Install Extension
              </a>
            </div>

            <div className="bg-white/5 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-3">What it does:</h3>
              <ul className="space-y-2 text-white/80">
                <li>✅ Securely captures your Polymarket session</li>
                <li>✅ No manual API key copying required</li>
                <li>✅ One-click connection process</li>
                <li>✅ Works automatically in the background</li>
              </ul>
            </div>

            <button
              onClick={checkExtensionInstalled}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
            >
              I've installed it →
            </button>
          </div>
        )}

        {/* Extension Installed - Ready to Connect */}
        {extensionInstalled === true && !connected && (
          <div className="space-y-6">
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
              ✓ Extension detected!
            </div>

            <div className="bg-white/5 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Step 2: Connect Account</h2>
              <p className="text-white/80 mb-6">
                Click below to open Polymarket. The extension will automatically capture your session.
              </p>

              <ol className="list-decimal list-inside space-y-2 text-white/80 mb-6">
                <li>Polymarket will open in a new tab</li>
                <li>Make sure you're logged in</li>
                <li>Click the EasyPoly extension icon</li>
                <li>Click "Connect Polymarket"</li>
                <li>Done!</li>
              </ol>

              <button
                onClick={triggerExtensionConnect}
                disabled={!telegramUserId}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all transform hover:scale-105"
              >
                Connect Polymarket →
              </button>

              {error && (
                <div className="mt-4 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connected */}
        {connected && (
          <div className="text-center space-y-6">
            <div className="text-6xl">✅</div>
            <h2 className="text-2xl font-bold">Connected!</h2>
            <p className="text-white/80">
              Your Polymarket account is now connected to EasyPoly.
              <br />
              You'll receive bet alerts on Telegram!
            </p>
            <button
              onClick={() => window.close()}
              className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              Close Window
            </button>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/50">
            🔒 Your session is encrypted and stored securely.
            <br />
            All bets will be placed in YOUR Polymarket account.
          </p>
        </div>
      </div>
    </div>
  );
}
