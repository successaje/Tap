"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { PaymentQR } from "@/components/qr";
import { springs, haptic } from "@/lib/motion";
import { getUser, type AppUser } from "@/lib/auth";
import { createSplit } from "@/lib/split";
import { formatUsd, formatLocalInput, localToUsd } from "@/lib/mock";

/** Request money: share a link that opens prefilled pay for the other side.
 * "Split with others" is the same idea extended to more than one payer — a
 * durable, shared progress record (lib/split.ts) instead of a fixed amount
 * only one person is expected to fulfill. */
export default function RequestPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [split, setSplit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration storage read
    setUser(getUser() ?? null);
  }, []);

  const numericLocal = parseFloat(amount) || 0;
  const numericUsd = localToUsd(numericLocal);
  const canCreate = !split || numericUsd > 0;

  async function create() {
    if (!user?.address || !canCreate || creating) return;
    haptic(20);

    if (split) {
      setCreating(true);
      setSplitError(null);
      const result = await createSplit(user.address, user.name || "Someone", numericUsd, note.trim() || undefined);
      setCreating(false);
      if (!result.ok || !result.id) {
        setSplitError("Couldn't create the split — try again.");
        return;
      }
      setCreated(`${window.location.origin}/pay?splitId=${result.id}`);
      return;
    }

    const params = new URLSearchParams({
      to: user.address,
      from: user.name || "A friend",
    });
    if (numericUsd > 0) params.set("a", numericUsd.toFixed(2));
    if (note.trim()) params.set("n", note.trim());
    setCreated(`${window.location.origin}/pay?${params.toString()}`);
  }

  async function share(url: string) {
    haptic();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "tap",
          text: split
            ? `Chip in toward ${formatUsd(numericUsd)} on tap`
            : numericLocal > 0
              ? `Requesting ${formatUsd(numericUsd)} on tap`
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
        <p className="font-semibold">{split ? "Split" : "Request"}</p>
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
                    numericLocal === 0 ? "text-slate-300" : "text-slate-900"
                  }`}
                >
                  {formatLocalInput(numericLocal)}
                </motion.p>
                <p className="mt-2 text-xs text-slate-400">
                  {split
                    ? "The target everyone's contributing toward"
                    : "Leave at $0.00 to let them choose the amount"}
                </p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={40}
                  placeholder="What's it for?"
                  className="mt-4 rounded-full bg-slate-100 px-4 py-2 text-center text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />

                <button
                  onClick={() => {
                    haptic(10);
                    setSplit((s) => !s);
                    setSplitError(null);
                  }}
                  className={`mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    split ? "bg-accent text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <span
                    className={`flex size-4 items-center justify-center rounded-full border ${
                      split ? "border-white bg-white/20" : "border-slate-300"
                    }`}
                  >
                    {split && "✓"}
                  </span>
                  Split with others
                </button>
                {splitError && (
                  <p className="mt-2 text-xs font-medium text-red-500">{splitError}</p>
                )}
              </div>

              <Keypad onKey={(k) => setAmount((p) => applyKey(p, k))} />

              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={springs.snappy}
                onClick={create}
                disabled={!canCreate || creating}
                className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
              >
                {creating ? "Creating…" : split ? "Create split" : "Create request"}
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
                {split ? "Split ready" : "Request ready"}
              </h2>
              <p className="mt-1 text-slate-500">
                {split
                  ? `Collecting toward ${formatUsd(numericUsd)} — anyone with this link can chip in`
                  : numericLocal > 0
                    ? `Asking for ${formatUsd(numericUsd)}`
                    : "They choose the amount"}
              </p>

              <div className="mt-6">
                <PaymentQR value={created} caption={split ? "Scan to chip in" : "Scan to pay you"} />
              </div>

              <button
                onClick={() => share(created)}
                className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
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
                  className="h-14 w-full rounded-full btn-tap text-lg font-semibold text-white"
                >
                  {copied ? "Copied!" : split ? "Share split" : "Share request"}
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
