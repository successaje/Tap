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

/**
 * Cross-chain USDC transfer settled on Arbitrum. The SDK pulls liquidity from
 * wherever the sender's primary assets live; the Magic EOA signs the rootHash.
 * Returns the UniversalX activity URL for the receipt.
 */
export async function transferOnArbitrum(
  ownerAddress: string,
  receiver: string,
  amountUsd: number,
  signMessage: (message: Uint8Array) => Promise<string>
): Promise<{ transactionId: string; explorerUrl: string }> {
  const ua = await getUniversalAccount(ownerAddress);
  if (!ua) throw new Error("Particle is not configured");

  const { CHAIN_ID } = await import("@particle-network/universal-account-sdk");
  const { getBytes } = await import("ethers");

  // Native USDC on Arbitrum One.
  const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

  const tx = await ua.createTransferTransaction({
    token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM },
    amount: String(amountUsd),
    receiver,
  });
  const signature = await signMessage(getBytes(tx.rootHash));
  const result = await ua.sendTransaction(tx, signature);
  return {
    transactionId: result.transactionId,
    explorerUrl: `https://universalx.app/activity/details?id=${result.transactionId}`,
  };
}
