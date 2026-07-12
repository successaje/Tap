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

/**
 * Kick off Google OAuth via Magic. Redirects the browser away to Google and
 * back to /callback, so this never resolves in-page. `returnStep` is stashed so
 * the flow can resume where it left off after the round trip.
 */
export async function beginGoogleLogin(returnStep = "moment") {
  const magic = await getMagic();
  if (!magic) throw new Error("Magic is not configured");
  sessionStorage.setItem(RETURN_KEY, returnStep);
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
  const info = (result.oauth?.userInfo ?? {}) as {
    name?: string;
    email?: string;
    picture?: string;
  };

  // SDK v33 exposes a multi-chain `wallets` array; older versions had a flat
  // `publicAddress`. Read defensively since the exact shape shifts across versions.
  const flat = meta as unknown as {
    publicAddress?: string | null;
    wallets?: Array<{ walletType?: string; publicAddress?: string }>;
  };
  const address =
    flat.wallets?.find((w) => w.walletType === "ETH")?.publicAddress ??
    flat.publicAddress ??
    undefined;

  const user: AppUser = {
    name: info.name || meta.email?.split("@")[0] || "You",
    email: meta.email || info.email || "",
    address: address ?? undefined,
    avatar: info.picture,
  };

  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** Read (and clear) the step to resume after an auth redirect. */
export function consumeReturnStep(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(RETURN_KEY);
  if (v) sessionStorage.removeItem(RETURN_KEY);
  return v;
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
