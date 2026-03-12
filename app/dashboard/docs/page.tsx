"use client";

import React, { useState, useCallback, useEffect } from "react";
import { DocsSidebar, docSections } from "./components/DocsSidebar";
import { DocsSearch } from "./components/DocsSearch";
import { DocsBreadcrumb } from "./components/DocsBreadcrumb";
import { DocsTOC, type TOCItem } from "./components/DocsTOC";
import { DocsFooter } from "./components/DocsFooter";

// Content sections
import { GettingStartedContent, gettingStartedTOC } from "./content/getting-started";
import { PicksEngineContent, picksEngineTOC } from "./content/picks-engine";
import { PolytinderContent, polytinderTOC } from "./content/polytinder";
import { TraderDiscoveryContent, traderDiscoveryTOC } from "./content/trader-discovery";
import { PortfolioContent, portfolioTOC } from "./content/portfolio";
import { HowItWorksContent, howItWorksTOC } from "./content/how-it-works";
import { FAQContent, faqTOC } from "./content/faq";
import { AdvancedContent, advancedTOC } from "./content/advanced";

const sectionContentMap: Record<string, { component: React.FC; toc: TOCItem[] }> = {
  "getting-started": { component: GettingStartedContent, toc: gettingStartedTOC },
  "picks-engine": { component: PicksEngineContent, toc: picksEngineTOC },
  "polytinder": { component: PolytinderContent, toc: polytinderTOC },
  "trader-discovery": { component: TraderDiscoveryContent, toc: traderDiscoveryTOC },
  "portfolio": { component: PortfolioContent, toc: portfolioTOC },
  "how-it-works": { component: HowItWorksContent, toc: howItWorksTOC },
  "faq": { component: FAQContent, toc: faqTOC },
  "advanced": { component: AdvancedContent, toc: advancedTOC },
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [activeSubSection, setActiveSubSection] = useState<string | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = useCallback((section: string, sub?: string) => {
    setActiveSection(section);
    setActiveSubSection(sub);

    // Scroll to subsection if specified, otherwise scroll to top
    if (sub) {
      requestAnimationFrame(() => {
        const el = document.getElementById(sub);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  // Handle hash navigation on load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Find which section this hash belongs to
      for (const section of docSections) {
        if (section.id === hash) {
          setActiveSection(hash);
          return;
        }
        if (section.children) {
          for (const child of section.children) {
            if (child.id === hash) {
              setActiveSection(section.id);
              setActiveSubSection(hash);
              requestAnimationFrame(() => {
                document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
              });
              return;
            }
          }
        }
      }
    }
  }, []);

  const current = sectionContentMap[activeSection];
  const ContentComponent = current?.component ?? GettingStartedContent;
  const tocItems = current?.toc ?? gettingStartedTOC;

  return (
    <div className="pt-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-ep-border bg-ep-card/50 text-text-secondary hover:text-text-primary hover:border-ep-border-bright transition md:hidden"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
                <svg className="h-6 w-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                Documentation
              </h1>
              <p className="text-sm text-text-muted mt-0.5">
                Learn how to use Déjà to make smarter predictions
              </p>
            </div>
          </div>
          <DocsSearch onNavigate={handleNavigate} />
        </div>
      </div>

      {/* Main layout */}
      <div className="flex gap-8">
        {/* Sidebar */}
        <DocsSidebar
          activeSection={activeSection}
          activeSubSection={activeSubSection}
          onNavigate={handleNavigate}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <DocsBreadcrumb
            sectionId={activeSection}
            subSectionId={activeSubSection}
            onNavigate={handleNavigate}
          />

          <article className="prose-docs max-w-none">
            <ContentComponent />
          </article>

          <DocsFooter
            sectionId={activeSection}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Table of Contents */}
        <DocsTOC items={tocItems} />
      </div>
    </div>
  );
}
