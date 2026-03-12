"use client";

import React from "react";

type CalloutType = "tip" | "warning" | "success" | "error" | "info";

const calloutConfig: Record<
  CalloutType,
  { icon: string; label: string; border: string; bg: string; text: string }
> = {
  tip: {
    icon: "💡",
    label: "Tip",
    border: "border-accent/30",
    bg: "bg-accent/5",
    text: "text-accent",
  },
  warning: {
    icon: "⚠️",
    label: "Warning",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    text: "text-yellow-400",
  },
  success: {
    icon: "✅",
    label: "Success",
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    text: "text-green-400",
  },
  error: {
    icon: "❌",
    label: "Error",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-400",
  },
  info: {
    icon: "ℹ️",
    label: "Note",
    border: "border-blue-400/30",
    bg: "bg-blue-400/5",
    text: "text-blue-400",
  },
};

export function DocsCallout({
  type = "tip",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}) {
  const cfg = calloutConfig[type];
  return (
    <div
      className={`my-5 rounded-xl border-l-4 ${cfg.border} ${cfg.bg} px-5 py-4`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text} mb-1`}>
        <span>{cfg.icon}</span>
        <span>{title || cfg.label}</span>
      </div>
      <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
    </div>
  );
}
