"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { PaymentQR } from "@/components/qr";
import { haptic } from "@/lib/motion";
import { useEffect, useState } from "react";
import { X, Wallet, Landmark, CreditCard } from "lucide-react";

/**
 * Funding in, not out: shows the account's real on-chain address so money can
 * arrive from anywhere that isn't already a tap link — another wallet, or an
 * exchange withdrawal (Coinbase, Bybit, etc.). This is deliberately not the
 * same thing as ReceiveSheet's "pay me" tap link: an exchange withdrawal
 * screen needs a literal address to send to, not a URL.
 */
export function DepositSheet({
  open,
  onClose,
  address,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  async function copyAddress() {
    if (!address) return;
    haptic(10);
    await navigator.clipboard?.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!mounted) return null;

  const rails = [
    { icon: Wallet, label: "Crypto address", sub: "USDC (or any supported asset) on Arbitrum or its source chain", live: true },
    { icon: Landmark, label: "Bank transfer", sub: "ACH / SEPA", live: false },
    { icon: CreditCard, label: "Debit card", sub: "Instant top-up", live: false },
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
              <h2 className="text-xl font-semibold tracking-tight">Fund your account</h2>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {address ? (
              <div className="mt-6 flex flex-col items-center">
                <PaymentQR value={address} size={180} caption="" />
                <button
                  onClick={copyAddress}
                  className="mt-6 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-ios"
                >
                  <span className="truncate font-mono text-sm text-slate-600">
                    {address}
                  </span>
                  <span className="shrink-0 pl-3 text-sm font-semibold text-accent">
                    {copied ? "Copied ✓" : "Copy"}
                  </span>
                </button>
                <p className="mt-4 text-center text-xs font-medium text-slate-400">
                  Send USDC here from any wallet or exchange — a Bybit,
                  Coinbase, or Binance withdrawal works the same as a wallet
                  transfer. It shows up in your tap balance once it lands
                  on-chain.
                </p>

                <div className="mt-8 w-full space-y-2">
                  {rails.map((r) => (
                    <div
                      key={r.label}
                      className={`flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 text-left shadow-ios ${
                        r.live ? "" : "opacity-70"
                      }`}
                    >
                      <div
                        className={`flex size-10 items-center justify-center rounded-2xl ${
                          r.live ? "bg-blue-50 text-accent" : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        <r.icon size={18} strokeWidth={2} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                        <p className="text-xs font-medium text-slate-400">{r.sub}</p>
                      </div>
                      <span className={`text-xs font-semibold ${r.live ? "text-accent" : "text-slate-300"}`}>
                        {r.live ? "Available" : "Soon"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-12 pb-8 text-center">
                <p className="font-medium text-slate-500">Sign in to see your deposit address.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
