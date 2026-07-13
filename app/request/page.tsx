"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { springs, haptic } from "@/lib/motion";
import { getUser, type AppUser } from "@/lib/auth";
import { formatUsd } from "@/lib/mock";

/** Request money: share a link that opens prefilled pay for the other side. */
export default function RequestPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration storage read
    setUser(getUser() ?? null);
  }, []);

  const numeric = parseFloat(amount) || 0;

  function create() {
    if (!user?.address) return;
    haptic(20);
    const params = new URLSearchParams({
      to: user.address,
      from: user.name || "A friend",
    });
    if (numeric > 0) params.set("a", numeric.toFixed(2));
    if (note.trim()) params.set("n", note.trim());
    setCreated(`${window.location.origin}/pay?${params.toString()}`);
  }

  async function share(url: string) {
    haptic();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "tap",
          text:
            numeric > 0
              ? `Requesting ${formatUsd(numeric)} on tap`
              : "Pay me on tap",
          url,
        });
        return;
      } catch {
        /* cancelled — fall through */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (user === undefined) return null;

  return (
    <main className="flex flex-1 flex-col px-6 pb-6 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label="Close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="font-semibold">Request</p>
        <span className="size-9" />
      </header>

      {!user?.address ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-lg font-semibold">Sign in to request money</p>
          <p className="mt-2 max-w-[16rem] text-sm text-slate-500">
            Your request link points at your account, so sign in first.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 h-12 rounded-full bg-accent px-8 font-semibold text-white"
          >
            Go to sign in
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {!created ? (
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
                    numeric === 0 ? "text-slate-300" : "text-slate-900"
                  }`}
                >
                  {formatUsd(numeric)}
                </motion.p>
                <p className="mt-2 text-xs text-slate-400">
                  Leave at $0.00 to let them choose the amount
                </p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={40}
                  placeholder="What's it for?"
                  className="mt-4 rounded-full bg-slate-100 px-4 py-2 text-center text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <Keypad onKey={(k) => setAmount((p) => applyKey(p, k))} />

              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                onClick={create}
                className="mt-3 h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/25"
              >
                Create request
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
                🙌
              </motion.div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                Request ready
              </h2>
              <p className="mt-1 text-slate-500">
                {numeric > 0
                  ? `Asking for ${formatUsd(numeric)}`
                  : "They choose the amount"}
              </p>

              <button
                onClick={() => share(created)}
                className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
              >
                <p className="flex-1 truncate font-mono text-sm text-slate-600">
                  {created}
                </p>
                <span className="shrink-0 text-xs font-semibold text-accent">
                  {copied ? "Copied ✓" : "Copy"}
                </span>
              </button>

              <div className="mt-auto w-full space-y-2 pt-6">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => share(created)}
                  className="h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/25"
                >
                  {copied ? "Copied!" : "Share request"}
                </motion.button>
                <button
                  onClick={() => router.push("/")}
                  className="h-12 w-full rounded-full text-base font-medium text-slate-500"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </main>
  );
}
