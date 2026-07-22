"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Keypad, applyKey } from "@/components/keypad";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, beginGoogleLogin, authEnabled, type AppUser } from "@/lib/auth";
import { magicUaSigner } from "@/lib/magic";
import { particleEnabled, transferOnArbitrum, getUnifiedBalance } from "@/lib/particle";
import { recordActivity, type ActivityItem } from "@/lib/activity";
import { friendlyError } from "@/lib/errors";
import { recordTransactionStat } from "@/lib/stats";
import { resolveUsername } from "@/lib/username";
import {
  getBeneficiaries,
  saveBeneficiary,
  findBeneficiaryByAddress,
  type Beneficiary,
} from "@/lib/beneficiaries";
import { DepositSheet } from "@/components/deposit-sheet";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { formatUsd, formatLocalInput, localToUsd, usdToLocal } from "@/lib/mock";
import { X, ArrowLeft, BookUser } from "lucide-react";

interface PayRequest {
  to: string;
  from: string;
  amountUsd: number; // 0 ⇒ payer chooses
  note?: string;
}

type Phase = "recipient" | "view" | "paying" | "paid" | "error";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

/**
 * Pay someone — the "I know who I'm paying" flow. Two ways in:
 *  - a Request link (/pay?to=0x…&from=Maya&a=5.00) — skips straight to
 *    "view" with the recipient already fixed, exactly as before.
 *  - standalone, from Home's "Pay" button — starts at "recipient" so the
 *    payer identifies who they're paying by username, a saved recipient,
 *    or a pasted address, then joins the exact same view/paying/paid flow.
 *
 * Deliberately distinct from Cash out (/withdraw): this screen is about
 * paying a *person*; Cash out is about moving money off tap entirely,
 * to a destination that may not be a person at all.
 */
