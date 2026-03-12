"use client";

import React from "react";
import Link from "next/link";
import { docSections } from "./DocsSidebar";

export function DocsBreadcrumb({
  sectionId,
  subSectionId,
  onNavigate,
}: {
  sectionId: string;
  subSectionId?: string;
  onNavigate: (section: string, sub?: string) => void;
}) {
  const section = docSections.find((s) => s.id === sectionId);
  const subSection = section?.children?.find((c) => c.id === subSectionId);

  return (
    <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
      <Link
        href="/dashboard"
        className="hover:text-text-secondary transition"
      >
        Dashboard
      </Link>
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <button
        onClick={() => onNavigate("getting-started")}
        className="hover:text-text-secondary transition"
      >
        Docs
      </button>
      {section && (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => onNavigate(sectionId)}
            className={`transition ${subSection ? "hover:text-text-secondary" : "text-text-primary"}`}
          >
            {section.icon} {section.title}
          </button>
        </>
      )}
      {subSection && (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-primary">{subSection.title}</span>
        </>
      )}
    </nav>
  );
}
