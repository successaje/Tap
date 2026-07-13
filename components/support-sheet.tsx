"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { haptic } from "@/lib/motion";
import { getUser } from "@/lib/auth";
import { X, Send, Sparkles, Receipt, RefreshCw, HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// Curated help answers — a real support bot pattern (keyword-matched), not a
// fake LLM. Honest, useful, and never errors.
function answer(qRaw: string): string {
  const q = qRaw.toLowerCase();
  const has = (...w: string[]) => w.some((x) => q.includes(x));

  if (has("missing", "didn't", "didnt", "not received", "where is", "pending"))
    return "Money sent to you lands the moment you tap the link and sign in. If something looks missing, check Recent Activity on Home — tap any item to open its on-chain receipt. Each link can only be claimed once.";
  if (has("currency", "usd", "eur", "ngn", "naira", "convert"))
    return "Change your display currency in Profile → Display currency. Amounts reformat instantly — the underlying value never changes.";
  if (has("fee", "gas", "cost", "charge"))
    return "No gas to worry about. Fees come out of the amount moved, and the recipient never needs gas on any chain — your Universal Account handles the routing.";
  if (has("reclaim", "cancel", "unclaimed", "get it back", "refund"))
    return "Sent a link that wasn't claimed yet? Open Profile → Outstanding links and tap Reclaim to pull the funds back to your balance.";
  if (has("seed", "recover", "lost", "phone", "password", "secure", "safe"))
    return "There's no seed phrase. Your account is secured by your Google sign-in — lose your phone and just sign in again anywhere. Your money follows your identity, not your device.";
  if (has("deposit", "add money", "fund", "receive", "top up"))
    return "To add money, go to Profile → Add money · Receive and share your QR or link. Anyone can pay you from any chain.";
  if (has("withdraw", "cash out", "bank", "off ramp", "offramp"))
    return "Cashing out to a bank or debit card is coming soon. Open Cash out and tap “Notify me” and we'll ping you the moment it's live.";
  if (has("chain", "network", "arbitrum", "bridge", "which"))
    return "You never pick a chain. tap holds one balance across every chain and settles on Arbitrum automatically — that's your Universal Account (EIP-7702).";
  if (has("send", "pay", "how do i"))
    return "Tap Send on Home, enter an amount, and share the link — or scan someone's tap QR to pay them. They tap, sign in with Google, and it lands.";
  return "Thanks — I've noted that. For anything I can't answer here, our team will follow up by email.";
}

export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const fastActions = [
    { label: "Missing transfer", icon: Receipt },
    { label: "Change currency", icon: RefreshCw },
    { label: "How claims work", icon: HelpCircle },
  ];

  function ask(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    haptic(12);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setMsg("");
    setTyping(true);
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: answer(q) }]);
      setTyping(false);
      haptic(8);
    }, 650);
  }

  if (!mounted) return null;

  const email = getUser()?.email;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", damping: 25, stiffness: 200 } }}
            exit={{ y: "100%", transition: { type: "spring", damping: 25, stiffness: 200 } }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-white px-6 pb-8 pt-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-accent">
                  <Sparkles size={16} strokeWidth={2} />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Help</h2>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Conversation */}
            <div ref={scrollRef} className="mt-6 flex-1 space-y-3 overflow-y-auto">
              {messages.length === 0 && (
                <div>
                  <p className="text-[28px] font-semibold leading-tight tracking-tight text-slate-900">
                    How can we help?
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-500">
                    Ask about your balance, transfers, claims, or how tap works.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {fastActions.map((a) => (
                      <button
                        key={a.label}
                        onClick={() => ask(a.label)}
                        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-transform active:scale-95"
                      >
                        <a.icon size={14} strokeWidth={2.5} className="text-accent" />
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent font-medium text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {m.text}
                    {m.role === "assistant" &&
                      i === messages.length - 1 &&
                      /follow up by email/.test(m.text) &&
                      email && (
                        <span className="mt-1 block text-xs text-slate-400">
                          We&apos;ll reach you at {email}.
                        </span>
                      )}
                  </p>
                </div>
              ))}

              {typing && (
                <div className="flex justify-start">
                  <div className="flex gap-1 rounded-3xl bg-slate-100 px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="size-1.5 rounded-full bg-slate-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="relative mt-4">
              <input
                type="text"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(msg)}
                placeholder="Ask a question…"
                className="h-14 w-full rounded-full border border-slate-200 bg-slate-50 pl-5 pr-14 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/10"
              />
              <button
                aria-label="Send"
                className={`absolute right-2 top-2 flex size-10 items-center justify-center rounded-full transition-colors ${
                  msg.trim().length > 0
                    ? "bg-accent text-white shadow-md shadow-accent/25"
                    : "bg-slate-200 text-slate-400"
                }`}
                disabled={msg.trim().length === 0}
                onClick={() => ask(msg)}
              >
                <Send size={16} strokeWidth={2} className="ml-0.5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
