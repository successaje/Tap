import { NextResponse } from "next/server";
import { registerWatchedLink, kvConfigured } from "@/lib/server/kv";

/**
 * Called after a real link is funded, so the background watcher
 * (app/api/cron/check-claims) knows to check its balance. Best-effort by
 * design: the client fires this without awaiting or blocking on the result —
 * a failed registration only means a missed background push, never a broken
 * transfer.
 */
export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ success: true, persisted: false });
  }
  try {
    const body = await req.json();
    const { linkId, ownerAddress, linkAddress, amountUsd, note } = body;
    if (!linkId || !ownerAddress || !linkAddress || typeof amountUsd !== "number") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    await registerWatchedLink({
      linkId,
      ownerAddress,
      linkAddress,
      amountUsd,
      note,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error("[tap] link register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
