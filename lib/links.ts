"use client";

// Real payment links: every link IS a wallet. Creating one generates a
// throwaway key and the sender's Universal Account genuinely transfers the
// amount to it (cross-chain, settled on Arbitrum). The private key travels in
// the URL *fragment* (#k=…) — fragments never leave the browser, so the server
// and any logs only ever see the link id. Claiming wraps a Universal Account
// around the throwaway key and sweeps the balance to the recipient, fees paid
// from the swept funds themselves — the recipient needs no gas, ever.

import { getUser } from "@/lib/store";
import { magicUaSigner } from "@/lib/magic";
import { recordTransactionStat } from "@/lib/stats";
import { creditReferralIfPending } from "@/lib/referrals";
import {
  particleEnabled,
  transferOnArbitrum,
  sweepAllToAddress,
  getUnifiedBalance,
  type TransferReceipt,
  type UaSigner,
} from "@/lib/particle";

/** UA signer backed by a raw ethers Wallet (the link's throwaway key). */
async function walletUaSigner(privateKey: string): Promise<{
  address: string;
  signer: UaSigner;
}> {
  const { Wallet, Signature } = await import("ethers");
  const wallet = new Wallet(privateKey);
  return {
    address: wallet.address,
    signer: {
      signMessage: (message) => wallet.signMessage(message),
      signAuthorization: async ({ address, chainId, nonce }) => {
        const auth = await wallet.authorize({ address, chainId, nonce });
        return Signature.from(auth.signature).serialized;
      },
    },
  };
}

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

/**
 * Best-effort calls to the background watcher (see app/api/cron/check-claims
 * and FUTURE.md). Never awaited by callers, never throws — a failed
 * registration only costs a missed push notification, never a broken
 * transfer. This is the one place tap's client talks to a server at all.
 */
function registerLinkForPush(link: {
  linkId: string;
  ownerAddress: string;
  linkAddress: string;
  amountUsd: number;
  note?: string;
}) {
  fetch("/api/links/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(link),
  }).catch(() => {});
}

function unregisterLinkForPush(linkId: string) {
  fetch("/api/links/unregister", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkId }),
  }).catch(() => {});
}

/**
 * Real links are possible once Particle is configured and a real user is
 * signed in. We don't gate this on a prior successful balance fetch — if
 * Particle's API is actually unreachable, createTransferTransaction fails
 * before any signing or fund movement, and the UI surfaces that as a normal
 * staged error. Gating on a cross-component "reachable" flag instead made
 * this fragile: navigating here directly (deep link, refresh, bookmark)
 * without Home having mounted first silently fell back to the mock path.
 */
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
    magicUaSigner()
  );
  recordTransactionStat("send", receipt.sentUsd);
  // "Sends their first link" — the exact event Rewards promises 500 points
  // for. Unconditional on every send; no-ops after the first real credit
  // since the pending record is consumed server-side.
  creditReferralIfPending(user.address);

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

  // Let the server watch this link so a claim can push a notification even
  // if this tab is closed by the time it happens.
  registerLinkForPush({
    linkId: id,
    ownerAddress: user.address,
    linkAddress: ephemeral.address,
    amountUsd,
    note,
  });

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

  const { address, signer } = await walletUaSigner(claimKey);
  return sweepAllToAddress(address, user.address, signer);
}

export interface SentLinkRecord extends FundedLink {
  privateKey: string;
  reclaimed?: boolean;
  /** Set once we observe the link's wallet emptied by a recipient. */
  claimed?: boolean;
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
 * The chain is the source of truth for "was my link claimed?" — there's no
 * backend, so we poll each outstanding link's wallet. Empty wallet ⇒ someone
 * swept it. Marks records + activity rows and returns the newly claimed links
 * so the caller can celebrate.
 */
export async function syncSentLinkClaims(): Promise<SentLinkRecord[]> {
  if (!particleEnabled) return [];
  const { updateActivityByLinkId } = await import("@/lib/activity");
  const outstanding = getSentLinks().filter((l) => !l.reclaimed && !l.claimed);
  const newlyClaimed: SentLinkRecord[] = [];

  for (const link of outstanding) {
    try {
      const balance = await getUnifiedBalance(link.address);
      if (balance !== null && balance.totalUsd <= 0.01) {
        newlyClaimed.push(link);
        updateActivityByLinkId(link.id, { status: "settled" });
        // Stop the server from also detecting this claim and double-pushing.
        unregisterLinkForPush(link.id);
      }
    } catch {
      /* transient — try again next visit */
    }
  }

  if (newlyClaimed.length > 0) {
    const ids = new Set(newlyClaimed.map((l) => l.id));
    window.localStorage.setItem(
      SENT_KEY,
      JSON.stringify(
        getSentLinks().map((l) => (ids.has(l.id) ? { ...l, claimed: true } : l))
      )
    );
  }
  return newlyClaimed;
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
  recordTransactionStat("reclaim", receipt.sentUsd);
  unregisterLinkForPush(linkId); // reclaimed, not claimed — no push should fire
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
