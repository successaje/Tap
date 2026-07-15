"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, type AppUser } from "@/lib/auth";
import { magicUaSigner } from "@/lib/magic";
import { particleEnabled, transferOnArbitrum, getUnifiedBalance } from "@/lib/particle";
import { recordActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/errors";
import { formatUsd, formatLocalInput, localToUsd, usdToLocal } from "@/lib/mock";
import { Landmark, CreditCard, Wallet, Check, X, ArrowLeft, ClipboardPaste } from "lucide-react";

type Phase = "method" | "address" | "amount" | "sending" | "sent" | "error";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());

export default function WithdrawPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("method");
  const [user, setUser] = useState<AppUser | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- post-hydration reads */
    const u = getUser();
    setUser(u);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!u?.address) return;
    let cancelled = false;
    getUnifiedBalance(u.address).then((b) => {
      if (!cancelled && b) setAvailable(b.totalUsd);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const numericLocal = parseFloat(amount) || 0;
  const numericUsd = localToUsd(numericLocal);
  const destValid = isAddress(dest);
  const selfSend = destValid && dest.trim().toLowerCase() === user?.address?.toLowerCase();
  const canSend =
    numericLocal > 0 && (available === null || numericUsd <= available);

  async function paste() {
    haptic(10);
    try {
      const text = await navigator.clipboard.readText();
      if (text) setDest(text.trim());
    } catch {
      /* clipboard read denied — user can type */
    }
  }

  async function send() {
    if (!canSend || !destValid || !user?.address) return;
    haptic(20);
    setError(null);
    setPhase("sending");
    try {
      let url: string | null = null;
      if (particleEnabled) {
        const receipt = await transferOnArbitrum(
          user.address,
          dest.trim(),
          numericUsd,
          magicUaSigner()
        );
        url = receipt.explorerUrl;
      } else {
        await new Promise((r) => setTimeout(r, 1400)); // mock fallback
      }
      recordActivity({
        type: "sent",
        amountUsd: numericUsd,
        counterparty: shorten(dest.trim()),
        note: "sent to address",
        status: "settled",
        explorerUrl: url ?? undefined,
      });
      haptic([0, 30, 40, 60]);
      setExplorerUrl(url);
      setPhase("sent");
    } catch (err) {
      console.error("[tap:withdraw] send error:", err);
      setError(friendlyError(err));
      setPhase("error");
    }
  }

  const rails = [
    {
      icon: Wallet,
      label: "Crypto address",
      sub: "USDC on Arbitrum · from your one balance",
      live: true,
      onClick: () => {
        haptic(10);
        setPhase("address");
      },
    },
    { icon: Landmark, label: "Bank transfer", sub: "ACH / SEPA to your account", live: false },
    { icon: CreditCard, label: "Debit card", sub: "Instant cash-out", live: false },
  ];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-slate-50 px-6 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            haptic(10);
            if (phase === "address") setPhase("method");
            else if (phase === "amount") setPhase("address");
            else router.push("/");
          }}
          disabled={phase === "sending"}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-200"
          aria-label={phase === "method" ? "Close" : "Back"}
        >
          {phase === "method" || phase === "sent" ? (
            <X size={22} strokeWidth={2} />
          ) : (
            <ArrowLeft size={22} strokeWidth={2} />
          )}
        </button>
        <p className="font-semibold text-slate-900">Cash out</p>
        <span className="size-10" />
      </header>

      <AnimatePresence mode="wait">
        {phase === "method" && (
          <motion.div
            key="method"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
            className="flex flex-1 flex-col"
          >
            <motion.p variants={rise} className="mt-8 text-center text-sm font-medium text-slate-500">
              Move money out of tap
              {available !== null && (
                <span className="mt-1 block text-2xl font-semibold tracking-tight text-slate-900">
                  {formatUsd(available)} available
                </span>
              )}
            </motion.p>

            <motion.div variants={rise} className="mt-8 space-y-2">
              {rails.map((r) => (
                <button
                  key={r.label}
                  disabled={!r.live}
                  onClick={r.onClick}
                  className={`flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 text-left shadow-ios transition-transform ${
                    r.live ? "active:scale-[0.98]" : "opacity-70"
                  }`}
                >
                  <div
                    className={`flex size-10 items-center justify-center rounded-2xl ${
                      r.live ? "bg-blue-50 text-accent" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <r.icon size={18} strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                    <p className="text-xs font-medium text-slate-400">{r.sub}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      r.live ? "text-accent" : "text-slate-300"
                    }`}
                  >
                    {r.live ? "→" : "Soon"}
                  </span>
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}

        {phase === "address" && (
          <motion.div
            key="address"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: springs.snappy }}
            exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }}
            className="flex flex-1 flex-col"
          >
            <div className="flex flex-1 flex-col justify-center">
              <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
                Where to?
              </h2>
              <p className="mx-auto mt-2 max-w-[18rem] text-center text-sm text-slate-500">
                Paste any wallet or exchange deposit address. Arrives as USDC on
                Arbitrum.
              </p>

              <div className="mt-8 flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-2 pl-4 shadow-ios">
                <input
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  placeholder="0x…"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-300"
                />
                <button
                  onClick={paste}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-600 active:scale-95"
                >
                  <ClipboardPaste size={14} /> Paste
                </button>
              </div>

              {dest.length > 0 && !destValid && (
                <p className="mt-3 text-center text-xs font-medium text-red-500">
                  That doesn&apos;t look like a valid address (0x + 40 characters).
                </p>
              )}
              {selfSend && (
                <p className="mt-3 text-center text-xs font-medium text-amber-600">
                  That&apos;s your own tap address — the money would come right back.
                </p>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptic(10);
                setPhase("amount");
              }}
              disabled={!destValid || selfSend}
              className="h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
            >
              Continue
            </motion.button>
          </motion.div>
        )}

        {phase === "amount" && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: springs.snappy }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="flex flex-1 flex-col"
          >
            <div className="flex flex-1 flex-col items-center justify-center">
              <motion.p
                key={amount}
                initial={{ scale: 0.96 }}
                animate={{ scale: 1, transition: springs.bouncy }}
                className={`text-6xl font-semibold leading-none tracking-tighter tabular-nums ${
                  numericLocal === 0
                    ? "text-slate-300"
                    : canSend
                      ? "text-slate-900"
                      : "text-red-400"
                }`}
              >
                {formatLocalInput(numericLocal)}
              </motion.p>

              <p className="mt-3 rounded-full bg-white px-4 py-1.5 font-mono text-xs text-slate-500 shadow-ios">
                to {shorten(dest.trim())}
              </p>

              {available !== null && available > 0.1 && (
                <button
                  onClick={() => {
                    haptic(10);
                    const maxUsd = Math.max(0, available - Math.max(0.08, available * 0.02));
                    setAmount((Math.floor(usdToLocal(maxUsd) * 100) / 100).toFixed(2));
                  }}
                  className="mt-3 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-500 active:scale-95"
                >
                  Send max
                </button>
              )}
            </div>

            <Keypad onKey={(k) => setAmount((p) => applyKey(p, k))} />

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={send}
              disabled={!canSend}
              className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
            >
              Send {numericLocal > 0 ? formatUsd(numericUsd) : ""}
            </motion.button>
          </motion.div>
        )}

        {phase === "sending" && (
          <motion.div
            key="sending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <RippleMark size={56} animate />
            <p className="mt-6 text-lg font-semibold text-slate-900">
              Sending {formatUsd(numericUsd)}…
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sourcing across chains &middot; settling on Arbitrum
            </p>
          </motion.div>
        )}

        {phase === "sent" && (
          <motion.div
            key="sent"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: springs.snappy }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: springs.bouncy }}
              className="flex size-20 items-center justify-center rounded-full bg-green-50 text-green-500 shadow-ios"
            >
              <Check size={32} strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
              Sent {formatUsd(numericUsd)}
            </h2>
            <p className="mt-1 font-mono text-sm text-slate-500">
              to {shorten(dest.trim())}
            </p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                View the on-chain receipt ↗
              </a>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/")}
              className="mt-12 h-14 w-full rounded-full bg-slate-100 text-lg font-semibold text-slate-800"
            >
              Done
            </motion.button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center px-2 text-center"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-2xl">
              !
            </div>
            <p className="mt-5 text-lg font-semibold text-slate-900">
              The transfer didn&apos;t go through
            </p>
            <p className="mt-2 max-w-[19rem] text-sm text-slate-500">{error}</p>
            <p className="mt-1 text-xs text-slate-400">
              No money left your account.
            </p>
            <button
              onClick={() => setPhase("amount")}
              className="mt-6 h-12 rounded-full btn-tap px-8 font-semibold text-white"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
