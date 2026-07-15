import { NextResponse } from "next/server";
import { registerWatchedLink, checkRateLimit, kvConfigured } from "@/lib/server/kv";
import { isAddress, isLinkId, isReasonableAmount, sanitizeNote } from "@/lib/server/validate";

/**
 * Called after a real link is funded, so the background watcher
 * (app/api/cron/check-claims) knows to check its balance. Best-effort by
 * design: the client fires this without awaiting or blocking on the result —
 * a failed registration only means a missed background push, never a broken
 * transfer. Validation here exists to bound the cron loop's cost and the
 * shared Redis store's size against spam, not to authenticate the caller —
 * this app has no server-verified session to check ownership against.
 */
export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ success: true, persisted: false });
  }
  try {
    const body = await req.json();
    const { linkId, ownerAddress, linkAddress, amountUsd, note } = body;
    if (!isLinkId(linkId) || !isAddress(ownerAddress) || !isAddress(linkAddress) || !isReasonableAmount(amountUsd)) {
      return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    }
    if (!(await checkRateLimit("register", ownerAddress, 20, 300))) {
      return NextResponse.json({ success: true, persisted: false });
    }
    const persisted = await registerWatchedLink({
      linkId,
      ownerAddress,
      linkAddress,
      amountUsd,
      note: sanitizeNote(note),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, persisted });
  } catch (error) {
    console.error("[tap] link register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
