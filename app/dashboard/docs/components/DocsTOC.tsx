"use client";

import React, { useEffect, useState } from "react";

export interface TOCItem {
  id: string;
  title: string;
  level: number; // 2 = h2, 3 = h3
}

export function DocsTOC({ items }: { items: TOCItem[] }) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0.1 }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="hidden xl:block sticky top-20 w-56 flex-shrink-0 max-h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar">
      <div className="border-l border-ep-border pl-4">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          On this page
        </p>
        <nav className="space-y-1.5">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`
                block text-[13px] leading-snug transition-colors
                ${item.level === 3 ? "pl-3" : ""}
                ${activeId === item.id
                  ? "text-accent font-medium"
                  : "text-text-muted hover:text-text-secondary"
                }
              `}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
