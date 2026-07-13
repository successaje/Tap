"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Screen } from "@/components/flow/screen";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { getUser, type AppUser } from "@/lib/auth";
import { markOnboarded } from "@/lib/store";
import { getUnifiedBalance, type UnifiedBalance } from "@/lib/particle";
import { formatCurrency, getExchangeRates } from "@/lib/currency";
import { getSettings, defaultSettings, type Settings } from "@/lib/settings";

/** (d) Success — balance confirmed + optional "add to home screen" prompt. */
export function SuccessScreen({
  balance,
  explorerUrl,
  onSend,
}: {
  balance: number;
  /** Set when the claim really settled on-chain. */
  explorerUrl?: string;
  onSend: () => void;
}) {
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);

  const [unified, setUnified] = useState<UnifiedBalance | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rates, setRates] = useState<Record<string, number>>({});

  // Post-hydration localStorage read; lazy init would mismatch SSR markup.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getUser());
    // Reaching success IS the "you're in" moment — skip the welcome later.
    markOnboarded();
    setSettings(getSettings());
    getExchangeRates().then(setRates);
  }, []);

  // Live unified balance across chains, once Particle is configured and the
  // user has a real embedded-wallet address.
  useEffect(() => {
    const address = getUser()?.address;
    if (!address) return;
    let cancelled = false;
    getUnifiedBalance(address).then((b) => {
      if (!cancelled && b) setUnified(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showInstall = !installed && !dismissed;

  return (
    <Screen className="px-6 pb-8 pt-16">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col items-center text-center"
      >
        <motion.div
          variants={{
            hidden: { scale: 0, opacity: 0 },
            show: { scale: 1, opacity: 1, transition: springs.bouncy },
          }}
          className="flex size-16 items-center justify-center rounded-full bg-green-100"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16a34a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </motion.div>

        <motion.p variants={rise} className="mt-6 text-slate-500">
          In your tap balance
        </motion.p>
        <motion.p
          variants={rise}
          className="mt-1 text-6xl font-semibold leading-none tracking-tighter tabular-nums text-slate-900"
        >
          {formatCurrency(balance, settings.currency, rates)}
        </motion.p>

        {user?.email && (
          <motion.div
            variants={rise}
            className="mt-5 flex items-center gap-2 rounded-full bg-slate-100 py-1.5 pl-1.5 pr-4"
          >
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                className="size-6 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                {(user.name || user.email)[0]?.toUpperCase()}
              </span>
            )}
            <span className="text-sm text-slate-600">{user.email}</span>
          </motion.div>
        )}

        <AnimatePresence>
          {unified && unified.totalUsd > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: springs.snappy }}
              className="mt-3 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-medium text-accent"
            >
              {formatCurrency(unified.totalUsd, settings.currency, rates)} unified across{" "}
              {unified.chainCount} chain{unified.chainCount === 1 ? "" : "s"}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.p
          variants={rise}
          className="mt-3 max-w-[16rem] text-sm text-slate-400"
        >
          Yours to spend or send. Settled on-chain — you&apos;d never know.
        </motion.p>

        {explorerUrl && (
          <motion.a
            variants={rise}
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            View the on-chain receipt ↗
          </motion.a>
        )}

        <AnimatePresence>
          {showInstall && (
            <motion.div
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { ...springs.snappy, delay: 0.25 },
              }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
              className="mt-auto w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"
            >
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/icon.svg"
                  alt=""
                  className="size-11 rounded-xl"
                />
                <div className="flex-1">
                  <p className="font-semibold">Keep tap on your phone</p>
                  <p className="mt-0.5 text-sm leading-snug text-slate-500">
                    {canInstall
                      ? "One tap to install. Opens full-screen, like an app."
                      : "Share → Add to Home Screen for the full-screen app."}
                  </p>
                </div>
              </div>
              {canInstall && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      haptic();
                      await promptInstall();
                    }}
                    className="h-10 flex-1 rounded-full bg-accent text-sm font-semibold text-white"
                  >
                    Add to home screen
                  </button>
                  <button
                    onClick={() => setDismissed(true)}
                    className="h-10 rounded-full px-4 text-sm font-medium text-slate-500"
                  >
                    Not now
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 28 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { ...springs.snappy, delay: 0.35 },
        }}
        whileTap={{ scale: 0.96 }}
        onClick={onSend}
        className="mt-4 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white"
      >
        Send money back
      </motion.button>
    </Screen>
  );
}
