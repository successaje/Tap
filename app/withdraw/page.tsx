"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { Landmark, ArrowRightLeft, Check, X } from "lucide-react";

const rails = [
  { icon: Landmark, label: "Bank transfer", sub: "ACH / SEPA to your account" },
  { icon: ArrowRightLeft, label: "Debit card", sub: "Instant cash-out" },
];

export default function WithdrawPage() {
  const router = useRouter();
  const [notified, setNotified] = useState(false);

  return (
    <main className="flex min-h-[100dvh] flex-col bg-slate-50 px-6 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-200"
        >
          <X size={22} strokeWidth={2} />
        </button>
        <p className="font-semibold text-slate-900">Cash out</p>
        <span className="size-10" />
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <motion.div
          variants={rise}
          className="flex size-20 items-center justify-center rounded-3xl bg-blue-50 text-accent shadow-ios"
        >
          <Landmark size={32} strokeWidth={1.5} />
        </motion.div>

        <motion.span
          variants={rise}
          className="mt-6 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
        >
          Coming soon
        </motion.span>

        <motion.h1
          variants={rise}
          className="mt-4 text-3xl font-semibold tracking-tighter text-slate-900"
        >
          Cash out to your bank
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-2 max-w-[17rem] text-sm font-medium text-slate-500"
        >
          Move your balance to a bank account or debit card — settled from
          Arbitrum, no chains to think about. We&apos;re finishing the fiat rails.
        </motion.p>

        <motion.div variants={rise} className="mt-8 w-full space-y-2">
          {rails.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 text-left shadow-ios"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                <r.icon size={18} strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                <p className="text-xs font-medium text-slate-400">{r.sub}</p>
              </div>
              <span className="text-xs font-medium text-slate-300">Soon</span>
            </div>
          ))}
        </motion.div>
      </motion.section>

      <motion.button
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.3 } }}
        whileTap={{ scale: notified ? 1 : 0.97 }}
        onClick={() => {
          if (notified) return;
          haptic([0, 25, 30]);
          setNotified(true);
        }}
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-semibold transition-colors ${
          notified ? "bg-slate-100 text-slate-500" : "btn-tap text-white"
        }`}
      >
        {notified ? (
          <>
            <Check size={20} strokeWidth={2.5} /> We&apos;ll let you know
          </>
        ) : (
          "Notify me when it's ready"
        )}
      </motion.button>
    </main>
  );
}
