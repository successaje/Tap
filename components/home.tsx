"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SupportSheet } from "@/components/support-sheet";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, type AppUser } from "@/lib/auth";
import { getBalance } from "@/lib/store";
import { getUnifiedBalance, type UnifiedBalance } from "@/lib/particle";
import { syncSentLinkClaims } from "@/lib/links";
import { isSubscribed, triggerTestPush } from "@/lib/push";
import { getActivity, pruneDemoArtifacts, timeAgo, type ActivityItem } from "@/lib/activity";
import { formatUsd } from "@/lib/mock";
import { formatCurrency, getExchangeRates } from "@/lib/currency";
import { getSettings, defaultSettings, type Settings, updateSettings } from "@/lib/settings";
import { ArrowUpRight, ArrowDownLeft, CornerDownLeft, Eye, EyeOff, Trophy, MessageSquare, Receipt, UserRound } from "lucide-react";

const typeMeta: Record<
  ActivityItem["type"],
  { icon: React.ReactNode; sign: string; tint: string }
> = {
  // Subtly tinted so the feed is scannable at a glance, without shouting.
  received: { icon: <ArrowDownLeft size={18} strokeWidth={2} />, sign: "+", tint: "bg-emerald-50 text-emerald-600" },
  sent: { icon: <ArrowUpRight size={18} strokeWidth={2} />, sign: "−", tint: "bg-blue-50 text-accent" },
  reclaimed: { icon: <CornerDownLeft size={18} strokeWidth={2} />, sign: "+", tint: "bg-slate-100 text-slate-500" },
};

