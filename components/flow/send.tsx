"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen } from "@/components/flow/screen";
import { springs, haptic } from "@/lib/motion";
import { createLink } from "@/lib/store";
import { formatUsd, type PaymentLink } from "@/lib/mock";

type Phase = "compose" | "created";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

/** (e) Send — create a new payment link to pay someone back. */
export function SendScreen({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("compose");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState(false); // Share-button fallback feedback
  const [cardCopied, setCardCopied] = useState(false); // link-card tap feedback

  const numeric = parseFloat(amount) || 0;
  const canSend = numeric > 0;

  function press(key: string) {
    haptic(10);
    setAmount((prev) => {
      if (key === "⌫") {
        const next = prev.slice(0, -1);
        return next === "" ? "0" : next;
      }
      if (key === ".") {
        return prev.includes(".") ? prev : prev + ".";
      }
      // Limit to 2 decimals.
      if (prev.includes(".") && prev.split(".")[1]?.length >= 2) return prev;
      const next = prev === "0" ? key : prev + key;
      return next;
    });
  }

  function create() {
    if (!canSend) return;
    haptic(20);
    const l = createLink(numeric, note.trim());
    setLink(l);
    setPhase("created");
  }

  const shareUrl = link ? `https://tap.cash/t/${link.id}` : "";

  async function share() {
    haptic();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "tap",
          text: `I sent you ${formatUsd(numeric)} — tap to claim`,
          url: shareUrl,
        });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Screen className="px-6 pb-6 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label="Close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="font-semibold">Send money</p>
        <span className="size-9" />
      </header>

      <AnimatePresence mode="wait">
        {phase === "compose" ? (
          <motion.div
            key="compose"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
          >
            <div className="flex flex-1 flex-col items-center justify-center">
              <motion.p
                key={amount}
                initial={{ scale: 0.96 }}
                animate={{ scale: 1, transition: springs.bouncy }}
                className={`text-6xl font-semibold leading-none tracking-tighter tabular-nums ${
                  canSend ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {formatUsd(numeric)}
              </motion.p>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={40}
                placeholder="What's it for?"
                className="mt-4 rounded-full bg-slate-100 px-4 py-2 text-center text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-x-2 gap-y-1">
              {KEYS.map((k) => (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.9, backgroundColor: "rgb(241 245 249)" }}
                  onClick={() => press(k)}
                  className="h-14 rounded-2xl text-2xl font-medium tabular-nums text-slate-800"
                >
                  {k}
                </motion.button>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              onClick={create}
              disabled={!canSend}
              className="mt-3 h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/20 transition-opacity disabled:opacity-40"
            >
              Create link
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="created"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: springs.snappy }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: springs.bouncy }}
              className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-3xl"
            >
              🔗
            </motion.div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight">
              Link ready
            </h2>
            <p className="mt-1 text-slate-500">
              {formatUsd(numeric)} waiting to be claimed
            </p>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                haptic(10);
                await navigator.clipboard?.writeText(shareUrl).catch(() => {});
                setCardCopied(true);
                setTimeout(() => setCardCopied(false), 1600);
              }}
              className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
            >
              <p className="flex-1 truncate font-mono text-sm text-slate-600">
                {shareUrl}
              </p>
              <span className="shrink-0 text-xs font-semibold text-accent">
                {cardCopied ? "Copied ✓" : "Copy"}
              </span>
            </motion.button>
            <p className="mt-2 text-xs text-slate-400">
              Binds to whoever claims it first. Unclaimed in 7 days? It comes
              back to you.
            </p>

            <div className="mt-auto w-full space-y-2 pt-6">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={share}
                className="h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/20"
              >
                {copied ? "Copied!" : "Share link"}
              </motion.button>
              <button
                onClick={onClose}
                className="h-12 w-full rounded-full text-base font-medium text-slate-500"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}