export default function PayPage() {
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);
  const [req, setReq] = useState<PayRequest | null | undefined>(undefined);
  const [user, setUser] = useState<AppUser | null>(null);
  const [amount, setAmount] = useState("0");
  const [phase, setPhase] = useState<Phase>("view");
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [available, setAvailable] = useState<number | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [receiptItem, setReceiptItem] = useState<ActivityItem | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [handle, setHandle] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [saveLabel, setSaveLabel] = useState("");
  const [savedBeneficiary, setSavedBeneficiary] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- post-hydration URL + storage read */
    const q = new URLSearchParams(window.location.search);
    const to = q.get("to");
    const u = getUser();
    setUser(u);
    setBeneficiaries(getBeneficiaries());

    if (!to) {
      setStandalone(true);
      setPhase("recipient");
      setReq(null);
    } else if (!isAddress(to)) {
      setReq(null); // a broken or tampered link — distinct from standalone
    } else {
      const amountUsd = Number(q.get("a")) || 0;
      setReq({
        to,
        from: q.get("from") || "Someone",
        amountUsd,
        note: q.get("n") || undefined,
      });
      if (amountUsd > 0) setAmount(usdToLocal(amountUsd).toFixed(2));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    if (particleEnabled && u?.address) {
      getUnifiedBalance(u.address).then((b) => setAvailable(b?.totalUsd ?? 0));
    }
  }, []);

  const numericLocal = parseFloat(amount) || 0;
  const numericUsd = localToUsd(numericLocal);
  const fixed = (req?.amountUsd ?? 0) > 0;
  const insufficientBalance =
    available !== null && numericUsd > 0 && available < numericUsd;

  async function signIn() {
    if (loggingIn) return;
    setLoggingIn(true);
    haptic();
    try {
      await beginGoogleLogin(); // returns to this exact URL
    } catch {
      setLoggingIn(false);
    }
  }

  function selectRecipient(address: string, label: string) {
    haptic(10);
    setReq({ to: address, from: label, amountUsd: 0, note: undefined });
    setAmount("0");
    setPhase("view");
  }

  async function resolveAndContinue() {
    if (!handle.trim() || resolving) return;
    haptic(10);
    setResolving(true);
    setResolveError(null);
    const trimmed = handle.trim();
    let address: string | null = null;
    let label = "";
    if (isAddress(trimmed)) {
      address = trimmed;
      label = shorten(trimmed);
    } else {
      const cleaned = trimmed.replace(/^@/, "").toLowerCase();
      address = await resolveUsername(cleaned);
      label = `@${cleaned}`;
    }
    setResolving(false);
    if (!address) {
      setResolveError("Couldn't find that — check the username or address.");
      return;
    }
    if (address.toLowerCase() === user?.address?.toLowerCase()) {
      setResolveError("That's your own address.");
      return;
    }
    selectRecipient(address, label);
  }

  async function pay() {
    if (!req || numericLocal <= 0) return;
    haptic(20);
    setPhase("paying");
    try {
      let url: string | null = null;
      if (particleEnabled && user?.address) {
        const receipt = await transferOnArbitrum(
          user.address,
          req.to,
          numericUsd,
          magicUaSigner()
        );
        url = receipt.explorerUrl;
        recordTransactionStat("pay", receipt.sentUsd);
      } else {
        // Mock fallback keeps the flow demoable without credentials.
        await new Promise((r) => setTimeout(r, 1400));
      }
      const recorded = recordActivity({
        type: "sent",
        kind: "direct",
        amountUsd: numericUsd,
        counterparty: req.from,
        note: req.note,
        status: "settled",
        explorerUrl: url ?? undefined,
      });
      setReceiptItem(recorded);
      haptic([0, 30, 40, 60]);
      setPhase("paid");
    } catch (err) {
      console.error("[tap:pay] pay error:", err);
      setError(friendlyError(err));
      setPhase("error");
    }
  }

  if (req === undefined) return null;

  if (req === null && !standalone) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <p className="text-lg font-semibold">This request isn&apos;t valid</p>
        <p className="mt-2 text-sm text-slate-500">
          Ask for a fresh link and try again.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-5">
      <header className="flex items-center justify-between">
        {standalone ? (
          <button
            onClick={() => {
              haptic(10);
              if (phase === "recipient") router.push("/");
              else setPhase("recipient");
            }}
            className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-200"
            aria-label={phase === "recipient" ? "Close" : "Back"}
          >
            {phase === "recipient" ? <X size={22} strokeWidth={2} /> : <ArrowLeft size={22} strokeWidth={2} />}
          </button>
        ) : (
          <span className="size-10" />
        )}
        <p className="font-semibold">
          {phase === "recipient" ? "Pay someone" : `Pay ${req?.from ?? ""}`}
        </p>
        <span className="size-10" />
      </header>

      <AnimatePresence mode="wait">
        {phase === "recipient" && (
          <motion.div
            key="recipient"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="flex flex-1 flex-col"
          >
            <div className="flex flex-1 flex-col justify-center">
              <motion.h2 variants={rise} className="text-center text-2xl font-semibold tracking-tight text-slate-900">
                Who are you paying?
              </motion.h2>
              <motion.p variants={rise} className="mx-auto mt-2 max-w-[18rem] text-center text-sm text-slate-500">
                Enter a username or paste an address — lands instantly, no link needed.
              </motion.p>

              <motion.div
                variants={rise}
                className="mt-8 flex items-center gap-2 rounded-3xl border border-slate-200 bg-white p-2 pl-4 shadow-ios"
              >
                <input
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setResolveError(null);
                  }}
                  placeholder="username or 0x address"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 bg-transparent py-2 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-300"
                />
              </motion.div>
              {resolveError && (
                <motion.p variants={rise} className="mt-3 text-center text-xs font-medium text-red-500">
                  {resolveError}
                </motion.p>
              )}

              {beneficiaries.length > 0 && (
                <motion.div variants={rise} className="mt-7">
                  <h3 className="ml-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <BookUser size={13} strokeWidth={2} /> Saved
                  </h3>
                  <div className="mt-3 space-y-2">
                    {beneficiaries.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => selectRecipient(b.address, b.label)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-ios transition-transform active:scale-[0.98]"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-accent">
                          {b.label[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{b.label}</span>
                          <span className="block font-mono text-xs text-slate-400">{shorten(b.address)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <motion.button
              variants={rise}
              whileTap={{ scale: 0.97 }}
              onClick={resolveAndContinue}
              disabled={!handle.trim() || resolving}
              className="h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
            >
              {resolving ? "Looking up…" : "Continue"}
            </motion.button>
          </motion.div>
        )}

        {phase === "view" && req && (
          <motion.div
            key="view"
            className="flex flex-1 flex-col"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <motion.div
                variants={rise}
                className="flex size-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-accent"
                aria-hidden
              >
                {req.from[0]}
              </motion.div>
              <motion.p variants={rise} className="mt-5 text-lg text-slate-500">
                {standalone ? `Paying ${req.from}` : `${req.from} ${fixed ? "requests" : "wants to get paid"}`}
              </motion.p>
              <motion.p
                variants={rise}
                className={`mt-1 text-6xl font-semibold leading-none tracking-tighter tabular-nums ${
                  numericLocal === 0 ? "text-slate-300" : "text-slate-900"
                }`}
              >
                {formatLocalInput(numericLocal)}
              </motion.p>
              {req.note && (
                <motion.p
                  variants={rise}
                  className="mt-4 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-600"
                >
                  {req.note}
                </motion.p>
              )}
            </div>

            {!fixed && <Keypad onKey={(k) => setAmount((p) => applyKey(p, k))} />}

            {user ? (
              insufficientBalance ? (
                <>
                  <motion.p variants={rise} className="mt-3 text-center text-sm font-medium text-amber-600">
                    You have {formatUsd(available ?? 0)} — not enough to cover this.
                  </motion.p>
                  <motion.button
                    variants={rise}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      haptic(10);
                      setDepositOpen(true);
                    }}
                    className="mt-2 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white"
                  >
                    Fund your account
                  </motion.button>
                </>
              ) : (
                <motion.button
                  variants={rise}
                  whileTap={{ scale: 0.96 }}
                  onClick={pay}
                  disabled={numericLocal <= 0}
                  className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-40"
                >
                  Pay {numericLocal > 0 ? formatUsd(numericUsd) : ""}
                </motion.button>
              )
            ) : (
              <motion.button
                variants={rise}
                whileTap={{ scale: 0.96 }}
                onClick={signIn}
                disabled={loggingIn || !authEnabled}
                className="mt-3 h-14 w-full rounded-full btn-tap text-lg font-semibold text-white disabled:opacity-70"
              >
                {loggingIn ? "Opening Google…" : "Sign in to pay"}
              </motion.button>
            )}
            <p className="mt-3 text-center text-xs text-slate-400">
              Paid from your one balance &middot; settles on Arbitrum
            </p>
          </motion.div>
        )}

        {phase === "paying" && (
          <motion.div
            key="paying"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <RippleMark size={56} animate />
            <p className="mt-6 text-lg font-semibold">
              Paying {formatUsd(numericUsd)}…
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Sourcing across chains &middot; settling on Arbitrum
            </p>
          </motion.div>
        )}

        {phase === "paid" && req && (
          <motion.div
            key="paid"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: springs.bouncy }}
              className="flex size-16 items-center justify-center rounded-full bg-green-100"
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.div>
            <p className="mt-5 text-2xl font-semibold tracking-tight">
              Paid {formatUsd(numericUsd)}
            </p>
            <p className="mt-1 text-slate-500">to {req.from}</p>
            {receiptItem && (
              <button
                onClick={() => {
                  haptic(10);
                  setReceiptOpen(true);
                }}
                className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                View receipt
              </button>
            )}

            {!savedBeneficiary && !findBeneficiaryByAddress(req.to) && (
              <div className="mt-6 w-full max-w-[19rem] rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-ios">
                <p className="text-xs font-semibold text-slate-500">Save this recipient?</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder={req.from}
                    className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => {
                      haptic(10);
                      saveBeneficiary(saveLabel || req.from, req.to);
                      setSavedBeneficiary(true);
                    }}
                    className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition-transform active:scale-95"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            {savedBeneficiary && (
              <p className="mt-4 text-xs font-medium text-emerald-600">Saved ✓ — it&apos;ll show up next time.</p>
            )}

            <button
              onClick={() => router.push("/")}
              className="mt-8 h-12 rounded-full bg-accent px-10 font-semibold text-white"
            >
              Done
            </button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            className="flex flex-1 flex-col items-center justify-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-red-50 text-2xl">
              !
            </div>
            <p className="mt-5 text-lg font-semibold">Payment didn&apos;t go through</p>
            <p className="mt-2 max-w-[18rem] text-sm text-slate-500">{error}</p>
            <div className="mt-6 flex items-center gap-3">
              {error?.includes("Not enough balance") && (
                <button
                  onClick={() => {
                    haptic(10);
                    setDepositOpen(true);
                  }}
                  className="h-12 rounded-full border border-slate-200 px-6 font-semibold text-slate-700"
                >
                  Fund your account
                </button>
              )}
              <button
                onClick={() => setPhase("view")}
                className="h-12 rounded-full bg-accent px-8 font-semibold text-white"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DepositSheet
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        address={user?.address ?? null}
      />
      <ReceiptSheet
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        activity={receiptItem}
      />
    </main>
  );
}
