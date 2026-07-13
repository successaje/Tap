"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/motion";
import { X, Send, Sparkles, Receipt, RefreshCw, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  // Portal to <body> so the sheet sits above the floating nav (see ReceiveSheet).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const fastActions = [
    { label: "Missing transfer", icon: Receipt },
    { label: "Change currency", icon: RefreshCw },
    { label: "Account help", icon: HelpCircle },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", damping: 25, stiffness: 200 } }}
            exit={{ y: "100%", transition: { type: "spring", damping: 25, stiffness: 200 } }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white px-6 pb-12 pt-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-accent">
                  <Sparkles size={16} strokeWidth={2} />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">AI Support</h2>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-8">
              <p className="text-[32px] font-semibold leading-tight tracking-tight text-slate-900">
                How can we help?
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Ask me anything about your account, transactions, or Tap features.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {fastActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      haptic(10);
                      setMsg(action.label);
                    }}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm active:scale-95 transition-transform"
                  >
                    <action.icon size={14} strokeWidth={2.5} className="text-accent" />
                    {action.label}
                  </button>
                ))}
              </div>

              <div className="mt-8 relative">
                <input
                  type="text"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  placeholder="Message AI Support..."
                  className="h-14 w-full rounded-full border border-slate-200 bg-slate-50 pl-5 pr-14 text-sm font-medium text-slate-900 outline-none focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10 transition-all placeholder:text-slate-400"
                  disabled={loading}
                />
                <button
                  className={`absolute right-2 top-2 flex size-10 items-center justify-center rounded-full transition-colors ${
                    msg.trim().length > 0 || loading ? "bg-accent text-white shadow-md shadow-accent/25" : "bg-slate-200 text-slate-400"
                  }`}
                  disabled={msg.trim().length === 0 || loading}
                  onClick={() => {
                    haptic(15);
                    setLoading(true);
                    setTimeout(() => {
                      setLoading(false);
                      setMsg("");
                    }, 1500);
                  }}
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="size-4 rounded-full border-2 border-white/30 border-t-white"
                    />
                  ) : (
                    <Send size={16} strokeWidth={2} className="mr-0.5 mt-0.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
