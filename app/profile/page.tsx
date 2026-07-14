"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { getUser, logout, type AppUser } from "@/lib/auth";
import { getSentLinks, reclaimFundedLink, type SentLinkRecord } from "@/lib/links";
import { recordActivity, timeAgo } from "@/lib/activity";
import { formatCurrency, getExchangeRates, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { getSettings, updateSettings, type Settings as UserSettings } from "@/lib/settings";
import { subscribeToPush, isSubscribed, triggerTestPush } from "@/lib/push";
import { ReceiveSheet } from "@/components/receive-sheet";
import { ChevronDown, Coins, Terminal, ArrowLeft, QrCode, ShieldCheck, Bell, BellRing } from "lucide-react";

const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [links, setLinks] = useState<SentLinkRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addrCopied, setAddrCopied] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [pushEnabled, setPushEnabled] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    setUser(getUser());
    setLinks(getSentLinks().filter((l) => !l.reclaimed && !l.claimed));
    setSettings(getSettings());
    getExchangeRates().then(setRates);
    isSubscribed().then(setPushEnabled);
    const handleSettings = () => setSettings(getSettings());
    window.addEventListener("tap:settings", handleSettings);
    return () => window.removeEventListener("tap:settings", handleSettings);
  }, []);
   

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
      setLinks(getSentLinks().filter((l) => !l.reclaimed && !l.claimed));
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

  if (!settings) return null;

  return (
    <main className="flex min-h-[100dvh] flex-col bg-slate-50 px-6 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            haptic(10);
            router.push("/");
          }}
          className="-ml-2 flex size-10 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-200"
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <p className="font-semibold tracking-tight text-slate-900">Profile</p>
        <span className="size-10" />
      </header>

      <motion.section
        variants={stagger}
        initial="hidden"
        animate="show"
        className="mt-8 flex flex-col items-center"
      >
        <motion.div variants={rise}>
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="size-24 rounded-full shadow-sm" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-24 items-center justify-center rounded-full bg-blue-100 text-3xl font-semibold text-accent shadow-sm">
              {(user?.name || user?.email || "?")[0]?.toUpperCase()}
            </span>
          )}
        </motion.div>
        <motion.h2 variants={rise} className="mt-5 text-2xl font-semibold text-slate-900">
          {user?.name || "You"}
        </motion.h2>
        <motion.p variants={rise} className="mt-1 text-sm font-medium text-slate-500">
          {user?.email}
        </motion.p>
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.2 } }}
        className="mt-8 space-y-6"
      >
        {/* Add money — always visible; this is how you fund the account */}
        {user?.address && (
          <button
            onClick={() => {
              haptic(10);
              setReceiveOpen(true);
            }}
            className="flex w-full items-center gap-4 rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-ios transition-transform active:scale-[0.98]"
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-accent">
              <QrCode size={20} strokeWidth={2} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-900">Add money · Receive</p>
              <p className="text-xs font-medium text-slate-400">
                Show your QR or share your link to get paid
              </p>
            </div>
            <ChevronDown size={18} className="-rotate-90 text-slate-300" />
          </button>
        )}

        {/* Preferences */}
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-ios">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                <Coins size={16} strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-slate-700">Display currency</span>
            </div>
            <div className="relative">
              <select
                className="appearance-none bg-transparent py-1 pl-3 pr-8 text-right font-semibold text-accent outline-none"
                value={settings.currency}
                onChange={(e) => {
                  const next = updateSettings({ currency: e.target.value });
                  setSettings(next);
                  window.dispatchEvent(new Event("tap:settings"));
                }}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-accent" />
            </div>
          </div>

          <div className="h-px w-full bg-slate-50" />

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                <Terminal size={16} strokeWidth={2} />
              </div>
              <div>
                <span className="block text-sm font-semibold text-slate-700">Pro mode</span>
                <span className="block text-xs font-medium text-slate-400">
                  Show chains, addresses & receipts
                </span>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.proMode}
                onChange={(e) => {
                  const next = updateSettings({ proMode: e.target.checked });
                  setSettings(next);
                  window.dispatchEvent(new Event("tap:settings"));
                }}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
          </div>

          <div className="h-px w-full bg-slate-50" />

          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                {pushEnabled ? <BellRing size={16} strokeWidth={2} /> : <Bell size={16} strokeWidth={2} />}
              </div>
              <div>
                <span className="block text-sm font-semibold text-slate-700">Push Notifications</span>
                <span className="block text-xs font-medium text-slate-400">
                  {pushEnabled ? "Enabled on this device" : "Tap to enable"}
                </span>
              </div>
            </div>
            
            {pushEnabled ? (
              <button
                onClick={async () => {
                  if (testingPush) return;
                  setTestingPush(true);
                  haptic(10);
                  await triggerTestPush("Test Notification", "Looks like push notifications are working perfectly! 🎉", "/profile");
                  setTestingPush(false);
                }}
                disabled={testingPush}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-transform active:scale-95 disabled:opacity-70"
              >
                {testingPush ? "Sending..." : "Test"}
              </button>
            ) : (
              <button
                onClick={async () => {
                  haptic(10);
                  const subbed = await subscribeToPush();
                  setPushEnabled(subbed);
                }}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 shadow-md shadow-accent/20"
              >
                Enable
              </button>
            )}
          </div>
        </div>

        {/* Outstanding links — reclaim is a money-safety feature: always visible */}
        <section>
          <h3 className="ml-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Outstanding links
          </h3>
          {links.length === 0 ? (
            <p className="mt-3 px-2 text-sm font-medium text-slate-500">
              No unclaimed links. Money you send by link can be pulled back here
              any time before it&apos;s claimed.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {links.map((l) => (
                <li key={l.id} className="rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-ios">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tabular-nums text-slate-900">
                        {formatCurrency(l.amountUsd, settings.currency, rates)}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-400">
                        {l.note ? `${l.note} · ` : ""}
                        {timeAgo(l.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => reclaim(l)}
                      disabled={busyId === l.id}
                      className="h-10 rounded-full bg-slate-50 px-5 text-sm font-semibold text-accent transition-transform active:scale-95 disabled:opacity-60"
                    >
                      {busyId === l.id ? "Reclaiming…" : "Reclaim"}
                    </button>
                  </div>
                  {errors[l.id] && (
                    <p className="mt-3 text-xs font-medium text-red-500">{errors[l.id]}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Security — honest, on-brand: no seed phrase, identity-based recovery */}
        <section>
          <h3 className="ml-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ShieldCheck size={14} /> Security
          </h3>
          <div className="mt-3 space-y-2 rounded-3xl border border-slate-100 bg-white px-5 py-5 text-sm font-medium text-slate-600 shadow-ios">
            <p>
              <span className="font-semibold text-slate-900">No seed phrase, ever.</span>{" "}
              Your account is secured by your Google sign-in through Magic — lose
              your phone, sign in anywhere, your money follows you.
            </p>
          </div>
        </section>

        {/* Pro mode: the technical truth, for the curious (and the judges) */}
        <AnimatePresence>
          {settings.proMode && user?.address && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <h3 className="ml-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Terminal size={14} /> Universal Account
              </h3>
              <div className="mt-3 rounded-3xl border border-slate-100 bg-white p-2 shadow-ios">
                <button
                  onClick={async () => {
                    haptic(10);
                    await navigator.clipboard?.writeText(user.address!).catch(() => {});
                    setAddrCopied(true);
                    setTimeout(() => setAddrCopied(false), 1600);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 transition-transform active:scale-[0.98]"
                >
                  <span className="text-sm font-medium text-slate-600">EOA address</span>
                  <span className="font-mono text-sm font-semibold text-accent">
                    {addrCopied ? "Copied ✓" : shorten(user.address)}
                  </span>
                </button>
                <p className="px-4 py-3 text-xs font-medium leading-relaxed text-slate-400">
                  This address is your Universal Account — upgraded in place with
                  EIP-7702. One balance across every chain, settled on Arbitrum.
                </p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <button
          onClick={signOut}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full border border-red-100 bg-red-50 text-base font-semibold text-red-500 shadow-ios transition-transform active:scale-95"
        >
          Sign out
        </button>
      </motion.div>

      <ReceiveSheet open={receiveOpen} onClose={() => setReceiveOpen(false)} user={user} />
    </main>
  );
}
