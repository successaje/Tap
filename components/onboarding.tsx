"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { markOnboarded, type MockUser } from "@/lib/store";

const points = [
  {
    icon: "🔑",
    title: "No seed phrase",
    body: "Your Google sign-in is your key. Nothing to write down, nothing to lose.",
  },
  {
    icon: "🌐",
    title: "One balance, every chain",
    body: "Hold and spend value from any chain as a single number. We handle the rest.",
  },
  {
    icon: "🔗",
    title: "Pay with a link",
    body: "Send money like you'd send a text. They tap, they've got it.",
  },
];

/**
 * First-run welcome — the "you now have an account" moment right after a
 * first Google sign-in. Sells the walletless model in three beats, then
 * drops the user into Home. Serves the onboarding/UX story directly.
 */
export function Onboarding({
  user,
  onDone,
}: {
  user: MockUser | null;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);

  function finish() {
    haptic(15);
    markOnboarded();
    setLeaving(true);
    setTimeout(onDone, 260);
  }

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.main
          className="flex flex-1 flex-col px-6 pb-8 pt-10"
          exit={{ opacity: 0, y: -16, transition: { duration: 0.25 } }}
        >
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-1 flex-col"
          >
            <motion.div variants={rise} className="flex flex-col items-center text-center">
              <RippleMark size={72} animate />
              <p className="mt-6 text-sm font-medium uppercase tracking-wide text-accent">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                You&apos;ve got a tap account
              </h1>
              <p className="mt-2 max-w-[17rem] text-sm text-slate-500">
                No app store, no wallet setup. It was ready the moment you
                signed in.
              </p>
            </motion.div>

            <div className="mt-10 space-y-3">
              {points.map((p) => (
                <motion.div
                  key={p.title}
                  variants={rise}
                  className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3.5"
                >
                  <span className="text-2xl" aria-hidden>
                    {p.icon}
                  </span>
                  <div>
                    <p className="font-semibold">{p.title}</p>
                    <p className="mt-0.5 text-sm leading-snug text-slate-500">
                      {p.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.4 } }}
            whileTap={{ scale: 0.97 }}
            onClick={finish}
            className="mt-8 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white"
          >
            Start using tap
          </motion.button>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
