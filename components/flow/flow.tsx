"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ClaimScreen } from "@/components/flow/claim";
import { LoginScreen } from "@/components/flow/login";
import { ClaimMoment } from "@/components/flow/claim-moment";
import { SuccessScreen } from "@/components/flow/success";
import { SendScreen } from "@/components/flow/send";
import { addToBalance, getBalance } from "@/lib/store";
import type { PaymentLink } from "@/lib/mock";

type Step = "claim" | "login" | "moment" | "success" | "send";

/**
 * The hero flow orchestrator. Holds the step machine and the mock link/balance
 * state; AnimatePresence gives every screen change a spring transition.
 * Each mock action (signIn, addToBalance, createLink) is a seam the real SDKs
 * replace later.
 */
export function Flow({ initialLink }: { initialLink: PaymentLink }) {
  const [step, setStep] = useState<Step>("claim");
  const [link, setLink] = useState<PaymentLink>(initialLink);
  const [balance, setBalance] = useState(0);

  return (
    // mode="popLayout" lets the incoming screen animate in while the outgoing
    // one leaves, over an absolutely-positioned stack.
    <div className="relative flex-1 overflow-hidden">
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
            onDone={() => {
              setLink((l) => ({ ...l, status: "claimed" }));
              addToBalance(link.amountUsd);
              setBalance(getBalance());
              setStep("success");
            }}
          />
        )}

        {step === "success" && (
          <SuccessScreen
            key="success"
            balance={balance}
            onSend={() => setStep("send")}
          />
        )}

        {step === "send" && (
          <SendScreen key="send" onClose={() => setStep("success")} />
        )}
      </AnimatePresence>
    </div>
  );
}
