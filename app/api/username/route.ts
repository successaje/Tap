import { NextResponse } from "next/server";
import {
  claimUsername,
  resolveUsername,
  getUsernameForAddress,
  checkRateLimit,
  kvConfigured,
} from "@/lib/server/kv";
import { isAddress, isUsername } from "@/lib/server/validate";

/**
 * A username is a human-readable, user-chosen alias for a tap address —
 * lets two people who both already have tap send directly to each other
 * without a claim link. Distinct from a referral code (deterministic,
 * derived from the address, never chosen): this one needs real uniqueness,
 * enforced here rather than client-side.
 *
 * Low-stakes by design, same trust model as referral codes: address is
 * client-asserted, not signature-verified. The only thing at risk from a
 * forged claim is someone else's desired handle, not custody of funds —
 * unlike the fiat-rail design in RAMP.md, there's no money movement gated
 * on this address being real.
 */
export async function GET(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ address: null, username: null });
  }
  const params = new URL(req.url).searchParams;
  const username = params.get("username");
  const address = params.get("address");

  if (username !== null) {
    if (!isUsername(username)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const resolved = await resolveUsername(username);
    if (!resolved) {
      return NextResponse.json({ error: "No tap user with that username" }, { status: 404 });
    }
    return NextResponse.json({ address: resolved });
  }

  if (address !== null) {
    if (!isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    const username = await getUsernameForAddress(address);
    return NextResponse.json({ username });
  }

  return NextResponse.json({ error: "Provide ?username= or ?address=" }, { status: 400 });
}

export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ ok: false, reason: "not-configured" });
  }
  try {
    const { username, address } = await req.json();
    if (!isUsername(username) || !isAddress(address)) {
      return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
    }
    if (!(await checkRateLimit("username-claim", address, 10, 300))) {
      return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
    }
    const result = await claimUsername(username, address);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[tap] username claim error:", error);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}
