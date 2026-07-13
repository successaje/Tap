// Mock data layer. Every SDK integration (Magic, Particle, Arbitrum) will
// eventually replace pieces of this file — the UI only talks to these shapes.

import { getSettings } from "@/lib/settings";
import { formatCurrency } from "@/lib/currency";

/**
 * Lifecycle of a payment link:
 * - "unclaimed": live, waiting for a recipient
 * - "bound": a recipient signed in once; the link is now locked to them
 * - "claimed": funds delivered
 * - "expired": passed expiresAt without a claim; sender can reclaim
 * - "reclaimed": sender pulled the funds back
 */
export type LinkStatus =
  | "unclaimed"
  | "bound"
  | "claimed"
  | "expired"
  | "reclaimed";

export interface PaymentLink {
  id: string;
  amountUsd: number;
  senderName: string;
  note?: string;
  status: LinkStatus;
  /** Identity the link bound to on first login (null until then). */
  boundTo: string | null;
  createdAt: string;
  expiresAt: string;
}

const DAY = 24 * 60 * 60 * 1000;

export const demoLink: PaymentLink = {
  id: "demo-4f2a",
  amountUsd: 42.5,
  senderName: "Maya",
  note: "lunch — thanks for covering 🌮",
  status: "unclaimed",
  boundTo: null,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 6 * DAY).toISOString(),
};

export function daysUntilExpiry(link: PaymentLink): number {
  return Math.max(0, Math.ceil((Date.parse(link.expiresAt) - Date.now()) / DAY));
}

export function formatUsd(amountUsd: number): string {
  if (typeof window === "undefined") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(amountUsd);
  }
  
  const currency = getSettings().currency;
  let rates = undefined;
  try {
    const cached = window.localStorage.getItem("tap:rates");
    if (cached) rates = JSON.parse(cached);
  } catch {}

  return formatCurrency(amountUsd, currency, rates);
}

export function formatLocalInput(amountLocal: number): string {
  if (typeof window === "undefined") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(amountLocal);
  }
  
  const currency = getSettings().currency;
  const hideDecimals = ["JPY", "NGN", "ARS"].includes(currency);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: hideDecimals ? 0 : 2,
    maximumFractionDigits: hideDecimals ? 0 : 2,
  }).format(amountLocal);
}

export function getRate(): number {
  if (typeof window === "undefined") return 1;
  const currency = getSettings().currency;
  if (currency === "USD") return 1; // base unit — never off-by-a-fraction
  try {
    const cached = window.localStorage.getItem("tap:rates");
    if (cached) {
      const rates = JSON.parse(cached);
      return rates[currency] || 1;
    }
  } catch {}
  return 1;
}

export function localToUsd(amountLocal: number): number {
  return amountLocal / getRate();
}

export function usdToLocal(amountUsd: number): number {
  return amountUsd * getRate();
}
