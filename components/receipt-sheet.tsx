"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { haptic } from "@/lib/motion";
import { formatUsd } from "@/lib/mock";
import { getSentLinks } from "@/lib/links";
import type { ActivityItem } from "@/lib/activity";

const TITLES: Record<string, string> = {
  "received:link": "Received via link",
  "sent:link": "Sent via link",
  "sent:direct": "Direct payment",
  "sent:withdrawal": "Cash out",
  "reclaimed:link": "Reclaimed",
};

/**
 * A bank-style receipt for a single activity row — this replaces jumping
 * straight to an external block explorer, which was the one remaining place
 * in the product that visibly said "this is crypto." The explorer link still
 * exists here, just as a small secondary "Verify on-chain" line rather than
 * the only way to see what happened.
 */
export function ReceiptSheet({
  open,
  onClose,
  activity,
}: {
  open: boolean;
  onClose: () => void;
  activity: ActivityItem | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted || !activity) return null;

  // Older records predate the `kind` field — fall back to a safe default
  // rather than showing "undefined" in the title.
  const kind = activity.kind ?? "direct";
  const title = TITLES[`${activity.type}:${kind}`] || "Transaction";
  const isCredit = activity.type === "received" || activity.type === "reclaimed";
  const statusLabel =
    activity.status === "awaiting-claim"
      ? "Awaiting claim"
      : activity.status === "reclaimed"
        ? "Reclaimed"
        : "Completed";
  const date = new Date(activity.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const activityId = activity.id;
  const claimLink =
    kind === "link" && activity.type === "sent" && activity.linkId
      ? getSentLinks().find((l) => l.id === activity.linkId)?.url
      : null;

  const receiptImageUrl = `/api/receipt?${new URLSearchParams({
    type: activity.type,
    kind,
    a: String(activity.amountUsd),
    cp: activity.counterparty,
    status: activity.status,
    date,
    ...(activity.txId ? { tx: activity.txId } : {}),
  }).toString()}`;

  async function copyLink() {
    if (!claimLink) return;
    haptic(10);
    await navigator.clipboard?.writeText(claimLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function download() {
    haptic(10);
    try {
      const res = await fetch(receiptImageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tap-receipt-${activityId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fall back to opening it directly so the user can still save it manually.
      window.open(receiptImageUrl, "_blank");
    }
  }

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
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white px-6 pb-10 pt-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight">Receipt</h2>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="mt-6 flex flex-col items-center rounded-3xl border border-slate-100 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-500">{title}</p>
              <p
                className={`mt-2 text-5xl font-semibold tracking-tighter tabular-nums ${
                  isCredit ? "text-emerald-600" : "text-slate-900"
                }`}
              >
                {isCredit ? "+" : "-"}
                {formatUsd(activity.amountUsd)}
              </p>
              <span className="mt-3 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold text-emerald-600">
                {statusLabel}
              </span>

              <div className="mt-6 w-full space-y-3 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {isCredit ? "From" : "To"}
                  </span>
                  <span className="font-semibold text-slate-900">{activity.counterparty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Date</span>
                  <span className="font-semibold text-slate-900">{date}</span>
                </div>
                {activity.note && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Note</span>
                    <span className="font-semibold text-slate-900">{activity.note}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Network</span>
                  <span className="font-semibold text-slate-900">Arbitrum</span>
                </div>
              </div>
            </div>

            {claimLink && (
              <button
                onClick={copyLink}
                className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-ios"
              >
                <span className="truncate font-mono text-xs text-slate-600">
                  {claimLink.replace(/^https?:\/\//, "").slice(0, 34)}…
                </span>
                <span className="shrink-0 pl-3 text-xs font-semibold text-accent">
                  {copied ? "Copied ✓" : "Copy link"}
                </span>
              </button>
            )}

            <button
              onClick={download}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full btn-tap text-base font-semibold text-white"
            >
              <Download size={18} strokeWidth={2} />
              Download receipt
            </button>

            {activity.explorerUrl && (
              <a
                href={activity.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block text-center text-xs font-medium text-slate-400 underline-offset-2 hover:underline"
              >
                Verify on Arbitrum ↗
              </a>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
