"use client";

// Local activity ledger. Every send / receive / reclaim writes a record here;
// real transactions carry their on-chain receipt. This is the data behind the
// Home feed and per-transaction receipts.

export type ActivityType = "sent" | "received" | "reclaimed";
export type ActivityStatus = "settled" | "awaiting-claim" | "reclaimed";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  amountUsd: number;
  /** Who the money moved to/from, as displayed ("Maya", "Link 4f2a…"). */
  counterparty: string;
  note?: string;
  status: ActivityStatus;
  /** Present when the movement really settled on-chain. */
  explorerUrl?: string;
  txId?: string;
  /** For outstanding sent links: the link id in tap:sent-real. */
  linkId?: string;
  createdAt: string;
}

const KEY = "tap:activity";

export function getActivity(): ActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function recordActivity(
  item: Omit<ActivityItem, "id" | "createdAt"> & { id?: string }
): ActivityItem {
  const full: ActivityItem = {
    ...item,
    id: item.id ?? Math.random().toString(36).slice(2, 10),
    createdAt: new Date().toISOString(),
  };
  const list = [full, ...getActivity()].slice(0, 100);
  window.localStorage.setItem(KEY, JSON.stringify(list));
  return full;
}

export function updateActivity(
  id: string,
  patch: Partial<Pick<ActivityItem, "status" | "explorerUrl" | "txId">>
) {
  const list = getActivity().map((a) => (a.id === id ? { ...a, ...patch } : a));
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/** Relative "2m ago" style timestamp for the feed. */
export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
