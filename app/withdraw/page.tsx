"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { springs, haptic } from "@/lib/motion";
import { formatLocalInput } from "@/lib/mock";
import { Building2, Check, X } from "lucide-react";

type Phase = "amount" | "processing" | "success";

export default function WithdrawPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("amount");
  const [amount, setAmount] = useState("0");
  
  const numericLocal = parseFloat(amount) || 0;
  const canWithdraw = numericLocal > 0;

  function press(key: string) {
    setAmount((prev) => applyKey(prev, key));
  }

  async function withdraw() {
    if (!canWithdraw) return;
    haptic(20);
    setPhase("processing");
    
    // Simulate fiat offramp delay
    await new Promise(r => setTimeout(r, 2500));
    
    haptic([0, 30, 40, 60]);
    setPhase("success");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center justify-between px-6 pt-5">
        <button
          onClick={() => router.push("/")}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 active:bg-slate-50 transition-colors"
          disabled={phase === "processing"}
        >
          <X size={22} strokeWidth={2} />
        </button>
        <p className="font-semibold text-slate-900">Withdraw to Bank</p>
        <span className="size-10" />
      </header>

      <AnimatePresence mode="wait">
        {phase === "amount" && (
          <motion.div
            key="amount"
            className="flex flex-1 flex-col px-6 pb-8"
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
                  canWithdraw ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {formatLocalInput(numericLocal)}
              </motion.p>
              
              <button 
                onClick={() => {
                  haptic(10);
                  setAmount("27500");
                }}
                className="mt-4 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-semibold text-slate-500 active:scale-95 transition-transform"
              >
                Use Max
              </button>
              
              <div className="mt-8 flex items-center gap-3 rounded-full border border-slate-100 bg-white p-2 pr-4 shadow-ios">
                <div className="flex size-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                  <Building2 size={16} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Chase Bank</p>
                  <p className="text-[10px] text-slate-400">Checking ****1234</p>
                </div>
              </div>
            </div>

            <Keypad onKey={press} />

            <motion.button
              whileTap={{ scale: 0.97 }}
              transition={springs.snappy}
              onClick={withdraw}
              disabled={!canWithdraw}
              className="mt-6 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white transition-opacity disabled:opacity-40"
            >
              Withdraw
            </motion.button>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            className="flex flex-1 flex-col items-center justify-center text-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex gap-2" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-3 rounded-full bg-accent"
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </div>
            <p className="mt-8 text-xl font-semibold tracking-tight text-slate-900">
              Selling USDC...
            </p>
            <p className="mt-2 max-w-[16rem] text-sm text-slate-500">
              Initiating ACH transfer to Chase Bank. This usually takes a few seconds.
            </p>
          </motion.div>
        )}

        {phase === "success" && (
          <motion.div
            key="success"
            className="flex flex-1 flex-col items-center justify-center text-center px-6"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0, transition: springs.snappy }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: springs.bouncy }}
              className="flex size-20 items-center justify-center rounded-full bg-green-50 text-green-500 shadow-ios"
            >
              <Check size={32} strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
              Transfer started
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {formatLocalInput(numericLocal)} is on its way to your bank.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              It usually arrives by tomorrow morning.
            </p>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/")}
              className="mt-12 h-14 w-full rounded-full bg-slate-100 text-lg font-semibold text-slate-800"
            >
              Done
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
