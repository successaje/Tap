"use client";

// Particle Universal Accounts seam. With useEIP7702 (SDK default) the user's
// Magic embedded-wallet EOA *itself* becomes the Universal Account — one
// address, one balance pooled across chains, settled wherever we ask
// (Arbitrum). Docs: developers.particle.network/universal-accounts.

import type { UniversalAccount } from "@particle-network/universal-account-sdk";

const PROJECT_ID = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
const CLIENT_KEY = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;
const APP_ID = process.env.NEXT_PUBLIC_PARTICLE_APP_ID;

/** True when all Particle credentials are configured. */
export const particleEnabled = !!(PROJECT_ID && CLIENT_KEY && APP_ID);

let cached: { owner: string; ua: UniversalAccount } | null = null;

/**
 * Lazily build the Universal Account for the signed-in user's EOA.
 * Dynamically imported so the SDK stays out of the boot bundle.
 */
export async function getUniversalAccount(
  ownerAddress: string
): Promise<UniversalAccount | null> {
  if (!particleEnabled || typeof window === "undefined") return null;
  if (cached?.owner === ownerAddress) return cached.ua;

  const { UniversalAccount, UNIVERSAL_ACCOUNT_VERSION } = await import(
    "@particle-network/universal-account-sdk"
  );
  const ua = new UniversalAccount({
    projectId: PROJECT_ID!,
    projectClientKey: CLIENT_KEY!,
    projectAppUuid: APP_ID!,
    smartAccountOptions: {
      useEIP7702: true, // the EOA itself becomes the Universal Account
      name: "UNIVERSAL",
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress,
    },
    tradeConfig: {
      slippageBps: 100,
    },
  });
  cached = { owner: ownerAddress, ua };
  return ua;
}

export interface UnifiedBalance {
  totalUsd: number;
  /** Number of distinct chains currently holding any of the primary assets. */
  chainCount: number;
  assetCount: number;
}

/** One unified USD balance across every supported chain. */
export async function getUnifiedBalance(
  ownerAddress: string
): Promise<UnifiedBalance | null> {
  try {
    const ua = await getUniversalAccount(ownerAddress);
    if (!ua) return null;
    const primary = await ua.getPrimaryAssets();
    const chains = new Set<number>();
    let assetCount = 0;
    for (const asset of primary.assets ?? []) {
      if (Number(asset.amount) > 0) assetCount++;
      for (const agg of asset.chainAggregation ?? []) {
        if (Number(agg.amount) > 0) chains.add(Number(agg.token?.chainId));
      }
    }
    return {
      totalUsd: Number(primary.totalAmountInUSD ?? 0),
      chainCount: chains.size,
      assetCount,
    };
  } catch (err) {
    console.error("[tap] unified balance failed:", err);
    return null;
  }
}

export interface TransferReceipt {
  transactionId: string;
  explorerUrl: string;
  /** USD amount actually moved (differs from requested when fees are deducted). */
  sentUsd: number;
  feeUsd: number;
}

/** Native USDC on Arbitrum One. */
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const round2 = (n: number) => Math.floor(n * 100) / 100;

async function createUsdcTransfer(
  ua: UniversalAccount,
  receiver: string,
  amountUsd: number
) {
  const { CHAIN_ID } = await import("@particle-network/universal-account-sdk");
  return ua.createTransferTransaction({
    token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM },
    amount: amountUsd.toFixed(2),
    receiver,
  });
}

function quotedFeeUsd(tx: { feeQuotes?: Array<{ fees?: { totals?: { feeTokenAmountInUSD?: string } } }> }): number {
  return Number(tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD ?? 0);
}

/**
 * Cross-chain USDC transfer settled on Arbitrum. The SDK pulls liquidity from
 * wherever the sender's primary assets live; the owner EOA signs the rootHash.
 * Returns the UniversalX activity URL for the receipt.
 */
export async function transferOnArbitrum(
  ownerAddress: string,
  receiver: string,
  amountUsd: number,
  signMessage: (message: Uint8Array) => Promise<string>
): Promise<TransferReceipt> {
  const ua = await getUniversalAccount(ownerAddress);
  if (!ua) throw new Error("Particle is not configured");
  const { getBytes } = await import("ethers");

  const tx = await createUsdcTransfer(ua, receiver, amountUsd);
  const signature = await signMessage(getBytes(tx.rootHash));
  const result = await ua.sendTransaction(tx, signature);
  return {
    transactionId: result.transactionId,
    explorerUrl: `https://universalx.app/activity/details?id=${result.transactionId}`,
    sentUsd: amountUsd,
    feeUsd: quotedFeeUsd(tx),
  };
}

/**
 * Sweep (almost) everything an account holds to `receiver` — the claim path.
 * Fees come out of the same balance, so quote first, then transfer
 * balance-minus-fees. Retries once with a wider fee buffer if the first
 * attempt doesn't clear.
 */
export async function sweepAllToAddress(
  ownerAddress: string,
  receiver: string,
  signMessage: (message: Uint8Array) => Promise<string>
): Promise<TransferReceipt> {
  const ua = await getUniversalAccount(ownerAddress);
  if (!ua) throw new Error("Particle is not configured");
  const { getBytes } = await import("ethers");

  const primary = await ua.getPrimaryAssets();
  const balanceUsd = Number(primary.totalAmountInUSD ?? 0);
  if (balanceUsd <= 0.01) {
    throw new Error("This link is empty — it may have already been claimed.");
  }

  // Quote fees against the full balance, then step the amount down.
  let quote;
  try {
    quote = await createUsdcTransfer(ua, receiver, round2(balanceUsd));
  } catch {
    quote = null; // full-balance quote can be rejected outright; use buffers
  }
  const baseFee = quote ? quotedFeeUsd(quote) : 0;

  const candidates = [
    quote && baseFee > 0 ? round2(balanceUsd - baseFee * 1.1) : null,
    round2(balanceUsd * 0.96),
    round2(balanceUsd * 0.9),
  ].filter((a): a is number => a !== null && a >= 0.01);

  let lastErr: unknown = null;
  for (const amount of candidates) {
    try {
      const tx = await createUsdcTransfer(ua, receiver, amount);
      const signature = await signMessage(getBytes(tx.rootHash));
      const result = await ua.sendTransaction(tx, signature);
      return {
        transactionId: result.transactionId,
        explorerUrl: `https://universalx.app/activity/details?id=${result.transactionId}`,
        sentUsd: amount,
        feeUsd: quotedFeeUsd(tx),
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Couldn't move the funds — please try again.");
}
