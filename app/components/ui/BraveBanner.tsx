'use client';

import { useState, useEffect } from 'react';

/**
 * Detects Brave browser and shows a dismissible banner warning
 * that Shields may block Privy login (Google/Twitter OAuth popups).
 * Only shows for unauthenticated users who haven't dismissed it.
 */
export function BraveBanner() {
  const [isBrave, setIsBrave] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Brave exposes navigator.brave.isBrave()
    const nav = navigator as any;
    if (nav.brave && typeof nav.brave.isBrave === 'function') {
      nav.brave.isBrave().then((result: boolean) => {
        if (result) {
          // Check if user already dismissed
          const wasDismissed = sessionStorage.getItem('ep-brave-banner-dismissed');
          if (!wasDismissed) setIsBrave(true);
        }
      });
    }
  }, []);

  if (!isBrave || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('ep-brave-banner-dismissed', '1');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">🛡️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-300">
              Brave Browser Detected
            </p>
            <p className="text-xs text-yellow-200/80 mt-1 leading-relaxed">
              Brave Shields may block login popups for Google and Twitter.
              Click the <strong>lion icon</strong> in your address bar and set
              Shields to <strong>Down</strong> for this site, then try logging in again.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 text-yellow-400/60 hover:text-yellow-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
