import { NextResponse } from "next/server";
import {
  createSplit,
  getSplit,
  recordSplitContribution,
  checkRateLimit,
  kvConfigured,
} from "@/lib/server/kv";
import { isAddress, isSplitId, isReasonableAmount, sanitizeNote } from "@/lib/server/validate";

/**
 * A split is a Request more than one person can pay into. Each contribution
 * is still a normal, direct on-chain transfer straight to the owner's
 * address (see app/pay) — this endpoint only tracks progress, it never
 * holds funds. See createSplit's docstring in lib/server/kv.ts for why this
 * state is durable rather than best-effort, unlike most of this file.
 */
export async function GET(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!isSplitId(id)) {
    return NextResponse.json({ error: "Invalid split id" }, { status: 400 });
  }
  const split = await getSplit(id);
  if (!split) {
    return NextResponse.json({ error: "Split not found" }, { status: 404 });
  }
  return NextResponse.json(split);
}

export async function POST(req: Request) {
  if (!kvConfigured) {
    return NextResponse.json({ ok: false, reason: "not-configured" }, { status: 501 });
  }
  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (body.action === "create") {
      const { id, ownerAddress, ownerName, targetUsd, note } = body;
      if (!isSplitId(id) || !isAddress(ownerAddress) || !isReasonableAmount(targetUsd)) {
        return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
      }
      if (!(await checkRateLimit("split-create", ownerAddress, 20, 600))) {
        return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
      }
      const ok = await createSplit({
        id,
        ownerAddress,
        ownerName: String(ownerName || "Someone").slice(0, 60),
        targetUsd,
        note: sanitizeNote(note),
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok });
    }

    if (body.action === "contribute") {
      const { id, amountUsd, label } = body;
      if (!isSplitId(id) || !isReasonableAmount(amountUsd)) {
        return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
      }
      if (!(await checkRateLimit("split-contribute", ip, 30, 600))) {
        return NextResponse.json({ ok: false, reason: "rate-limited" }, { status: 429 });
      }
      const ok = await recordSplitContribution(id, amountUsd, String(label || "Someone").slice(0, 60));
      return NextResponse.json({ ok });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[tap] split error:", error);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}
