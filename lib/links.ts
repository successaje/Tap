"use client";

// Real payment links: every link IS a wallet. Creating one generates a
// throwaway key and the sender's Universal Account genuinely transfers the
// amount to it (cross-chain, settled on Arbitrum). The private key travels in
// the URL *fragment* (#k=…) — fragments never leave the browser, so the server
// and any logs only ever see the link id. Claiming wraps a Universal Account
// around the throwaway key and sweeps the balance to the recipient, fees paid
// from the swept funds themselves — the recipient needs no gas, ever.

import { getUser } from "@/lib/store";
import { signWithMagic } from "@/lib/magic";
import {
  particleEnabled,
  transferOnArbitrum,
  sweepAllToAddress,
  getUnifiedBalance,
  type TransferReceipt,
} from "@/lib/particle";

export interface FundedLink {
  id: string;
  amountUsd: number;
  note?: string;
  /** Sharable URL; includes the claim key in the fragment. */
  url: string;
  /** The link's own wallet address (where the funds sit). */
  address: string;
  fundingTxId: string;
  explorerUrl: string;
  createdAt: string;
}

const SENT_KEY = "tap:sent-real";

/** Real links are possible once Particle is live and a real user is signed in. */
export function canSendReal(): boolean {
  return particleEnabled && !!getUser()?.address;
}

/**
 * Create a link and actually fund it from the sender's Universal Account.
 * Slow path (real cross-chain transaction) — surface progress in the UI.
 */
export async function createFundedLink(
  amountUsd: number,
  note?: string
): Promise<FundedLink> {
  const user = getUser();
  if (!user?.address) throw new Error("Sign in before sending");

  const { Wallet } = await import("ethers");
  const ephemeral = Wallet.createRandom();

  const receipt = await transferOnArbitrum(
    user.address,
    ephemeral.address,
    amountUsd,
    signWithMagic
  );

  const id = ephemeral.address.slice(2, 10).toLowerCase();
  const params = new URLSearchParams({
    from: user.name || "A friend",
    a: amountUsd.toFixed(2),
  });
  if (note) params.set("n", note);
  const url = `${window.location.origin}/t/${id}?${params.toString()}#k=${
    ephemeral.privateKey
  }`;

  const link: FundedLink = {
    id,
    amountUsd,
    note,
    url,
    address: ephemeral.address,
    fundingTxId: receipt.transactionId,
    explorerUrl: receipt.explorerUrl,
    createdAt: new Date().toISOString(),
  };

  // Keep the key sender-side so unclaimed links can be reclaimed later.
  try {
    const existing = JSON.parse(
      window.localStorage.getItem(SENT_KEY) ?? "[]"
    ) as Array<FundedLink & { privateKey: string }>;
    window.localStorage.setItem(
      SENT_KEY,
      JSON.stringify([{ ...link, privateKey: ephemeral.privateKey }, ...existing])
    );
  } catch {
    /* best-effort */
  }

  return link;
}

export interface ClaimableLink {
  id: string;
  amountUsd: number;
  senderName: string;
  note?: string;
  claimKey: string;
}

/** Parse a claim URL (path id + query hints + fragment key). Client-only. */
export function parseClaimLink(id: string): ClaimableLink | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const key = hash.get("k");
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const query = new URLSearchParams(window.location.search);
  return {
    id,
    amountUsd: Number(query.get("a")) || 0,
    senderName: query.get("from") || "Someone",
    note: query.get("n") || undefined,
    claimKey: key,
  };
}

/** What the link's wallet actually holds right now (0 ⇒ already claimed). */
export async function getLinkBalance(claimKey: string): Promise<number> {
  const { Wallet } = await import("ethers");
  const wallet = new Wallet(claimKey);
  const balance = await getUnifiedBalance(wallet.address);
  return balance?.totalUsd ?? 0;
}

/**
 * Sweep the link's funds to the signed-in recipient. The throwaway key signs
 * locally — no popups, no gas, the Universal Account nets fees from the funds.
 */
export async function claimFundedLink(
  claimKey: string
): Promise<TransferReceipt> {
  const user = getUser();
  if (!user?.address) throw new Error("Sign in before claiming");

  const { Wallet } = await import("ethers");
  const wallet = new Wallet(claimKey);
  return sweepAllToAddress(wallet.address, user.address, (message) =>
    wallet.signMessage(message)
  );
}

export interface SentLinkRecord extends FundedLink {
  privateKey: string;
  reclaimed?: boolean;
}

/** Sender-side records of real links created on this device. */
export function getSentLinks(): SentLinkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Pull an unclaimed link's funds back to the sender — same sweep as a claim,
 * just signed with the key we kept. Fails with "link is empty" if it was
 * already claimed.
 */
export async function reclaimFundedLink(
  linkId: string
): Promise<TransferReceipt> {
  const record = getSentLinks().find((l) => l.id === linkId);
  if (!record) throw new Error("Link not found on this device");
  const receipt = await claimFundedLink(record.privateKey);
  window.localStorage.setItem(
    SENT_KEY,
    JSON.stringify(
      getSentLinks().map((l) =>
        l.id === linkId ? { ...l, reclaimed: true } : l
      )
    )
  );
  return receipt;
}
