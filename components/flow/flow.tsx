"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { ClaimScreen } from "@/components/flow/claim";
import { LoginScreen } from "@/components/flow/login";
import { ClaimMoment } from "@/components/flow/claim-moment";
import { SuccessScreen } from "@/components/flow/success";
import { SendScreen } from "@/components/flow/send";
import { RippleMark } from "@/components/logo";
import { addToBalance, getBalance } from "@/lib/store";
import { authEnabled, consumeReturnStep, getUser } from "@/lib/auth";
import { claimFundedLink } from "@/lib/links";
import { recordActivity } from "@/lib/activity";
import { particleEnabled, type TransferReceipt } from "@/lib/particle";
import type { PaymentLink } from "@/lib/mock";

type Step = "claim" | "login" | "moment" | "success" | "send";

/**
 * The hero flow orchestrator. Holds the step machine and the mock link/balance
 * state; AnimatePresence gives every screen change a spring transition.
 * Each mock action (signIn, addToBalance, createLink) is a seam the real SDKs
 * replace later.
 */
export function Flow({
  initialLink,
  claimKey,
}: {
  initialLink: PaymentLink;
  /** Present for real links: the throwaway key that owns the link's funds. */
  claimKey?: string;
}) {
  const [step, setStep] = useState<Step>("claim");
  const [link, setLink] = useState<PaymentLink>(initialLink);
  const [balance, setBalance] = useState(0);
  const [receipt, setReceipt] = useState<TransferReceipt | null>(null);
  // With real auth, wait one tick to check for a redirect return before
  // painting — avoids flashing the claim screen before jumping to the moment.
  const [ready, setReady] = useState(!authEnabled);

  useEffect(() => {
    if (!authEnabled) return;
    // One-shot post-hydration read of session/local storage (SSR can't see it;
    // a lazy initializer would cause a hydration mismatch). Intentional.
    /* eslint-disable react-hooks/set-state-in-effect */
    const resume = consumeReturnStep();
    const user = getUser();
    if (resume && user) {
      setLink((l) => ({ ...l, status: "bound", boundTo: user.email }));
      setStep(resume as Step);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RippleMark size={48} animate />
      </div>
    );
  }

  return (
    // mode="popLayout" lets the incoming screen animate in while the outgoing
    // one leaves, over an absolutely-positioned stack. LayoutGroup enables the
    // shared-element morph: the amount (layoutId="amount") flies between screens.
    <div className="relative flex-1 overflow-hidden">
      <LayoutGroup>
        <AnimatePresence mode="popLayout" initial={false}>
        {step === "claim" && (
          <ClaimScreen
            key="claim"
            link={link}
            onContinue={() => setStep("login")}
          />
        )}

        {step === "login" && (
          <LoginScreen
            key="login"
            link={link}
            onSignedIn={(user) => {
              // Link binds to this identity on first login (security model).
              setLink((l) => ({ ...l, status: "bound", boundTo: user.email }));
              setStep("moment");
            }}
          />
        )}

        {step === "moment" && (
          <ClaimMoment
            key="moment"
            link={link}
            claim={claimKey ? () => claimFundedLink(claimKey) : undefined}
            onDone={(r) => {
              setLink((l) => ({ ...l, status: "claimed" }));
              if (r) {
                // Real claim: the money moved on-chain.
                setReceipt(r);
                setBalance(r.sentUsd);
              } else {
                addToBalance(link.amountUsd);
                setBalance(getBalance());
              }
              // Only real claims write history. The "see how it works" demo
              // must never pollute the ledger once real rails are live —
              // in pure-mock environments (no Particle keys) it still records
              // so the app feels alive.
              if (r || !particleEnabled) {
                recordActivity({
                  type: "received",
                  amountUsd: r?.sentUsd ?? link.amountUsd,
                  counterparty: link.senderName,
                  note: link.note,
                  status: "settled",
                  explorerUrl: r?.explorerUrl,
                  txId: r?.transactionId,
                });
              }
              setStep("success");
            }}
          />
        )}

        {step === "success" && (
          <SuccessScreen
            key="success"
            balance={balance}
            explorerUrl={receipt?.explorerUrl}
            onSend={() => setStep("send")}
          />
        )}

        {step === "send" && (
          <SendScreen key="send" onClose={() => setStep("success")} />
        )}
      </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}
