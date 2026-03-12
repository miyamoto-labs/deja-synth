import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { BraveBanner } from "@/app/components/ui/BraveBanner";

// Load Providers client-only — PrivyProvider cannot run during SSR/prerendering.
// This prevents hydration mismatches and Privy init errors during static generation.
const Providers = dynamic(() => import("./providers").then((m) => m.Providers), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Déjà — Prediction markets, where the future feels familiar.",
  description:
    "The most beautiful way to trade Polymarket. Discover top traders, follow their shadow pages, and autocopy their positions automatically.",
  openGraph: {
    title: "Déjà — Prediction markets, where the future feels familiar.",
    description:
      "The most beautiful way to trade Polymarket. Discover top traders, follow their shadow pages, and autocopy their positions automatically.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Déjà typography: DM Serif Display, Playfair Display, Jost, DM Mono */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&family=Jost:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap"
          rel="stylesheet"
        />
        {/* JetBrains Mono kept for dashboard compatibility */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-deja-charcoal text-deja-cream antialiased relative">
        <Providers>
          <div className="relative z-10">{children}</div>
          <Toaster />
          <BraveBanner />
        </Providers>
      </body>
    </html>
  );
}
