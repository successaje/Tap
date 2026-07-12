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
