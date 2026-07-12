"use client";

import { getMagic, authEnabled } from "@/lib/magic";
import { getUser, type MockUser } from "@/lib/store";

// Unified auth seam. `authEnabled` (a Magic key is present) selects the real
// redirect-based Google login; otherwise the login screen uses the inline mock
// in lib/store.ts. Both paths persist the user under the same "tap:user" key,
// so getUser() reads either.

export { authEnabled, getUser };
export type AppUser = MockUser;

const USER_KEY = "tap:user";
const RETURN_KEY = "tap:auth-return";
const RETURN_URL_KEY = "tap:auth-return-url";

/**
 * Kick off Google OAuth via Magic. Redirects the browser away to Google and
 * back to /callback, so this never resolves in-page. `returnStep` is stashed so
 * the flow can resume where it left off after the round trip.
 */
export async function beginGoogleLogin(returnStep = "moment") {
  const magic = await getMagic();
  if (!magic) throw new Error("Magic is not configured");
  sessionStorage.setItem(RETURN_KEY, returnStep);
  // Return to the exact page (incl. a claim link's #k fragment — it stays
  // in sessionStorage and the browser, never in any redirect URL).
  sessionStorage.setItem(
    RETURN_URL_KEY,
    window.location.pathname + window.location.search + window.location.hash
  );
  await magic.oauth2.loginWithRedirect({
    provider: "google",
    redirectURI: `${window.location.origin}/callback`,
  });
}

/** Called on /callback to finish the OAuth round trip and persist the user. */
export async function completeLoginFromRedirect(): Promise<AppUser> {
  const magic = await getMagic();
  if (!magic) throw new Error("Magic is not configured");

  const result = await magic.oauth2.getRedirectResult();
  const meta = result.magic.userMetadata;
  console.debug("[tap] magic userMetadata shape:", meta);
  const info = (result.oauth?.userInfo ?? {}) as {
    name?: string;
    email?: string;
    picture?: string;
  };

  const user: AppUser = {
    name: info.name || meta.email?.split("@")[0] || "You",
    email: meta.email || info.email || "",
    address: extractAddress(meta),
    avatar: info.picture,
  };

  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Pull the embedded-wallet ETH address out of Magic's user metadata without
 * assuming its shape — across SDK versions `wallets` has been an array, a
 * chain-keyed object, or absent (flat `publicAddress`). The address is
 * informational until Particle lands, so failure here must never break login.
 */
function extractAddress(meta: unknown): string | undefined {
  try {
    const m = meta as Record<string, unknown>;
    const pick = (o: unknown): string | undefined => {
      if (!o || typeof o !== "object") return undefined;
      const r = o as Record<string, unknown>;
      const addr = r.publicAddress ?? r.public_address;
      return typeof addr === "string" && addr ? addr : undefined;
    };

    const w = m?.wallets;
    if (Array.isArray(w)) {
      const eth = w.find((x) => {
        const t = (x as Record<string, unknown>)?.walletType ??
          (x as Record<string, unknown>)?.wallet_type;
        return t === "ETH" || t === "ethereum";
      });
      return pick(eth) ?? pick(w[0]);
    }
    if (w && typeof w === "object") {
      // Chain-keyed object, e.g. { ethereum: { publicAddress } }.
      for (const v of Object.values(w)) {
        const addr = pick(v);
        if (addr) return addr;
      }
    }
    return pick(m);
  } catch {
    return undefined;
  }
}

/** Read (and clear) the step to resume after an auth redirect. */
export function consumeReturnStep(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(RETURN_KEY);
  if (v) sessionStorage.removeItem(RETURN_KEY);
  return v;
}

/** Read (and clear) the URL to return to after an auth redirect. */
export function consumeReturnUrl(): string {
  if (typeof window === "undefined") return "/";
  const v = sessionStorage.getItem(RETURN_URL_KEY);
  if (v) sessionStorage.removeItem(RETURN_URL_KEY);
  return v || "/";
}

export async function logout() {
  try {
    const magic = await getMagic();
    await magic?.user.logout();
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") localStorage.removeItem(USER_KEY);
}
