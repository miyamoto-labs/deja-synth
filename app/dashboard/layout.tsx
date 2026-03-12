"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider, TradeProvider, MarketDetailProvider, WalletConnectButton, Onboarding, NotificationBell } from "@/app/components/ui";
import { BetaFeedback } from "@/app/components/ui/BetaFeedback";
import { ChatWidget } from "@/app/components/ui/ChatWidget";

const navItems = [
  { href: "/dashboard/markets", label: "Markets", icon: "grid" },
  { href: "/dashboard/picks", label: "Picks", icon: "target" },
  { href: "/dashboard/traders", label: "Traders", icon: "users" },
  { href: "/dashboard/shadow", label: "Shadow", icon: "ghost" },
  { href: "/dashboard/bot", label: "Synth", icon: "zap" },
  // { href: "/dashboard/bot/leaderboard", label: "Arena", icon: "trophy" },
  { href: "/dashboard/news", label: "News", icon: "newspaper" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "wallet" },
  // { href: "/dashboard/performance", label: "Stats", icon: "chart" }, // Hidden — focus on copytrade + picks first
  // { href: "https://t.me/EasypolyQuickbot", label: "Telegram Bot", icon: "telegram", external: true }, // Paused — bot not operational
];

const mobileNavItems = [
  { href: "/dashboard/markets", label: "Markets", icon: "grid" },
  { href: "/dashboard/picks", label: "Picks", icon: "target" },
  { href: "/dashboard/traders", label: "Traders", icon: "users" },
  { href: "/dashboard/shadow", label: "Shadow", icon: "ghost" },
  { href: "/dashboard/portfolio", label: "Portfolio", icon: "wallet" },
];

function NavIcon({ icon }: { icon: string }) {
  const icons: Record<string, JSX.Element> = {
    grid: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
    target: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    chart: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    users: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    wallet: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    ),
    trophy: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.996.178-1.768.65-2.08 1.377-.339.795-.186 1.725.28 2.535.603 1.05 1.666 1.852 2.8 2.352m0 0a7.502 7.502 0 003.247 1.75m-3.247-1.75H5.25m13.5 0c.996.178 1.768.65 2.08 1.377.339.795.186 1.725-.28 2.535-.603 1.05-1.666 1.852-2.8 2.352m0 0a7.502 7.502 0 01-3.247 1.75m3.247-1.75H18.75M12 2.25a3.75 3.75 0 00-3.75 3.75v1.5a3.75 3.75 0 107.5 0V6a3.75 3.75 0 00-3.75-3.75z" />
      </svg>
    ),
    gift: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    ghost: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C7.58 2 4 5.58 4 10v10.5c0 .28.22.5.5.5s.5-.22.5-.5V19l1.5 1.5L8 19l1.5 1.5L11 19l1 1 1-1 1.5 1.5L16 19l1.5 1.5L19 19v1.5c0 .28.22.5.5.5s.5-.22.5-.5V10c0-4.42-3.58-8-8-8z" />
        <circle cx="9" cy="10" r="1.5" fill="currentColor" />
        <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      </svg>
    ),
    zap: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    cpu: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    gamepad: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="3" />
        <path d="M8 12h4M10 10v4" />
        <circle cx="16" cy="10" r="0.75" fill="currentColor" />
        <circle cx="16" cy="14" r="0.75" fill="currentColor" />
      </svg>
    ),
    telegram: (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
      </svg>
    ),
    scale: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
    newspaper: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
      </svg>
    ),
    flame: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  };
  return icons[icon] || null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ToastProvider>
      <TradeProvider>
      <MarketDetailProvider>
      <div className="min-h-screen bg-ep-bg">
        {/* Top bar */}
        <header className="fixed top-0 z-50 w-full border-b border-ep-border/50 glass">
          <div className="flex items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="text-lg font-display font-bold">
                <span className="text-deja-cream">Déjà</span><span className="text-deja-amber">.</span>
              </span>
              <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
                Beta
              </span>
            </Link>

            {/* Nav - center */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const className = `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }`;
                
                // External links (like Telegram bot)
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${className} ${item.icon === 'telegram' ? 'bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20' : ''}`}
                      title={item.label}
                    >
                      <NavIcon icon={item.icon} />
                      {item.label}
                    </a>
                  );
                }
                
                // Internal links
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={className}
                  >
                    <NavIcon icon={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {/* Engine status indicator */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted">
                <span className="live-dot" />
                <span>Beta</span>
              </div>
              {/* Telegram community */}
              <a
                href="https://t.me/easypolycommunity" // TODO: update to Déjà community link
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-accent hover:bg-accent/5 transition"
                title="Join our Telegram community"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                Community
              </a>
              <Link
                href="/dashboard/docs"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-accent hover:bg-accent/5 transition"
                title="Documentation"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                Docs
              </Link>
              <NotificationBell />
              <WalletConnectButton />
            </div>
          </div>
        </header>

        {/* Main content — no sidebar, use top nav */}
        <main className="pt-16 px-4 pb-20 md:px-8 md:pb-8 max-w-[1800px] mx-auto">
          {children}
        </main>

        {/* Onboarding overlay — only renders for first-time users */}
        <Onboarding />

        {/* Beta feedback widget */}
        <BetaFeedback />

        {/* easyP chat concierge */}
        <ChatWidget />

        {/* Bottom nav - mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-ep-border glass md:hidden overflow-visible">
          {mobileNavItems.map((item, i) => {
            const active = !item.external && (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)));
            const isCenter = i === 2; // Center item gets raised pill
            const className = `flex flex-1 flex-col items-center gap-1 py-3 text-[10px] ${
              active
                ? "text-accent"
                : "text-text-muted"
            }`;

            const content = (
              <>
                {isCenter ? (
                  <div className={`relative -mt-5 w-11 h-11 rounded-full flex items-center justify-center border-2 ${
                    active
                      ? "bg-accent/15 border-accent/40 shadow-glow-sm"
                      : "bg-ep-card border-accent/20"
                  }`}>
                    <NavIcon icon={item.icon} />
                  </div>
                ) : (
                  <NavIcon icon={item.icon} />
                )}
                <span className={isCenter ? "-mt-0.5" : ""}>{item.label.split(" ")[0]}</span>
              </>
            );
            
            // External links
            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {content}
                </a>
              );
            }
            
            // Internal links
            return (
              <Link
                key={item.href}
                href={item.href}
                className={className}
              >
                {content}
              </Link>
            );
          })}
        </nav>
      </div>
    </MarketDetailProvider>
    </TradeProvider>
    </ToastProvider>
  );
}
