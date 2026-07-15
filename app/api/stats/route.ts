import { NextResponse } from "next/server";
import { recordTransaction, getStats, checkRateLimit, kvConfigured, TX_KINDS } from "@/lib/server/kv";
import { isReasonableAmount, isTxKind } from "@/lib/server/validate";

/**
 * Real-usage numbers for the submission ("N transactions, $X moved") — the
 * app has no backend for anything else, but this one counter is the honest
 * way to answer "how do you know this actually happened" without needing to
 * hand-tally a block explorer. Recording is best-effort and never blocks a
 * real transfer, same as the push-registration calls it sits next to.
 */
export async function GET() {
  if (!kvConfigured) {
    return NextResponse.json({ configured: false, count: 0, volumeUsd: 0, byKind: {} });
  }
  const stats = await getStats();
  let count = 0;
  let volumeUsd = 0;
  const byKind: Record<string, { count: number; volumeUsd: number }> = {};
  for (const kind of TX_KINDS) {
    const kindCount = stats[`${kind}Count`] ?? 0;
    const kindVolume = stats[`${kind}Volume`] ?? 0;
    byKind[kind] = { count: kindCount, volumeUsd: kindVolume };
    count += kindCount;
    volumeUsd += kindVolume;
  }
  return NextResponse.json({ configured: true, count, volumeUsd, byKind });
}

export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ success: true, persisted: false });
  }
  try {
    const { kind, amountUsd } = await req.json();
    if (!isTxKind(kind) || !isReasonableAmount(amountUsd)) {
      return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
    }
    // No session to key a rate limit on — best available proxy is the
    // client's IP via the platform-forwarded header.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit("stats", ip, 60, 600))) {
      return NextResponse.json({ success: true, persisted: false });
    }
    await recordTransaction(kind, amountUsd);
    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error("[tap] stats record error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
