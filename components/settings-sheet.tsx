"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { springs, haptic } from "@/lib/motion";
import { getUser, logout, type AppUser } from "@/lib/auth";
import { getSentLinks, reclaimFundedLink, type SentLinkRecord } from "@/lib/links";
import { recordActivity } from "@/lib/activity";
import { timeAgo } from "@/lib/activity";
import { formatUsd } from "@/lib/mock";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Account, security, and reclaim controls — the trust surface. */
export function SettingsSheet({
  open,
  onClose,
  onActivityChanged,
}: {
  open: boolean;
  onClose: () => void;
  onActivityChanged?: () => void;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [links, setLinks] = useState<SentLinkRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addrCopied, setAddrCopied] = useState(false);

   
  useEffect(() => {
    if (!open) return;
    setUser(getUser());
    setLinks(getSentLinks().filter((l) => !l.reclaimed));
  }, [open]);
   

  async function reclaim(link: SentLinkRecord) {
    haptic(15);
    setBusyId(link.id);
    setErrors((e) => ({ ...e, [link.id]: "" }));
    try {
      const receipt = await reclaimFundedLink(link.id);
      recordActivity({
        type: "reclaimed",
        amountUsd: receipt.sentUsd,
        counterparty: `Link ${link.id.slice(0, 6)}`,
        status: "reclaimed",
        explorerUrl: receipt.explorerUrl,
        txId: receipt.transactionId,
      });
      setLinks(getSentLinks().filter((l) => !l.reclaimed));
      onActivityChanged?.();
      haptic([0, 25, 30, 40]);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [link.id]:
          err instanceof Error && /empty/i.test(err.message)
            ? "Already claimed — nothing to reclaim."
            : err instanceof Error
              ? err.message
              : String(err),
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function signOut() {
    haptic(15);
    await logout();
    window.location.href = "/";
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="backdrop"
            aria-label="Close settings"
            className="absolute inset-0 z-40 bg-slate-900/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="absolute inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto rounded-t-3xl bg-white px-6 pb-10 pt-3"
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: springs.soft }}
            exit={{ y: "100%", transition: { duration: 0.25, ease: "easeIn" } }}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />

            {/* Account */}
            <section className="mt-5 flex items-center gap-3">
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="size-12 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-accent">
                  {(user?.name || user?.email || "?")[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{user?.name || "You"}</p>
                <p className="truncate text-sm text-slate-500">{user?.email}</p>
              </div>
            </section>

            {user?.address && (
              <button
                onClick={async () => {
                  haptic(10);
                  await navigator.clipboard?.writeText(user.address!).catch(() => {});
                  setAddrCopied(true);
                  setTimeout(() => setAddrCopied(false), 1600);
                }}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm text-slate-500">Deposit address</span>
                <span className="font-mono text-sm text-slate-700">
                  {addrCopied ? "Copied ✓" : shorten(user.address)}
                </span>
              </button>
            )}

            {/* Outstanding links */}
            <section className="mt-6">
              <h3 className="text-sm font-semibold text-slate-500">
                Outstanding links
              </h3>
              {links.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No unclaimed links. Money you send by link can be pulled back
                  here any time before it&apos;s claimed.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {links.map((l) => (
                    <li key={l.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatUsd(l.amountUsd)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {l.note ? `${l.note} · ` : ""}
                            {timeAgo(l.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => reclaim(l)}
                          disabled={busyId === l.id}
                          className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-accent shadow-sm disabled:opacity-60"
                        >
                          {busyId === l.id ? "Reclaiming…" : "Reclaim"}
                        </button>
                      </div>
                      {errors[l.id] && (
                        <p className="mt-2 text-xs text-red-500">{errors[l.id]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Security */}
            <section className="mt-6">
              <h3 className="text-sm font-semibold text-slate-500">Security</h3>
              <div className="mt-2 space-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">
                    No seed phrase, ever.
                  </span>{" "}
                  Your account is secured by your Google sign-in through Magic.
                </p>
                <p>
                  Lost your phone? Sign in with Google on any device — your
                  money follows your identity, not your hardware.
                </p>
                <p>
                  Links you send are locked to the first person who claims
                  them, and you can reclaim anything unclaimed above.
                </p>
              </div>
            </section>

            <button
              onClick={signOut}
              className="mt-6 h-12 w-full rounded-full bg-slate-100 text-base font-semibold text-slate-600"
            >
              Sign out
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
