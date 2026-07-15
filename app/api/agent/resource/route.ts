import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerBalanceUsd, particleServerEnabled } from "@/lib/server/particle-watch";
import {
  createAgentChallenge,
  getAgentChallenge,
  consumeAgentChallenge,
  checkRateLimit,
  kvConfigured,
} from "@/lib/server/kv";

/**
 * A minimal, real x402 endpoint: a machine client pays before it gets data,
 * with no human and no signup involved. See scripts/agent-demo.mjs for the
 * paying side — it uses tap's exact same account primitives
 * (Universal Account, EIP-7702, real USDC on Arbitrum), just triggered by
 * code instead of a human's tap.
 *
 * Payment is verified by balance delta — the receiver's balance at the
 * moment a 402 is issued, compared against its balance when the client
 * retries with proof — not by parsing an individual transaction's receipt.
 * That's a deliberate simplification for a demo, not a production payment
 * gateway: it can't distinguish which of several concurrently-open
 * challenges a given payment was "for" if more than one is outstanding
 * against the same receiver at once. Fine for one demo agent hitting this
 * once at a time; not the design a real x402 facilitator would ship.
 */
const RECEIVER = process.env.AGENT_DEMO_RECEIVER_ADDRESS;
const PRICE_USD = Number(process.env.AGENT_DEMO_PRICE_USD || "0.02");
const CONFIRM_TOLERANCE_USD = 0.001;

export async function GET(req: Request) {
  if (!kvConfigured || !particleServerEnabled || !RECEIVER) {
    return NextResponse.json(
      { error: "Agent demo isn't configured on this deployment" },
      { status: 501 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit("agent-resource", ip, 30, 300))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const challengeId = req.headers.get("x-payment-id");
  const txId = req.headers.get("x-payment-tx");

  if (challengeId && txId) {
    const challenge = await getAgentChallenge(challengeId);
    if (!challenge) {
      return NextResponse.json(
        { error: "Unknown or expired payment challenge — request a new one." },
        { status: 400 }
      );
    }
    const currentBalanceUsd = await getServerBalanceUsd(challenge.receiver);
    if (currentBalanceUsd === null) {
      return NextResponse.json(
        { error: "Couldn't verify payment right now — try again." },
        { status: 502 }
      );
    }
    const receivedUsd = currentBalanceUsd - challenge.balanceAtIssueUsd;
    if (receivedUsd + CONFIRM_TOLERANCE_USD < challenge.priceUsd) {
      return NextResponse.json(
        {
          error: "PAYMENT_NOT_CONFIRMED",
          message:
            "Payment not detected yet — cross-chain settlement can take a few seconds. Retry with the same X-Payment-Id.",
          challengeId: challenge.id,
        },
        { status: 402 }
      );
    }
    await consumeAgentChallenge(challengeId);
    return NextResponse.json({
      paidWith: { transactionId: txId, amountUsd: challenge.priceUsd },
      resource: {
        headline: "tap agent-to-agent demo resource",
        insight: "This response only exists because an agent paid for it — no account, no API key, no human involved.",
        generatedAt: new Date().toISOString(),
      },
    });
  }

  const balanceAtIssueUsd = await getServerBalanceUsd(RECEIVER);
  if (balanceAtIssueUsd === null) {
    return NextResponse.json(
      { error: "Couldn't price this request right now — try again." },
      { status: 502 }
    );
  }

  const id = randomUUID();
  await createAgentChallenge({
    id,
    receiver: RECEIVER,
    priceUsd: PRICE_USD,
    balanceAtIssueUsd,
    issuedAt: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      x402Version: 1,
      challengeId: id,
      price: { amount: PRICE_USD.toFixed(2), currency: "USDC" },
      chain: "arbitrum-one",
      receiver: RECEIVER,
      instructions:
        "Pay the exact amount in USDC on Arbitrum to `receiver`, then retry this request with headers X-Payment-Id and X-Payment-Tx.",
    },
    { status: 402 }
  );
}
