"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, beginGoogleLogin, authEnabled, type AppUser } from "@/lib/auth";
import { magicUaSigner } from "@/lib/magic";
import { particleEnabled, transferOnArbitrum } from "@/lib/particle";
import { recordActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/errors";
import { formatUsd, formatLocalInput, localToUsd, usdToLocal } from "@/lib/mock";

interface PayRequest {
  to: string;
  from: string;
  amountUsd: number; // 0 ⇒ payer chooses
  note?: string;
}

type Phase = "view" | "paying" | "paid" | "error";

/** Pay a request link: /pay?to=0x…&from=Maya&a=5.00&n=coffee */
export default function PayPage() {
  const router = useRouter();
  const [req, setReq] = useState<PayRequest | null | undefined>(undefined);
  const [user, setUser] = useState<AppUser | null>(null);
  const [amount, setAmount] = useState("0");
  const [phase, setPhase] = useState<Phase>("view");
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- post-hydration URL + storage read */
    const q = new URLSearchParams(window.location.search);
    const to = q.get("to");
    if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
      setReq(null);
      return;
    }
    const amountUsd = Number(q.get("a")) || 0;
    setReq({
      to,
      from: q.get("from") || "Someone",
      amountUsd,
      note: q.get("n") || undefined,
    });
    if (amountUsd > 0) setAmount(usdToLocal(amountUsd).toFixed(2));
    setUser(getUser());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const numericLocal = parseFloat(amount) || 0;
  const numericUsd = localToUsd(numericLocal);
  const fixed = (req?.amountUsd ?? 0) > 0;

  async function signIn() {
    if (loggingIn) return;
    setLoggingIn(true);
    haptic();
    try {
      await beginGoogleLogin(); // returns to this exact URL
    } catch {
      setLoggingIn(false);
    }
  }

  async function pay() {
    if (!req || numericLocal <= 0) return;
    haptic(20);
    setPhase("paying");
    try {
      let url: string | null = null;
      if (particleEnabled && user?.address) {
        const receipt = await transferOnArbitrum(
          user.address,
          req.to,
          numericUsd,
          magicUaSigner()
        );
        url = receipt.explorerUrl;
      } else {
        // Mock fallback keeps the flow demoable without credentials.
        await new Promise((r) => setTimeout(r, 1400));
      }
      recordActivity({
        type: "sent",
        amountUsd: numericUsd,
        counterparty: req.from,
        note: req.note,
        status: "settled",
        explorerUrl: url ?? undefined,
      });
      setExplorerUrl(url);
      haptic([0, 30, 40, 60]);
      setPhase("paid");
    } catch (err) {
      console.error("[tap:pay] pay error:", err);
      setError(friendlyError(err));
      setPhase("error");
    }
  }

  if (req === undefined) return null;

  if (req === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-lg font-semibold">This request isn&apos;t valid</p>
        <p className="mt-2 text-sm text-slate-500">
          Ask for a fresh link and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-5">
      <header className="flex items-center justify-center">
        <p className="font-semibold">Pay {req.from}</p>
      </header>

      <AnimatePresence mode="wait">
        {phase === "view" && (
          <motion.div
            key="view"
            className="flex flex-1 flex-col"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <motion.div
                variants={rise}
                className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-accent"
                aria-hidden
              >
                {req.from[0]}
              </motion.div>
              <motion.p variants={rise} className="mt-5 text-lg text-slate-500">
                {req.from} {fixed ? "requests" : "wants to get paid"}
              </motion.p>
              <motion.p
                variants={rise}
                className={`mt-1 text-6xl font-semibold leading-none tracking-tighter tabular-nums ${
                  numericLocal === 0 ? "text-slate-300" : "text-slate-900"
                }`}
              >
                {formatLocalInput(numericLocal)}
              </motion.p>
              {req.note && (
                <motion.p
                  variants={rise}
                  className="mt-4 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600"
                >
                  {req.note}
                </motion.p>
              )}
            </div>

            {!fixed && <Keypad onKey={(k) => setAmount((p) => applyKey(p, k))} />}

            {user ? (
              <motion.button
                variants={rise}
                whileTap={{ scale: 0.96 }}
                onClick={pay}
                disabled={numericLocal <= 0}
                className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
              >
                Pay {numericLocal > 0 ? formatUsd(numericUsd) : ""}
              </motion.button>
            ) : (
              <motion.button
                variants={rise}
                whileTap={{ scale: 0.96 }}
                onClick={signIn}
                disabled={loggingIn || !authEnabled}
                className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-70"
              >
                {loggingIn ? "Opening Google…" : "Sign in to pay"}
              </motion.button>
            )}
            <p className="mt-3 text-center text-xs text-slate-400">
              Paid from your one balance &middot; settles on Arbitrum
            </p>
          </motion.div>
        )}

        {phase === "paying" && (
          <motion.div
            key="paying"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <RippleMark size={56} animate />
            <p className="mt-6 text-lg font-semibold">
              Paying {formatUsd(numericUsd)}…
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sourcing across chains &middot; settling on Arbitrum
            </p>
          </motion.div>
        )}

        {phase === "paid" && (
          <motion.div
            key="paid"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: springs.bouncy }}
              className="flex size-16 items-center justify-center rounded-full bg-green-100"
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.div>
            <p className="mt-5 text-2xl font-semibold tracking-tight">
              Paid {formatUsd(numericUsd)}
            </p>
            <p className="mt-1 text-slate-500">to {req.from}</p>
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
            <button
              onClick={() => router.push("/")}
              className="mt-8 h-12 rounded-full bg-accent px-10 font-semibold text-white"
            >
              Done
            </button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-2xl">
              !
            </div>
            <p className="mt-5 text-lg font-semibold">Payment didn&apos;t go through</p>
            <p className="mt-2 max-w-[18rem] text-sm text-slate-500">{error}</p>
            <button
              onClick={() => setPhase("view")}
              className="mt-6 h-12 rounded-full bg-accent px-8 font-semibold text-white"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