export function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [mockBalance, setMockBalance] = useState(0);
  const [unified, setUnified] = useState<UnifiedBalance | null | undefined>(undefined);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [receiptItem, setReceiptItem] = useState<ActivityItem | null>(null);

  // Re-run everything that can change: balance, activity, and claim
  // detection. Shared by first mount and pull-to-refresh so there's exactly
  // one code path for "what does fresh data look like."
  async function refreshHome(address: string | undefined) {
    setActivity(getActivity());
    if (!address) return;

    const balancePromise = getUnifiedBalance(address).then((b) => {
      if (b) setUnified(b);
    });

    const claimsPromise = syncSentLinkClaims().then((claimed) => {
      if (claimed.length === 0) return;
      setActivity(getActivity());
      const total = claimed.reduce((s, l) => s + l.amountUsd, 0);
      const message =
        claimed.length === 1
          ? `Your ${formatUsd(claimed[0].amountUsd)} link was claimed 🎉`
          : `${claimed.length} links (${formatUsd(total)}) were claimed 🎉`;
      setToast(message);
      haptic([0, 25, 30, 40]);
      window.setTimeout(() => setToast(null), 5000);
      isSubscribed().then((on) => {
        if (on) triggerTestPush("Money claimed", message, "/");
      });
    });

    await Promise.all([balancePromise, claimsPromise]);
  }

  useEffect(() => {
    // Post-hydration storage reads (SSR can't see them).
    /* eslint-disable react-hooks/set-state-in-effect */
    const u = getUser();
    setUser(u);
    setMockBalance(getBalance());
    pruneDemoArtifacts(); // one-time: drop the demo's fake "Maya" entries
    setActivity(getActivity());
    setSettings(getSettings());
    getExchangeRates().then(setRates);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleSettings = () => setSettings(getSettings());
    window.addEventListener("tap:settings", handleSettings);

    refreshHome(u?.address);

    return () => {
      window.removeEventListener("tap:settings", handleSettings);
    };
  }, []);

  const balance = unified !== undefined && unified !== null ? unified.totalUsd : mockBalance;
  const isLoading = user?.address && unified === undefined;

  async function handlePullRefresh() {
    haptic(10);
    await Promise.all([refreshHome(user?.address), getExchangeRates().then(setRates)]);
  }

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <main className="flex flex-1 flex-col px-6 pb-28 pt-5">
      {/* Claim-landed toast */}
      <AnimatePresence>
        {toast && (
          <motion.button
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: springs.snappy }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
            onClick={() => setToast(null)}
            className="fixed inset-x-6 top-4 z-50 mx-auto max-w-sm rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-ios-heavy"
          >
            {toast}
          </motion.button>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            haptic(10);
            router.push("/profile");
          }}
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-ios active:scale-95 transition-transform"
          aria-label="Profile"
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="size-11 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="font-semibold text-slate-600">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              haptic(10);
              router.push("/rewards");
            }}
            className="flex size-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-ios active:scale-95 transition-transform"
          >
            <Trophy size={20} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => {
              haptic(10);
              setSupportOpen(true);
            }}
            className="flex size-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-ios active:scale-95 transition-transform"
          >
            <MessageSquare size={20} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-12 flex flex-col items-center text-center"
      >
        {isLoading ? (
          <div className="h-[64px] w-48 rounded-2xl bg-slate-100 animate-pulse" />
        ) : (
          <motion.div variants={rise} className="flex items-center gap-3">
            <p className="text-[48px] sm:text-[64px] font-semibold leading-none tracking-tighter tabular-nums text-slate-900 break-words max-w-[280px] sm:max-w-none">
              {settings.hideBalance ? "••••••" : formatCurrency(balance, settings.currency, rates)}
            </p>
            <button 
              onClick={() => {
                haptic(10);
                const next = updateSettings({ hideBalance: !settings.hideBalance });
                setSettings(next);
                window.dispatchEvent(new Event("tap:settings"));
              }}
              className="text-slate-300 hover:text-slate-400 active:scale-95 transition-transform"
            >
              {settings.hideBalance ? <EyeOff size={24} strokeWidth={2} /> : <Eye size={24} strokeWidth={2} />}
            </button>
          </motion.div>
        )}
        
        {unified && unified.chainCount > 0 && (
          <motion.p
            variants={rise}
            className="mx-auto mt-4 inline-block rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500"
          >
            One balance &middot; {unified.chainCount} chain
            {unified.chainCount === 1 ? "" : "s"} underneath
          </motion.p>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.2 } }}
        className="mt-12 grid grid-cols-3 gap-2.5"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/send")}
          className="flex h-14 flex-col items-center justify-center gap-1 rounded-3xl btn-tap text-xs font-semibold text-white"
        >
          <ArrowUpRight size={19} strokeWidth={2.5} />
          Send
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/pay")}
          className="flex h-14 flex-col items-center justify-center gap-1 rounded-3xl bg-blue-50 text-xs font-semibold text-accent"
        >
          <UserRound size={19} strokeWidth={2.5} />
          Pay
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/request")}
          className="flex h-14 flex-col items-center justify-center gap-1 rounded-3xl bg-slate-100 text-xs font-semibold text-slate-900"
        >
          <ArrowDownLeft size={19} strokeWidth={2.5} />
          Request
        </motion.button>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.3 } }}
        className="mt-12 flex-1"
      >
        <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
        {activity.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300 shadow-sm border border-slate-100/50">
              <Receipt size={32} strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">
              No activity yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Money you send and receive will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-1">
            {activity.slice(0, 12).map((a) => {
              const meta = typeMeta[a.type];
              return (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      haptic(10);
                      setReceiptItem(a);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl bg-white px-3 py-3 text-left hover:bg-slate-50"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${meta.tint}`}
                      aria-hidden
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {a.counterparty}
                      </span>
                      <span className="block truncate text-xs font-medium text-slate-400 mt-0.5">
                        {a.status === "awaiting-claim" && "Awaiting claim · "}
                        {a.note ? `${a.note} · ` : ""}
                        {settings.proMode && a.txId ? (
                          <span className="font-mono text-accent">
                            Tx: {a.txId.slice(0, 10)}…
                          </span>
                        ) : (
                          timeAgo(a.createdAt)
                        )}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        a.type === "received" || a.type === "reclaimed"
                          ? "text-emerald-600"
                          : "text-slate-900"
                      }`}
                    >
                      {meta.sign}
                      {settings.hideBalance ? "••••" : formatCurrency(a.amountUsd, settings.currency, rates)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <SupportSheet
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
      />

      <ReceiptSheet
        open={!!receiptItem}
        onClose={() => setReceiptItem(null)}
        activity={receiptItem}
      />

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 h-32 bg-gradient-to-t from-white to-transparent" />
    </main>
    </PullToRefresh>
  );
}
