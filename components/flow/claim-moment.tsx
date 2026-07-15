"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "@/components/count-up";
import { springs, haptic } from "@/lib/motion";
import { formatCurrency, getExchangeRates } from "@/lib/currency";
import { getSettings, defaultSettings, type Settings } from "@/lib/settings";
import { friendlyError } from "@/lib/errors";
import type { PaymentLink } from "@/lib/mock";
import type { TransferReceipt } from "@/lib/particle";

type Phase = "ready" | "filling" | "processing" | "landed" | "error";

/** Celebration burst: small white dots radiating from the checkmark. */
function Burst() {
  const N = 10;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const dist = 90 + (i % 3) * 26;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: i % 2 ? 6 : 9, height: i % 2 ? 6 : 9 }}
            initial={{ x: 0, y: 0, opacity: 0.9, scale: 0.6 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 1,
            }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}

/**
 * (c) The claim moment. Tap the target → an accent ripple expands from the
 * exact touch point → (for real links: the on-chain sweep runs while a
 * processing state plays) → the amount counts up and a checkmark settles.
 */
export function ClaimMoment({
  link,
  claim,
  onDone,
}: {
  link: PaymentLink;
  /** When set, the claim is REAL: resolves once funds have moved on-chain. */
  claim?: () => Promise<TransferReceipt>;
  onDone: (receipt: TransferReceipt | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claimInFlight = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // Diameter large enough that a ripple from any point covers the whole shell.
  const [diameter, setDiameter] = useState(1200);

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    // Post-hydration reads of local prefs + rates (SSR can't see them).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(getSettings());
    getExchangeRates().then(setRates);
  }, []);

  function handleTap(e: React.PointerEvent) {
    if (phase !== "ready") return;
    const rect = shellRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setOrigin({ x, y });
      // Farthest corner from the tap point, doubled for the radius→diameter.
      const far = Math.max(
        Math.hypot(x, y),
        Math.hypot(rect.width - x, y),
        Math.hypot(x, rect.height - y),
        Math.hypot(rect.width - x, rect.height - y)
      );
      setDiameter(far * 2.1);
    }
    haptic(18);
    setPhase("filling");

    if (claim) {
      if (claimInFlight.current) return;
      claimInFlight.current = true;
      claim()
        .then((r) => {
          setReceipt(r);
          haptic([0, 30, 40, 60]);
          setPhase("landed");
        })
        .catch((err: unknown) => {
          claimInFlight.current = false;
          console.error("[tap:claim] claim error:", err);
          setError(friendlyError(err));
          setPhase("error");
        });
      // Once the ripple has filled, hold on "processing" until the sweep lands.
      window.setTimeout(
        () => setPhase((p) => (p === "filling" ? "processing" : p)),
        620
      );
    } else {
      // Mock claim: advance on a timer matched to the ripple duration.
      window.setTimeout(() => {
        haptic([0, 30, 40, 60]);
        setPhase("landed");
      }, 620);
    }
  }

  const landedAmount = receipt?.sentUsd ?? link.amountUsd;

  return (
    <motion.div
      ref={shellRef}
      className="absolute inset-0 overflow-hidden bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: springs.snappy }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* Ready state: the tap target */}
      <AnimatePresence>
        {phase === "ready" && (
          <motion.div
            key="target"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <p className="mb-1 text-slate-500">It&apos;s yours to claim</p>
            <motion.p
              layoutId="amount"
              className="mb-12 text-4xl font-semibold leading-none tracking-tighter tabular-nums text-slate-900"
            >
              {formatCurrency(link.amountUsd, settings.currency, rates)}
            </motion.p>

            {/* Gentle float invites the tap */}
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.button
                onPointerDown={handleTap}
                whileTap={{ scale: 0.93 }}
                transition={springs.snappy}
                className="relative flex size-56 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white shadow-xl shadow-accent/30"
              >
                {[0, 0.6].map((delay) => (
                  <motion.span
                    key={delay}
                    className="absolute inset-0 rounded-full border-2 border-accent"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.35, opacity: 0 }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeOut",
                      delay,
                    }}
                  />
                ))}
                Tap to claim
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanding ripple from the tap point */}
      {phase !== "ready" && phase !== "error" && (
        <motion.div
          className="absolute rounded-full bg-accent"
          style={{ left: origin.x, top: origin.y, x: "-50%", y: "-50%" }}
          initial={{ width: 0, height: 0 }}
          animate={{ width: diameter, height: diameter }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        />
      )}

      {/* Real claim in flight: hold on the wash while chains do their thing */}
      <AnimatePresence>
        {phase === "processing" && (
          <motion.div
            key="processing"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-3 rounded-full bg-white"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1, 0.85] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.18,
                  }}
                />
              ))}
            </div>
            <p className="mt-6 text-lg font-medium">Landing your money…</p>
            <p className="mt-1 text-sm text-white/70">
              Sourcing across chains &middot; settling on Arbitrum
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Landed: checkmark + count-up on the accent wash */}
      <AnimatePresence>
        {phase === "landed" && (
          <motion.div
            key="landed"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.05 } }}
          >
            <div className="relative">
              <Burst />
              <motion.div
                className="flex size-20 items-center justify-center rounded-full bg-white/20"
                initial={{ scale: 0 }}
                animate={{
                  scale: 1,
                  transition: { ...springs.bouncy, delay: 0.05 },
                }}
              >
                <motion.svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M20 6L9 17l-5-5"
                    initial={{ pathLength: 0 }}
                    animate={{
                      pathLength: 1,
                      transition: {
                        duration: 0.4,
                        delay: 0.15,
                        ease: "easeOut",
                      },
                    }}
                  />
                </motion.svg>
              </motion.div>
            </div>

            <motion.p
              className="mt-6 text-white/80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
            >
              Landed
            </motion.p>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{
                scale: 1,
                transition: { ...springs.bouncy, delay: 0.3 },
              }}
            >
              <CountUp
                to={landedAmount}
                duration={1}
                className="mt-1 block text-6xl font-semibold tracking-tighter"
              />
            </motion.div>
            {receipt && (
              <motion.p
                className="mt-3 text-sm text-white/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.8 } }}
              >
                Settled on Arbitrum &middot; for real
              </motion.p>
            )}

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { ...springs.snappy, delay: 1.2 },
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onDone(receipt)}
              className="absolute bottom-8 left-6 right-6 h-14 rounded-full bg-white text-lg font-semibold text-accent"
            >
              Continue
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real claim failed: explain and offer retry */}
      <AnimatePresence>
        {phase === "error" && (
          <motion.div
            key="error"
            className="absolute inset-0 flex flex-col items-center justify-center bg-white px-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-2xl">
              !
            </div>
            <p className="mt-5 text-lg font-semibold">
              The claim didn&apos;t go through
            </p>
            <p className="mt-2 max-w-[18rem] text-sm text-slate-500">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setPhase("ready");
              }}
              className="mt-6 h-12 rounded-full bg-accent px-8 font-semibold text-white"
            >
              Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
