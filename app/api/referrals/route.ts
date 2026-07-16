import { NextResponse } from "next/server";
import {
  linkReferralCode,
  capturePendingReferral,
  creditReferralIfPending,
  getReferralStats,
  checkRateLimit,
  kvConfigured,
} from "@/lib/server/kv";
import { isAddress, isReferralCode } from "@/lib/server/validate";

/**
 * Referral tracking — the one piece of the Rewards screen that can't be
 * computed from a device's own local activity, since a referring device
 * can't observe a referred device's activity without a shared server. See
 * FUTURE.md for why this was previously left unbuilt rather than shipped
 * with fabricated data.
 *
 * Three actions, each best-effort and fire-and-forget from the client:
 * - "link-code": registers a referrer's short code → their address
 *   (called once, from the Rewards page).
 * - "capture": records "this address was referred by that code," pending —
 *   called exactly once, right when a brand-new account finishes
 *   onboarding, so an existing user can't retroactively generate a
 *   referral by clicking a stray `?ref=` link later.
 * - "credit": credits the referrer +500 points the first time the referred
 *   address completes a real send — called unconditionally after every
 *   send, and correctly no-ops after the first time since the pending
 *   record is consumed on credit.
 */
export async function GET(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ points: 0, count: 0 });
  }
  const address = new URL(req.url).searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const stats = await getReferralStats(address);
  return NextResponse.json(stats);
}

export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ success: true, persisted: false });
  }
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "link-code") {
      const { code, address } = body;
      if (!isReferralCode(code) || !isAddress(address)) {
        return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
      }
      if (!(await checkRateLimit("referral-link", address, 20, 300))) {
        return NextResponse.json({ success: true, persisted: false });
      }
      await linkReferralCode(code, address);
      return NextResponse.json({ success: true, persisted: true });
    }

    if (action === "capture") {
      const { code, referredAddress } = body;
      if (!isReferralCode(code) || !isAddress(referredAddress)) {
        return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
      }
      if (!(await checkRateLimit("referral-capture", referredAddress, 5, 300))) {
        return NextResponse.json({ success: true, captured: false });
      }
      const captured = await capturePendingReferral(referredAddress, code);
      return NextResponse.json({ success: true, captured });
    }

    if (action === "credit") {
      const { referredAddress } = body;
      if (!isAddress(referredAddress)) {
        return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
      }
      if (!(await checkRateLimit("referral-credit", referredAddress, 20, 300))) {
        return NextResponse.json({ success: true, credited: false });
      }
      const credited = await creditReferralIfPending(referredAddress);
      return NextResponse.json({ success: true, credited });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[tap] referrals error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
