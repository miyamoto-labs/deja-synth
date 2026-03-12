'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '@/app/lib/stores/user-store';
import { timeAgo } from '@/app/lib/utils/timeAgo';

/* ── Types ───────────────────────────────────────── */
interface Notification {
  id: string;
  type: 'pick' | 'signal' | 'trade' | 'system';
  title: string;
  body: string | null;
  metadata: any;
  read: boolean;
  created_at: string;
}

/* ── Constants ───────────────────────────────────── */
const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  pick: { icon: '\u{1F3AF}', color: '#F0B000' },    // 🎯 amber
  signal: { icon: '\u{1F4E1}', color: '#60A5FA' },  // 📡 blue
  trade: { icon: '\u{2705}', color: '#00F0A0' },    // ✅ green
  system: { icon: '\u{2699}\uFE0F', color: '#8B92A8' },  // ⚙️ gray
};

/* ── Component ───────────────────────────────────── */
export function NotificationBell() {
  const router = useRouter();
  const { walletAddress, isConnected } = useUserStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(
        `/api/notifications/list?wallet=${walletAddress}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silent failure
    }
  }, [walletAddress]);

  // Poll every 30s
  useEffect(() => {
    if (!isConnected || !walletAddress) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isConnected, walletAddress]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Mark all as read
  const markAllRead = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, notificationIds: 'all' }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silent
    }
    setLoading(false);
  };

  if (!isConnected) return null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5 transition"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-loss text-white text-[10px] font-bold"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[420px] rounded-xl overflow-hidden border border-ep-border shadow-2xl z-[80]"
            style={{ background: '#0F1118' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ep-border">
              <h3 className="text-sm font-semibold text-text-primary">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[10px] text-accent hover:underline disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[360px] no-scrollbar">
              {notifications.length > 0 ? (
                notifications.map((notif, i) => {
                  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex gap-3 px-4 py-3 border-b border-ep-border/50 transition ${
                        notif.read
                          ? 'bg-transparent'
                          : 'bg-accent/[0.03]'
                      } hover:bg-white/[0.02] ${notif.metadata?.action === 'review_trade' ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (notif.metadata?.action === 'review_trade') {
                          setOpen(false);
                          router.push('/dashboard/shadow');
                        }
                      }}
                    >
                      {/* Type icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
                        style={{
                          backgroundColor: `${config.color}15`,
                          color: config.color,
                        }}
                      >
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-xs leading-snug ${
                              notif.read
                                ? 'text-text-secondary'
                                : 'text-text-primary font-medium'
                            }`}
                          >
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <div
                              className="w-2 h-2 rounded-full shrink-0 mt-1"
                              style={{ backgroundColor: config.color }}
                            />
                          )}
                        </div>
                        {notif.body && (
                          <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                        <p className="text-[10px] text-text-muted mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="text-2xl mb-2 opacity-40">
                    {'\u{1F514}'}
                  </div>
                  <p className="text-sm text-text-muted">
                    No notifications yet
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">
                    You&apos;ll see picks, signals, and trade updates here
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
