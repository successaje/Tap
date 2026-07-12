// Mock data layer. Every SDK integration (Magic, Particle, Arbitrum) will
// eventually replace pieces of this file — the UI only talks to these shapes.

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

export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
