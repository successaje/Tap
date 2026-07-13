"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { springs, stagger, rise } from "@/lib/motion";
import { formatUsd } from "@/lib/mock";

type Reason = "claimed" | "reclaimed" | "invalid";

const copy: Record<Reason, { emoji: string; title: string; body: string }> = {
  claimed: {
    emoji: "✅",
    title: "Already claimed",
    body: "This money has already landed in someone's account. Each link can only be claimed once.",
  },
  reclaimed: {
    emoji: "↩️",
    title: "Pulled back by the sender",
    body: "The sender reclaimed this before it was opened. Ask them to send a fresh link.",
  },
  invalid: {
    emoji: "🔗",
    title: "This link isn't valid",
    body: "It may have been mistyped. Ask the sender to share it again.",
  },
};

/** Terminal claim states — designed, not a raw error. */
export function ClaimUnavailable({
  reason,
  amountUsd,
  senderName,
}: {
  reason: Reason;
  amountUsd?: number;
  senderName?: string;
}) {
  const router = useRouter();
  const c = copy[reason];

  return (
    <motion.main
      className="flex flex-1 flex-col items-center px-6 pb-8 pt-6 text-center"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={rise} className="self-center">
        <Logo className="h-8" />
      </motion.div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div
          variants={{
            hidden: { scale: 0, opacity: 0 },
            show: { scale: 1, opacity: 1, transition: springs.bouncy },
          }}
          className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-4xl"
        >
          {c.emoji}
        </motion.div>

        {amountUsd ? (
          <motion.p
            variants={rise}
            className="mt-6 text-4xl font-semibold tracking-tighter tabular-nums text-slate-400 line-through"
          >
            {formatUsd(amountUsd)}
          </motion.p>
        ) : null}

        <motion.h1 variants={rise} className="mt-3 text-2xl font-semibold tracking-tight">
          {c.title}
        </motion.h1>
        <motion.p variants={rise} className="mt-2 max-w-[17rem] text-sm text-slate-500">
          {senderName && reason === "claimed"
            ? `The ${formatUsd(amountUsd ?? 0)} from ${senderName} is already spoken for. `
            : ""}
          {c.body}
        </motion.p>
      </div>

      <motion.button
        variants={rise}
        whileTap={{ scale: 0.97 }}
        onClick={() => router.push("/")}
        className="h-14 w-full rounded-full btn-tap text-lg font-semibold text-white"
      >
        Open tap
      </motion.button>
    </motion.main>
  );
}
