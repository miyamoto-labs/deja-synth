"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SnakeGameState {
  highScore: number;
  bestCombo: number;
  totalXpEarned: number;
  totalRoundsPlayed: number;
  soundEnabled: boolean;

  updateHighScore: (score: number) => void;
  updateBestCombo: (combo: number) => void;
  addXp: (amount: number) => void;
  addRound: () => void;
  toggleSound: () => void;
}

export const useSnakeGameStore = create<SnakeGameState>()(
  persist(
    (set, get) => ({
      highScore: 0,
      bestCombo: 0,
      totalXpEarned: 0,
      totalRoundsPlayed: 0,
      soundEnabled: false, // muted by default on first visit

      updateHighScore: (score) => {
        if (score > get().highScore) set({ highScore: score });
      },
      updateBestCombo: (combo) => {
        if (combo > get().bestCombo) set({ bestCombo: combo });
      },
      addXp: (amount) => set((s) => ({ totalXpEarned: s.totalXpEarned + amount })),
      addRound: () => set((s) => ({ totalRoundsPlayed: s.totalRoundsPlayed + 1 })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
    }),
    {
      name: "ep-snake-game",
      partialize: (s) => ({
        highScore: s.highScore,
        bestCombo: s.bestCombo,
        totalXpEarned: s.totalXpEarned,
        totalRoundsPlayed: s.totalRoundsPlayed,
        soundEnabled: s.soundEnabled,
      }),
    }
  )
);
