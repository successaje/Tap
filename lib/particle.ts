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
  } catch {
    // Silently fall back to mock balance if Particle SDK fails (e.g., Network Error or invalid keys)
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

/**
 * Everything a Universal Account transaction may need signed by the owner EOA:
 * the rootHash (personal sign) and — on the first transaction per chain — an
 * EIP-7702 delegation authorization (raw tuple signature). Magic exposes
 * sign7702Authorization for the latter; ethers Wallets use authorize().
 */
export interface UaSigner {
  signMessage: (message: Uint8Array) => Promise<string>;
  /** Returns the SERIALIZED (r,s,v) signature for the authorization tuple. */
  signAuthorization: (auth: {
    address: string;
    chainId: number;
    nonce: number;
  }) => Promise<string>;
}

interface AuthUserOp {
  userOpHash: string;
  eip7702Auth?: { address: string; chainId: number; nonce: number };
  eip7702Delegated?: boolean;
}

/**
 * First transaction per chain from a 7702 account must include a signed
 * delegation authorization per userOp that asks for one. Mirrors Particle's
 * official demo: sign each unique (chainId, nonce) tuple once, then attach it
 * to every userOp that needs it.
 */
async function buildAuthorizations(
  userOps: AuthUserOp[],
  signer: UaSigner
): Promise<Array<{ userOpHash: string; signature: string }>> {
  const out: Array<{ userOpHash: string; signature: string }> = [];
  const cache = new Map<string, string>();
  for (const op of userOps) {
    if (!op.eip7702Auth || op.eip7702Delegated) continue;
    const key = `${op.eip7702Auth.chainId}:${op.eip7702Auth.nonce}`;
    let sig = cache.get(key);
    if (!sig) {
      sig = await signer.signAuthorization({
        address: op.eip7702Auth.address,
        chainId: Number(op.eip7702Auth.chainId),
        nonce: Number(op.eip7702Auth.nonce),
      });
      cache.set(key, sig);
    }
    out.push({ userOpHash: op.userOpHash, signature: sig });
  }
  return out;
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

/**
 * Particle returns USD fee amounts as hex strings scaled by 1e18
 * (e.g. "0x65fdc6a2cbe680" ≈ $0.0287). Parse defensively: hex → 18-dec,
 * plain decimal strings pass through.
 */
function parseUsd18(v: string | undefined | null): number {
  if (!v) return 0;
  if (v.startsWith("0x")) {
    try {
      return Number(BigInt(v)) / 1e18;
    } catch {
      return 0;
    }
  }
  return Number(v) || 0;
}

function quotedFeeUsd(tx: { feeQuotes?: Array<{ fees?: { totals?: { feeTokenAmountInUSD?: string } } }> }): number {
  return parseUsd18(tx.feeQuotes?.[0]?.fees?.totals?.feeTokenAmountInUSD);
}

/** Wrap a stage so failures self-describe where they happened. */
async function stage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
    const data = (err as { data?: unknown })?.data;
    console.error(`[tap] ${name} failed:`, err, data ? { data } : "");
    throw new Error(`${name}: ${detail}`);
  }
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
  signer: UaSigner
): Promise<TransferReceipt> {
  const ua = await getUniversalAccount(ownerAddress);
  if (!ua) throw new Error("Particle is not configured");
  const { getBytes } = await import("ethers");

  const tx = await stage("Preparing the transfer", () =>
    createUsdcTransfer(ua, receiver, amountUsd)
  );
  const authorizations = await stage("Authorizing your account (7702)", () =>
    buildAuthorizations(tx.userOps as unknown as AuthUserOp[], signer)
  );
  const signature = await stage("Signing with your account", () =>
    signer.signMessage(getBytes(tx.rootHash))
  );
  const result = await stage("Submitting on-chain", () =>
    ua.sendTransaction(tx, signature, authorizations)
  );
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
  signer: UaSigner
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
      const tx = await stage("Preparing the claim", () =>
        createUsdcTransfer(ua, receiver, amount)
      );
      const authorizations = await stage("Authorizing the link (7702)", () =>
        buildAuthorizations(tx.userOps as unknown as AuthUserOp[], signer)
      );
      const signature = await signer.signMessage(getBytes(tx.rootHash));
      const result = await stage("Submitting on-chain", () =>
        ua.sendTransaction(tx, signature, authorizations)
      );
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
