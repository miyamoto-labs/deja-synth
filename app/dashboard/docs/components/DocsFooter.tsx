"use client";

import React, { useState } from "react";
import { docSections } from "./DocsSidebar";

export function DocsFooter({
  sectionId,
  onNavigate,
}: {
  sectionId: string;
  onNavigate: (section: string, sub?: string) => void;
}) {
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const currentIdx = docSections.findIndex((s) => s.id === sectionId);
  const prev = currentIdx > 0 ? docSections[currentIdx - 1] : null;
  const next = currentIdx < docSections.length - 1 ? docSections[currentIdx + 1] : null;

  return (
    <div className="mt-16 pt-8 border-t border-ep-border">
      {/* Feedback */}
      <div className="flex items-center justify-center gap-4 mb-10">
        {feedback === null ? (
          <>
            <span className="text-sm text-text-muted">Was this helpful?</span>
            <button
              onClick={() => setFeedback("yes")}
              className="flex items-center gap-1.5 rounded-lg border border-ep-border px-4 py-2 text-sm text-text-secondary hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
              </svg>
              Yes
            </button>
            <button
              onClick={() => setFeedback("no")}
              className="flex items-center gap-1.5 rounded-lg border border-ep-border px-4 py-2 text-sm text-text-secondary hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-1.302 4.666c-.245.403.028.959.5.959h1.053c.832 0 1.612-.453 1.918-1.227C20.705 12.16 21 10.86 21 9.375c0-1.553-.295-3.036-.831-4.398-.306-.774-1.086-1.227-1.918-1.227h-.908c-.445 0-.72.498-.523.898.097.197.187.397.27.602zm0 0a4.501 4.501 0 00-.654 3.375 8.958 8.958 0 011.302 4.665m-1.302-4.665H5.904m8.346 0c.483 0 .964.078 1.423.23l3.114 1.04a4.501 4.501 0 001.423.23h.958c.618 0 1.217-.247 1.605-.729A11.95 11.95 0 0024.75 12c0-.435-.023-.863-.068-1.285C24.573 9.694 23.654 9 22.628 9H19.5a.75.75 0 01-.725-1.282A7.471 7.471 0 0019.5 4.5 2.25 2.25 0 0017.25 2.25a.75.75 0 00-.75.75v.633c0 .573-.11 1.14-.322 1.672-.303.759-.93 1.331-1.653 1.715a9.04 9.04 0 00-2.861 2.4c-.498.634-1.225 1.08-2.031 1.08H8.25" />
              </svg>
              No
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-accent">✓</span>
            <span className="text-text-secondary">
              {feedback === "yes" ? "Glad it helped!" : "Thanks for the feedback. We'll improve this section."}
            </span>
          </div>
        )}
      </div>

      {/* Prev / Next navigation */}
      <div className="flex items-stretch justify-between gap-4">
        {prev ? (
          <button
            onClick={() => onNavigate(prev.id)}
            className="flex-1 flex items-center gap-3 rounded-xl border border-ep-border p-4 text-left hover:border-ep-border-bright hover:bg-white/[0.02] transition group"
          >
            <svg className="h-5 w-5 text-text-muted group-hover:text-accent transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <div>
              <div className="text-xs text-text-muted">Previous</div>
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition">
                {prev.icon} {prev.title}
              </div>
            </div>
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <button
            onClick={() => onNavigate(next.id)}
            className="flex-1 flex items-center justify-end gap-3 rounded-xl border border-ep-border p-4 text-right hover:border-ep-border-bright hover:bg-white/[0.02] transition group"
          >
            <div>
              <div className="text-xs text-text-muted">Next</div>
              <div className="text-sm font-medium text-text-primary group-hover:text-accent transition">
                {next.icon} {next.title}
              </div>
            </div>
            <svg className="h-5 w-5 text-text-muted group-hover:text-accent transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
