"use client";

import { useEffect, useState } from "react";
import { Flow } from "@/components/flow/flow";
import { ClaimUnavailable } from "@/components/flow/claim-unavailable";
import { parseClaimLink, getLinkBalance, type ClaimableLink } from "@/lib/links";
import { particleEnabled } from "@/lib/particle";
import { hasReceivedLink } from "@/lib/activity";
import type { PaymentLink } from "@/lib/mock";

const DAY = 24 * 60 * 60 * 1000;

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

/**
 * Real claim links: /t/<id>?from=<sender>&a=<amount>#k=<claim key>.
 * The key lives in the fragment, so only the browser ever sees it.
 * A background balance check catches already-claimed links up front — the
 * reveal shows optimistically and only swaps to the edge state if empty.
 */
export function ClaimView({ id }: { id: string }) {
  const [link, setLink] = useState<ParsedClaim | null | undefined>(undefined);
  const [emptied, setEmptied] = useState(false);

  useEffect(() => {
    // One-shot post-hydration read of the URL fragment (SSR can't see it).
    const parsed = parseClaimLink(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(
      parsed ? { payment: toPaymentLink(parsed), claimKey: parsed.claimKey } : null
    );

    if (!parsed || !particleEnabled) return;
    let cancelled = false;
    // Real links only: confirm the wallet still holds funds.
    getLinkBalance(parsed.claimKey)
      .then((bal) => {
        if (!cancelled && bal <= 0.01) setEmptied(true);
      })
      .catch(() => {
        /* leave the optimistic reveal; claim-time handles a hard failure */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fragment not parsed yet (first client tick).
  if (link === undefined) return null;
  if (link === null) return <ClaimUnavailable reason="invalid" />;

  if (emptied) {
    return (
      <ClaimUnavailable
        reason="claimed"
        amountUsd={link.payment.amountUsd}
        senderName={link.payment.senderName}
        // Only ever true from local evidence on this exact device — a
        // different device claiming the same link has no way to know that
        // here, so it falls back to the generic "someone" copy, correctly.
        claimedByYou={hasReceivedLink(link.payment.id)}
      />
    );
  }

  return <Flow initialLink={link.payment} claimKey={link.claimKey} />;
}
