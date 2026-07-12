"use client";

import { motion } from "framer-motion";
import { Screen } from "@/components/flow/screen";
import { Logo } from "@/components/logo";
import { springs, stagger, rise } from "@/lib/motion";
import { daysUntilExpiry, formatUsd, type PaymentLink } from "@/lib/mock";

/** (a) Claim screen — recipient opens the link and sees what they've been sent. */
export function ClaimScreen({
  link,
  onContinue,
}: {
  link: PaymentLink;
  onContinue: () => void;
}) {
  const days = daysUntilExpiry(link);

  return (
    <Screen className="px-6 pb-6 pt-5">
      <header className="flex items-center justify-center">
        <Logo className="h-7" />
      </header>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <motion.div
          variants={rise}
          className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-accent"
          aria-hidden
        >
          {link.senderName[0]}
        </motion.div>

        <motion.p variants={rise} className="mt-5 text-lg text-slate-500">
          {link.senderName} sent you
        </motion.p>

        <motion.p
          variants={{
            hidden: { opacity: 0, y: 24, scale: 0.92 },
            show: { opacity: 1, y: 0, scale: 1, transition: springs.bouncy },
          }}
          className="mt-1 text-6xl font-semibold tracking-tight tabular-nums"
        >
          {formatUsd(link.amountUsd)}
        </motion.p>

        {link.note && (
          <motion.p
            variants={rise}
            className="mt-4 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600"
          >
            {link.note}
          </motion.p>
        )}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.35 } }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          onClick={onContinue}
          className="h-14 w-full rounded-full bg-accent text-lg font-semibold text-white shadow-lg shadow-accent/20"
        >
          Tap to claim
        </motion.button>
        <p className="text-sm text-slate-500">
          No wallet needed &middot; Sign in with Google
        </p>
        <p className="text-xs text-slate-400">
          {days > 0
            ? `This link expires in ${days} day${days === 1 ? "" : "s"}`
            : "This link has expired"}
        </p>
      </motion.footer>
    </Screen>
  );
}
