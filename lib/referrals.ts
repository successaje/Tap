"use client";

// Real referral tracking, backed by the same Redis store as push and stats.
// Points earned this way can't be computed locally like the rest of Rewards
// (lib/activity-derived volume) — a referring device has no way to observe
// a referred device's activity without a shared server. See FUTURE.md.

const PENDING_REF_KEY = "tap:pending-ref";

/** Stash a `?ref=` code the moment it's seen, before anything else happens. */
export function stashPendingReferralCode(code: string) {
  try {
    window.localStorage.setItem(PENDING_REF_KEY, code);
  } catch {
    /* best-effort */
  }
}

function takePendingReferralCode(): string | null {
  try {
    const code = window.localStorage.getItem(PENDING_REF_KEY);
    window.localStorage.removeItem(PENDING_REF_KEY);
    return code;
  } catch {
    return null;
  }
}

/** Registers this user's own short code as a referrer — call from the Rewards page. */
export function linkReferralCode(code: string, address: string) {
  fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "link-code", code, address }),
  }).catch(() => {});
}

/**
 * Consumes any pending `?ref=` code stashed earlier and captures it against
 * this address. Call exactly once, right when a brand-new account finishes
 * onboarding — never on a returning sign-in.
 */
export function capturePendingReferral(referredAddress: string) {
  const code = takePendingReferralCode();
  if (!code) return;
  fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "capture", code, referredAddress }),
  }).catch(() => {});
}

/** Fire-and-forget: credits the referrer if this address has an uncredited referral pending. */
export function creditReferralIfPending(referredAddress: string) {
  fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "credit", referredAddress }),
  }).catch(() => {});
}

export async function getReferralStats(address: string): Promise<{ points: number; count: number }> {
  try {
    const res = await fetch(`/api/referrals?address=${address}`);
    if (!res.ok) return { points: 0, count: 0 };
    return await res.json();
  } catch {
    return { points: 0, count: 0 };
  }
}
