import { NextResponse } from "next/server";
import { unregisterWatchedLink, kvConfigured } from "@/lib/server/kv";
import { isLinkId } from "@/lib/server/validate";

/**
 * Called when a link is claimed (detected client-side) or reclaimed by the
 * sender, so the background watcher stops checking it and never fires a
 * redundant push for something the client already handled. Best-effort,
 * same as register — never blocks the real on-chain action.
 */
export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ success: true });
  }
  try {
    const { linkId } = await req.json();
    if (!isLinkId(linkId)) {
      return NextResponse.json({ error: "Invalid linkId" }, { status: 400 });
    }
    await unregisterWatchedLink(linkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[tap] link unregister error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
