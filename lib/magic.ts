"use client";

import type { Magic } from "magic-sdk";
import type { OAuthExtension } from "@magic-ext/oauth2";

const KEY = process.env.NEXT_PUBLIC_MAGIC_API_KEY;

/** True when a Magic publishable key is configured; otherwise the app uses the mock auth path. */
export const authEnabled = !!KEY;

type MagicWithOAuth = Magic<[OAuthExtension]>;
let instance: MagicWithOAuth | null = null;

/**
 * Lazily construct the Magic client. Dynamically imported so the SDK (which
 * touches `window`) never evaluates during SSR. Returns null when unconfigured
 * or on the server.
 */
export async function getMagic(): Promise<MagicWithOAuth | null> {
  if (!KEY || typeof window === "undefined") return null;
  if (!instance) {
    const [{ Magic }, { OAuthExtension }] = await Promise.all([
      import("magic-sdk"),
      import("@magic-ext/oauth2"),
    ]);
    instance = new Magic(KEY, { extensions: [new OAuthExtension()] });
  }
  return instance;
}

/**
 * Sign raw bytes with the Magic embedded-wallet EOA (personal_sign).
 * Used to authorize Particle Universal Account transactions (rootHash).
 */
export async function signWithMagic(message: Uint8Array): Promise<string> {
  const magic = await getMagic();
  if (!magic) throw new Error("Magic is not configured");
  const { BrowserProvider } = await import("ethers");
  const provider = new BrowserProvider(
    magic.rpcProvider as unknown as import("ethers").Eip1193Provider
  );
  const signer = await provider.getSigner();
  return signer.signMessage(message);
}

/**
 * Full Universal Account signer backed by Magic: personal-signs rootHashes and
 * signs EIP-7702 delegation authorizations via magic.wallet.sign7702Authorization
 * (magic-sdk ≥ 33.4; headless, no popup). We pass Particle's explicit nonce so
 * the delegation matches the prepared userOp exactly.
 */
export function magicUaSigner(): import("@/lib/particle").UaSigner {
  return {
    signMessage: signWithMagic,
    signAuthorization: async ({ address, chainId, nonce }) => {
      const magic = await getMagic();
      if (!magic) throw new Error("Magic is not configured");
      const wallet = magic.wallet as unknown as {
        sign7702Authorization: (params: {
          contractAddress: string;
          chainId: number;
          nonce?: number;
        }) => Promise<{ r: string; s: string; v: number }>;
      };
      if (typeof wallet.sign7702Authorization !== "function") {
        throw new Error(
          "This version of Magic can't authorize EIP-7702 accounts"
        );
      }
      const auth = await wallet.sign7702Authorization({
        contractAddress: address,
        chainId,
        nonce,
      });
      const { Signature } = await import("ethers");
      return Signature.from({ r: auth.r, s: auth.s, v: auth.v }).serialized;
    },
  };
}
