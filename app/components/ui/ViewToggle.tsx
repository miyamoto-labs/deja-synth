"use client";

interface ViewToggleProps {
  view: "grid" | "calendar";
  onChange: (view: "grid" | "calendar") => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const btn = (v: "grid" | "calendar", children: React.ReactNode) => (
    <button
      onClick={() => onChange(v)}
      className={`p-1.5 rounded-md transition ${
        view === v
          ? "bg-accent/10 text-accent"
          : "text-text-muted hover:text-text-primary"
      }`}
      aria-label={v === "grid" ? "Grid view" : "Calendar view"}
    >
      {children}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 bg-ep-card border border-ep-border rounded-lg p-0.5">
      {btn(
        "grid",
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
          <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
        </svg>
      )}
      {btn(
        "calendar",
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <line x1="1.5" y1="6" x2="14.5" y2="6" />
          <line x1="5" y1="1" x2="5" y2="4" />
          <line x1="11" y1="1" x2="11" y2="4" />
        </svg>
      )}
    </div>
  );
}
