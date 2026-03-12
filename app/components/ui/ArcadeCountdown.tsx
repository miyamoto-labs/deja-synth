"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface ArcadeCountdownProps {
  windowEndTimestamp: number; // Unix timestamp in seconds
  intervalMinutes?: number;
}

export function ArcadeCountdown({ windowEndTimestamp, intervalMinutes = 5 }: ArcadeCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, windowEndTimestamp - now);
      setTimeLeft(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100); // Update 10x per second for smooth countdown

    return () => clearInterval(interval);
  }, [windowEndTimestamp]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Casio retro style — red/orange when <1 min
  const isUrgent = timeLeft < 60;
  const isCritical = timeLeft < 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className={`relative font-mono text-4xl sm:text-5xl font-bold tracking-wider transition-all duration-200 ${
          isCritical
            ? "text-loss drop-shadow-[0_0_12px_rgba(255,82,82,0.6)]"
            : isUrgent
            ? "text-[#ff9500] drop-shadow-[0_0_8px_rgba(255,149,0,0.4)]"
            : "text-accent drop-shadow-[0_0_8px_rgba(0,240,160,0.3)]"
        }`}
        animate={
          isCritical
            ? {
                scale: [1, 1.05, 1],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          repeat: isCritical ? Infinity : 0,
          repeatType: "loop",
        }}
      >
        {/* Casio-style LCD segments */}
        <div className="relative flex items-center justify-center">
          <span className="tabular-nums">
            {String(minutes).padStart(2, "0")}
          </span>
          <motion.span
            className="mx-1"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "loop" }}
          >
            :
          </motion.span>
          <span className="tabular-nums">
            {String(seconds).padStart(2, "0")}
          </span>
        </div>

        {/* Retro LCD background glow */}
        <div
          className={`absolute inset-0 blur-xl opacity-20 ${
            isCritical
              ? "bg-loss"
              : isUrgent
              ? "bg-[#ff9500]"
              : "bg-accent"
          }`}
          aria-hidden="true"
        />
      </motion.div>

      <p className="text-[10px] sm:text-xs text-text-muted uppercase tracking-widest font-medium">
        Until Window Close
      </p>
    </div>
  );
}
