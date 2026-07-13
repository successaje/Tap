"use client";

import { motion } from "framer-motion";
import { Copy, Gift, Share } from "lucide-react";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { useState } from "react";

export default function RewardsPage() {
  const [copied, setCopied] = useState(false);
  const referralLink = "tap.cash/r/finisher";

  async function copyLink() {
    haptic(10);
    await navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-28 pt-5">
      <header className="flex items-center justify-center">
        <p className="font-semibold tracking-tight text-slate-800">Rewards</p>
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-8 flex flex-col items-center text-center"
      >
        <motion.div variants={rise} className="flex size-20 items-center justify-center rounded-3xl bg-blue-50 text-accent shadow-ios">
          <Gift size={32} strokeWidth={1.5} />
        </motion.div>
        
        <motion.h1 variants={rise} className="mt-6 text-4xl font-semibold tracking-tighter text-slate-900">
          Tap Gold
        </motion.h1>
        <motion.p variants={rise} className="mt-2 text-sm font-medium text-slate-500">
          You are in the top 5% of earners.
        </motion.p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.2 } }}
        className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-ios text-center"
      >
        <p className="text-sm font-medium text-slate-400">Total Points</p>
        <p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums text-slate-900">
          14,250
        </p>
        
        <div className="mt-8 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[70%] bg-accent rounded-full shadow-[0_0_10px_rgba(15,82,255,0.5)]" />
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-400 text-left">
          3,250 pts to Tap Platinum
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.3 } }}
        className="mt-10"
      >
        <h2 className="text-sm font-semibold text-slate-900">Invite Friends</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">Earn 500 points for every friend who sends their first link.</p>
        
        <div className="mt-4 flex items-center gap-3">
          <button 
            onClick={copyLink}
            className="flex h-14 flex-1 items-center justify-between rounded-full border border-slate-100 bg-white px-5 shadow-sm active:scale-95 transition-transform"
          >
            <span className="font-mono text-sm font-medium text-slate-600">{referralLink}</span>
            {copied ? <span className="text-xs font-semibold text-accent">Copied!</span> : <Copy size={16} className="text-slate-400" />}
          </button>
          
          <button 
            className="flex size-14 items-center justify-center rounded-full btn-tap text-white active:scale-95 transition-transform"
            onClick={() => haptic()}
          >
            <Share size={18} strokeWidth={2} />
          </button>
        </div>
      </motion.section>
    </main>
  );
}
