"use client";

import React, { useState, useRef, useEffect } from "react";
import { docSections } from "./DocsSidebar";

interface SearchResult {
  sectionId: string;
  subId?: string;
  title: string;
  sectionTitle: string;
  icon: string;
}

// Build a flat index of all navigable items
function buildSearchIndex(): SearchResult[] {
  const results: SearchResult[] = [];
  for (const section of docSections) {
    results.push({
      sectionId: section.id,
      title: section.title,
      sectionTitle: section.title,
      icon: section.icon,
    });
    if (section.children) {
      for (const child of section.children) {
        results.push({
          sectionId: section.id,
          subId: child.id,
          title: child.title,
          sectionTitle: section.title,
          icon: section.icon,
        });
      }
    }
  }
  return results;
}

const searchIndex = buildSearchIndex();

export function DocsSearch({
  onNavigate,
}: {
  onNavigate: (section: string, sub?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? searchIndex.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.sectionTitle.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIdx]) {
      const r = results[selectedIdx];
      onNavigate(r.sectionId, r.subId);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIdx(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search docs..."
          className="w-full rounded-xl border border-ep-border bg-ep-surface/50 py-2.5 pl-10 pr-16 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20 transition"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 rounded-md border border-ep-border bg-ep-card px-1.5 py-0.5 text-[10px] text-text-muted font-mono">
          ⌘K
        </kbd>
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-ep-border bg-ep-card shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto py-2">
            {results.map((result, idx) => (
              <button
                key={`${result.sectionId}-${result.subId || "root"}`}
                onClick={() => {
                  onNavigate(result.sectionId, result.subId);
                  setQuery("");
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition
                  ${idx === selectedIdx ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-white/5"}
                `}
              >
                <span className="text-base">{result.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary truncate">{result.title}</div>
                  {result.subId && (
                    <div className="text-xs text-text-muted">{result.sectionTitle}</div>
                  )}
                </div>
                <svg className="h-3.5 w-3.5 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-ep-border bg-ep-card shadow-xl z-50 p-6 text-center">
          <p className="text-sm text-text-muted">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
