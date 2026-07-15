"use client";

type TxKind = "send" | "claim" | "reclaim" | "pay" | "withdraw";

/**
 * Fire-and-forget, same pattern as the push-registration calls in lib/links.ts —
 * never awaited by callers, never throws. A failed record only costs an
 * undercounted stat, never a broken transfer.
 */
export function recordTransactionStat(kind: TxKind, amountUsd: number) {
  fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, amountUsd }),
  }).catch(() => {});
}
