"use client";

import { motion } from "framer-motion";
import { haptic } from "@/lib/motion";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

/** Apply a keypad key to an amount string (max 2 decimals). */
export function applyKey(prev: string, key: string): string {
  if (key === "⌫") {
    const next = prev.slice(0, -1);
    return next === "" ? "0" : next;
  }
  if (key === ".") return prev.includes(".") ? prev : prev + ".";
  if (prev.includes(".") && prev.split(".")[1]?.length >= 2) return prev;
  return prev === "0" ? key : prev + key;
}

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-1">
      {KEYS.map((k) => (
        <motion.button
          key={k}
          whileTap={{ scale: 0.9, backgroundColor: "rgb(241 245 249)" }}
          onClick={() => {
            haptic(10);
            onKey(k);
          }}
          className="h-14 rounded-2xl text-2xl font-medium tabular-nums text-slate-800"
        >
          {k}
        </motion.button>
      ))}
    </div>
  );
}
