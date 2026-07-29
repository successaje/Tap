"use client";

// Split state lives server-side (same Redis store as everything else in
// lib/server/kv.ts) because every payer's device needs to see the same
// progress — unlike a sent link or a beneficiary, this isn't something a
// single device can compute from its own local records.

export interface SplitState {
  id: string;
  ownerAddress: string;
  ownerName: string;
  targetUsd: number;
  note?: string;
  createdAt: string;
  collectedUsd: number;
  payerCount: number;
  recentContributions: { label: string; amountUsd: number; at: string }[];
}

function newSplitId(): string {
  return Math.random().toString(16).slice(2, 10).padEnd(8, "0");
}

export async function createSplit(
  ownerAddress: string,
  ownerName: string,
  targetUsd: number,
  note?: string
): Promise<{ ok: boolean; id?: string }> {
  const id = newSplitId();
  try {
    const res = await fetch("/api/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", id, ownerAddress, ownerName, targetUsd, note }),
    });
    const data = await res.json();
    return { ok: !!data.ok, id: data.ok ? id : undefined };
  } catch {
    return { ok: false };
  }
}

export async function getSplitState(id: string): Promise<SplitState | null> {
  try {
    const res = await fetch(`/api/split?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fire-and-forget, called after the underlying transfer already succeeded. */
export function recordSplitContribution(id: string, amountUsd: number, label: string) {
  fetch("/api/split", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "contribute", id, amountUsd, label }),
  }).catch(() => {});
}
