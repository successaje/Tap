"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Copy, Gift, Share2, ArrowLeft } from "lucide-react";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser } from "@/lib/auth";
import { getActivity } from "@/lib/activity";

// Points are earned from real money moved through tap — 100 per $1 — so the
// number reflects what you've actually done, not a hardcoded figure.
const PER_USD = 100;

const TIERS = [
  { name: "Starter", min: 0, ring: "text-slate-400", bg: "bg-slate-100" },
  { name: "Silver", min: 2_500, ring: "text-slate-500", bg: "bg-slate-100" },
  { name: "Gold", min: 10_000, ring: "text-amber-500", bg: "bg-amber-50" },
  { name: "Platinum", min: 25_000, ring: "text-indigo-500", bg: "bg-indigo-50" },
] as const;

export default function RewardsPage() {
  const router = useRouter();
  const [points, setPoints] = useState(0);
  const [refCode, setRefCode] = useState("you");
  // Host starts as the brand default so the first client render matches SSR;
  // the effect swaps in the real host to avoid a hydration mismatch.
  const [host, setHost] = useState("tap.cash");
  const [copied, setCopied] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- post-hydration reads */
  useEffect(() => {
    const volume = getActivity().reduce((sum, a) => sum + Math.abs(a.amountUsd), 0);
    setPoints(Math.round(volume * PER_USD));
    setHost(window.location.host);
    const u = getUser();
    if (u) setRefCode((u.name?.split(" ")[0] || u.email?.split("@")[0] || "you").toLowerCase());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { tier, next, progress, toNext } = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < TIERS.length; i++) if (points >= TIERS[i].min) idx = i;
    const tier = TIERS[idx];
    const next = TIERS[idx + 1] ?? null;
    const progress = next
      ? (points - tier.min) / (next.min - tier.min)
      : 1;
    const toNext = next ? next.min - points : 0;
    return { tier, next, progress, toNext };
  }, [points]);

  const referralLink = `${host}/?ref=${refCode}`;

  async function copyLink() {
    haptic(10);
    await navigator.clipboard
      .writeText(`https://${referralLink}`)
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            haptic(10);
            router.push("/");
          }}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-100"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <p className="font-semibold tracking-tight text-slate-900">Rewards</p>
        <span className="size-10" />
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-8 flex flex-col items-center text-center"
      >
        <motion.div
          variants={rise}
          className={`flex size-20 items-center justify-center rounded-3xl shadow-ios ${tier.bg} ${tier.ring}`}
        >
          <Gift size={32} strokeWidth={1.5} />
        </motion.div>

        <motion.h1
          variants={rise}
          className="mt-6 text-4xl font-semibold tracking-tighter text-slate-900"
        >
          {tier.name}
        </motion.h1>
        <motion.p variants={rise} className="mt-2 text-sm font-medium text-slate-500">
          {next
            ? `${toNext.toLocaleString()} pts to ${next.name}`
            : "You've reached the top tier 🎉"}
        </motion.p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.2 } }}
        className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-ios"
      >
        <p className="text-sm font-medium text-slate-400">Total points</p>
        <p className="mt-1 text-5xl font-semibold tracking-tighter tabular-nums text-slate-900">
          {points.toLocaleString()}
        </p>

        <div className="mt-8 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-accent shadow-[0_0_10px_rgba(15,82,255,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(4, Math.min(100, progress * 100))}%` }}
            transition={{ ...springs.snappy, delay: 0.4 }}
          />
        </div>
        <p className="mt-3 text-left text-xs font-semibold text-slate-400">
          {points === 0
            ? "Send or claim your first payment to start earning."
            : `Earned from $${(points / PER_USD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} moved through tap`}
        </p>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.3 } }}
        className="mt-10"
      >
        <h2 className="text-sm font-semibold text-slate-900">Invite friends</h2>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Earn 500 points for every friend who sends their first link.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={copyLink}
            className="flex h-14 flex-1 items-center justify-between rounded-full border border-slate-100 bg-white px-5 shadow-sm transition-transform active:scale-95"
          >
            <span className="truncate font-mono text-sm font-medium text-slate-600">
              {referralLink}
            </span>
            {copied ? (
              <span className="shrink-0 text-xs font-semibold text-accent">Copied!</span>
            ) : (
              <Copy size={16} className="shrink-0 text-slate-400" />
            )}
          </button>

          <button
            className="flex size-14 items-center justify-center rounded-full btn-tap text-white transition-transform active:scale-95"
            onClick={async () => {
              haptic();
              if (navigator.share) {
                await navigator
                  .share({ title: "tap", text: "Send money with a link on tap", url: `https://${referralLink}` })
                  .catch(() => {});
              } else {
                copyLink();
              }
            }}
            aria-label="Share invite"
          >
            <Share2 size={18} strokeWidth={2} />
          </button>
        </div>
      </motion.section>
    </main>
  );
}
