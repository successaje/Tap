"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/logo";
import { SettingsSheet } from "@/components/settings-sheet";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, type AppUser } from "@/lib/auth";
import { getBalance } from "@/lib/store";
import { getUnifiedBalance, type UnifiedBalance } from "@/lib/particle";
import { getActivity, timeAgo, type ActivityItem } from "@/lib/activity";
import { formatUsd } from "@/lib/mock";

const typeMeta: Record<
  ActivityItem["type"],
  { icon: string; tint: string; sign: string }
> = {
  received: { icon: "↓", tint: "bg-green-50 text-green-600", sign: "+" },
  sent: { icon: "↑", tint: "bg-blue-50 text-accent", sign: "−" },
  reclaimed: { icon: "↩", tint: "bg-slate-100 text-slate-500", sign: "+" },
};

/** Home: one balance, primary actions, recent activity. */
export function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [mockBalance, setMockBalance] = useState(0);
  const [unified, setUnified] = useState<UnifiedBalance | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Post-hydration storage reads (SSR can't see them).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const u = getUser();
    setUser(u);
    setMockBalance(getBalance());
    setActivity(getActivity());
    if (!u?.address) return;
    let cancelled = false;
    getUnifiedBalance(u.address).then((b) => {
      if (!cancelled && b) setUnified(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const balance = unified ? unified.totalUsd : mockBalance;
  const myLink = user?.address
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay?to=${
        user.address
      }&from=${encodeURIComponent(user.name || "Me")}`
    : null;

  async function copyMyLink() {
    if (!myLink) return;
    haptic(10);
    await navigator.clipboard?.writeText(myLink).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <Logo className="h-8" />
        <button
          onClick={() => {
            haptic(10);
            setSettingsOpen(true);
          }}
          className="flex size-10 items-center justify-center rounded-full bg-slate-100"
          aria-label="Account & settings"
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="size-10 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="font-semibold text-slate-600">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </span>
          )}
        </button>
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-10 text-center"
      >
        <motion.p variants={rise} className="text-sm text-slate-500">
          Your balance
        </motion.p>
        <motion.p
          variants={rise}
          className="mt-1 text-6xl font-semibold leading-none tracking-tighter tabular-nums"
        >
          {formatUsd(balance)}
        </motion.p>
        {unified && unified.chainCount > 0 && (
          <motion.p
            variants={rise}
            className="mx-auto mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-accent"
          >
            One balance &middot; {unified.chainCount} chain
            {unified.chainCount === 1 ? "" : "s"} underneath
          </motion.p>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.2 } }}
        className="mt-8 grid grid-cols-2 gap-3"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/send")}
          className="h-13 rounded-full bg-accent py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/20"
        >
          Send
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push("/request")}
          className="h-13 rounded-full bg-slate-100 py-3.5 text-base font-semibold text-slate-800"
        >
          Request
        </motion.button>
      </motion.div>

      {myLink && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.3 } }}
          onClick={copyMyLink}
          className="mt-3 flex items-center justify-center gap-2 rounded-full py-2 text-sm text-slate-500"
        >
          <span className="truncate font-mono text-xs">
            {myLink.replace(/^https?:\/\//, "").slice(0, 34)}…
          </span>
          <span className="shrink-0 font-semibold text-accent">
            {linkCopied ? "Copied ✓" : "Copy your link"}
          </span>
        </motion.button>
      )}

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.3 } }}
        className="mt-8 flex-1"
      >
        <h2 className="text-sm font-semibold text-slate-500">Activity</h2>
        {activity.length === 0 ? (
          <p className="mt-6 text-center text-sm text-slate-400">
            Money you send and receive shows up here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {activity.slice(0, 12).map((a) => {
              const meta = typeMeta[a.type];
              const Row = a.explorerUrl ? "a" : "div";
              return (
                <li key={a.id}>
                  <Row
                    {...(a.explorerUrl
                      ? { href: a.explorerUrl, target: "_blank", rel: "noreferrer" }
                      : {})}
                    className="flex items-center gap-3 py-3"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-lg ${meta.tint}`}
                      aria-hidden
                    >
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {a.counterparty}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {a.status === "awaiting-claim" && "Awaiting claim · "}
                        {a.note ? `${a.note} · ` : ""}
                        {timeAgo(a.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        a.type === "received" ? "text-green-600" : "text-slate-800"
                      }`}
                    >
                      {meta.sign}
                      {formatUsd(a.amountUsd)}
                    </span>
                  </Row>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onActivityChanged={() => setActivity(getActivity())}
      />
    </main>
  );
}
