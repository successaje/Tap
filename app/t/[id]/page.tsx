"use client";

import { use, useEffect, useState } from "react";
import { Flow } from "@/components/flow/flow";
import { Logo } from "@/components/logo";
import { parseClaimLink, type ClaimableLink } from "@/lib/links";
import type { PaymentLink } from "@/lib/mock";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Real claim links: /t/<id>?from=<sender>&a=<amount>#k=<claim key>.
 * The key lives in the fragment, so only the browser ever sees it.
 * Client component because the fragment is unreadable on the server.
 */
interface ParsedClaim {
  payment: PaymentLink;
  claimKey: string;
}

function toPaymentLink(link: ClaimableLink): PaymentLink {
  return {
    id: link.id,
    amountUsd: link.amountUsd,
    senderName: link.senderName,
    note: link.note,
    status: "unclaimed",
    boundTo: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
  };
}

export default function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [link, setLink] = useState<ParsedClaim | null | undefined>(undefined);

  useEffect(() => {
    // One-shot post-hydration read of the URL fragment (SSR can't see it).
    const parsed = parseClaimLink(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(
      parsed ? { payment: toPaymentLink(parsed), claimKey: parsed.claimKey } : null
    );
  }, [id]);

  // Fragment not parsed yet (first client tick).
  if (link === undefined) return null;

  if (link === null) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Logo className="h-8" />
        <p className="mt-6 text-lg font-semibold">This link isn&apos;t valid</p>
        <p className="mt-2 max-w-[16rem] text-sm text-slate-500">
          It may have been mistyped or already reclaimed by the sender. Ask
          them to send a fresh one.
        </p>
      </main>
    );
  }

  return <Flow initialLink={link.payment} claimKey={link.claimKey} />;
}
