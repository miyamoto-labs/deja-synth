"use client";

import React, { useState } from "react";

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  children?: { id: string; title: string }[];
}

export const docSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    children: [
      { id: "what-is-deja", title: "What is Déjà?" },
      { id: "connect-wallet", title: "Connect Wallet" },
      { id: "first-pick", title: "Your First Pick" },
      { id: "understanding-tiers", title: "Understanding Tiers" },
    ],
  },
  {
    id: "picks-engine",
    title: "Picks Engine",
    icon: "🎯",
    children: [
      { id: "daily-super-pick", title: "Daily Super Pick" },
      { id: "category-filters", title: "Category Filters" },
      { id: "wild-picks", title: "Wild Picks" },
      { id: "scoring-system", title: "Scoring System" },
    ],
  },
  {
    id: "polytinder",
    title: "PolyTinder",
    icon: "🔥",
    children: [
      { id: "swipe-mechanics", title: "Swipe Mechanics" },
      { id: "bet-presets", title: "Bet Presets" },
      { id: "skip-vs-bet", title: "Skip vs Bet" },
      { id: "deck-selection", title: "Deck Selection" },
    ],
  },
  {
    id: "trader-discovery",
    title: "Trader Discovery",
    icon: "👥",
    children: [
      { id: "copy-trading", title: "What is Copy Trading?" },
      { id: "trader-tiers", title: "Tier System" },
      { id: "scoring-algorithm", title: "7-Factor Algorithm" },
      { id: "follow-trader", title: "How to Follow" },
      { id: "trader-categories", title: "Categories" },
    ],
  },
  {
    id: "portfolio",
    title: "Portfolio",
    icon: "💼",
    children: [
      { id: "track-bets", title: "Track Your Bets" },
      { id: "win-loss-stats", title: "Win/Loss Statistics" },
      { id: "performance-time", title: "Performance Over Time" },
    ],
  },
  {
    id: "how-it-works",
    title: "How It Works",
    icon: "⚙️",
    children: [
      { id: "market-scoring", title: "Market Scoring Algorithm" },
      { id: "trader-ranking", title: "Trader Ranking" },
      { id: "skill-vs-luck", title: "Skill vs Luck" },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    icon: "❓",
  },
  {
    id: "advanced",
    title: "Advanced",
    icon: "🧪",
    children: [
      { id: "edge-detection", title: "Edge Detection" },
      { id: "risk-reward", title: "Risk/Reward" },
      { id: "market-inefficiencies", title: "Inefficiencies" },
      { id: "smart-money", title: "Smart Money Signals" },
    ],
  },
];

export function DocsSidebar({
  activeSection,
  activeSubSection,
  onNavigate,
  isOpen,
  onClose,
}: {
  activeSection: string;
  activeSubSection?: string;
  onNavigate: (section: string, sub?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    docSections.forEach((s) => {
      init[s.id] = s.id === activeSection;
    });
    return init;
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-72 overflow-y-auto
          border-r border-ep-border bg-ep-surface/95 backdrop-blur-xl
          transition-transform duration-300 ease-in-out
          md:sticky md:top-20 md:z-10 md:h-[calc(100vh-5rem)] md:translate-x-0 md:bg-transparent md:border-0 md:backdrop-blur-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          no-scrollbar
        `}
      >
        <div className="p-4 md:p-0 md:pr-6">
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="mb-4 flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary md:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>

          <nav className="space-y-1">
            {docSections.map((section) => {
              const isActive = activeSection === section.id;
              const isExpanded = expanded[section.id];
              const hasChildren = section.children && section.children.length > 0;

              return (
                <div key={section.id}>
                  <button
                    onClick={() => {
                      if (hasChildren) {
                        toggleExpand(section.id);
                      }
                      onNavigate(section.id);
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={`
                      w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all
                      ${isActive
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                      }
                    `}
                  >
                    <span className="text-base">{section.icon}</span>
                    <span className="flex-1">{section.title}</span>
                    {hasChildren && (
                      <svg
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>

                  {/* Sub-items */}
                  {hasChildren && isExpanded && (
                    <div className="ml-9 mt-1 space-y-0.5 border-l border-ep-border pl-3">
                      {section.children!.map((child) => {
                        const isSubActive = activeSubSection === child.id;
                        return (
                          <button
                            key={child.id}
                            onClick={() => {
                              onNavigate(section.id, child.id);
                              if (window.innerWidth < 768) onClose();
                            }}
                            className={`
                              w-full text-left rounded-md px-3 py-1.5 text-[13px] transition-all
                              ${isSubActive
                                ? "text-accent bg-accent/5"
                                : "text-text-muted hover:text-text-secondary"
                              }
                            `}
                          >
                            {child.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
