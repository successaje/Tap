"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Screen } from "@/components/flow/screen";
import { springs, haptic } from "@/lib/motion";
import { createLink, getUser } from "@/lib/store";
import { canSendReal, createFundedLink } from "@/lib/links";
import { getUnifiedBalance } from "@/lib/particle";
import { formatUsd } from "@/lib/mock";

type Phase = "compose" | "funding" | "created";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** (e) Send — create a payment link. When Particle is live, the link is a real
 * wallet and creating it genuinely moves money into it. */
export function SendScreen({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("compose");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false); // Share-button fallback feedback
  const [cardCopied, setCardCopied] = useState(false); // link-card tap feedback
  const [addrCopied, setAddrCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-money context (post-mount reads of storage + live balance).
  const [real, setReal] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe one-shot storage read
    setReal(canSendReal());
    const address = getUser()?.address;
    if (!address) return;
    setWallet(address);
    let cancelled = false;
    getUnifiedBalance(address).then((b) => {
      if (!cancelled && b) setAvailable(b.totalUsd);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const numeric = parseFloat(amount) || 0;
  const canSend =
    numeric > 0 && (!real || available === null || numeric <= available);

  function press(key: string) {
    haptic(10);
    setError(null);
    setAmount((prev) => {
      if (key === "⌫") {
        const next = prev.slice(0, -1);
        return next === "" ? "0" : next;
      }
      if (key === ".") {
        return prev.includes(".") ? prev : prev + ".";
      }
      if (prev.includes(".") && prev.split(".")[1]?.length >= 2) return prev;
      return prev === "0" ? key : prev + key;
    });
  }

  async function create() {
    if (!canSend) return;
    haptic(20);
    setError(null);

    if (!real) {
      const mock = createLink(numeric, note.trim());
      setShareUrl(`https://tap.cash/t/${mock.id}`);
      setPhase("created");
      return;
    }

    setPhase("funding");
    try {
      const link = await createFundedLink(numeric, note.trim() || undefined);
      setShareUrl(link.url);
      setExplorerUrl(link.explorerUrl);
      haptic([0, 30, 40, 60]);
      setPhase("created");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("compose");
    }
  }

  async function copy(text: string, done: (v: boolean) => void) {
    haptic(10);
    await navigator.clipboard?.writeText(text).catch(() => {});
    done(true);
    setTimeout(() => done(false), 1600);
  }

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
    await copy(shareUrl, setCopied);
  }

  return (
    <Screen className="px-6 pb-6 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label="Close"
          disabled={phase === "funding"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="font-semibold">Send money</p>
        <span className="size-9" />
      </header>

      <AnimatePresence mode="wait">
        {phase === "compose" && (
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
                  canSend || numeric === 0 ? "text-slate-900" : "text-red-400"
                } ${numeric === 0 ? "text-slate-300" : ""}`}
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

              {real && (
                <button
                  onClick={() => wallet && copy(wallet, setAddrCopied)}
                  className="mt-3 flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-500"
                >
                  {available !== null && (
                    <span className="font-semibold text-slate-700">
                      {formatUsd(available)} available
                    </span>
                  )}
                  {wallet && (
                    <span className="font-mono">
                      {addrCopied ? "address copied ✓" : shorten(wallet)}
                    </span>
                  )}
                </button>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 max-w-[19rem] text-center text-xs text-red-500"
                >
                  {error}
                </motion.p>
              )}
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
              className="mt-3 h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/25 transition-opacity disabled:opacity-40"
            >
              Create link
            </motion.button>
          </motion.div>
        )}

        {phase === "funding" && (
          <motion.div
            key="funding"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-3 rounded-full bg-accent"
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </div>
            <p className="mt-6 text-lg font-semibold">
              Securing {formatUsd(numeric)} in your link
            </p>
            <p className="mt-1 max-w-[16rem] text-sm text-slate-500">
              Moving real money — sourcing across chains, settling on Arbitrum.
              Usually under a minute.
            </p>
          </motion.div>
        )}

        {phase === "created" && (
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
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                Funded on-chain ↗
              </a>
            )}

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => copy(shareUrl, setCardCopied)}
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
                className="h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/25"
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
