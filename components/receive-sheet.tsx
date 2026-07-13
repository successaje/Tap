"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { PaymentQR } from "@/components/qr";
import { type AppUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/motion";
import { X } from "lucide-react";

export function ReceiveSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: AppUser | null;
}) {
  const [copied, setCopied] = useState(false);
  // Portal to <body> so the sheet escapes any ancestor transform/filter
  // stacking context (e.g. the page-transition wrapper) and sits above the nav.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const myLink = user?.address
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay?to=${
        user.address
      }&from=${encodeURIComponent(user.name || "Me")}`
    : null;

  async function copyMyLink() {
    if (!myLink) return;
    haptic(10);
    await navigator.clipboard?.writeText(myLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!mounted) return null;

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
              <h2 className="text-xl font-semibold tracking-tight">Receive money</h2>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {myLink ? (
              <div className="mt-8 flex flex-col items-center">
                <PaymentQR value={myLink} size={220} caption="" />
                <p className="mt-6 text-center text-sm font-medium text-slate-500">
                  Show this code to get paid on tap
                </p>

                <button
                  onClick={copyMyLink}
                  className="mt-8 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-ios"
                >
                  <span className="truncate font-mono text-sm text-slate-600">
                    {myLink.replace(/^https?:\/\//, "").slice(0, 32)}…
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-accent">
                    {copied ? "Copied ✓" : "Copy link"}
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-12 text-center pb-8">
                <p className="text-slate-500 font-medium">Sign in to get your receive link.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
