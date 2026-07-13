"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { authEnabled, beginGoogleLogin } from "@/lib/auth";
import { signIn } from "@/lib/store";

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
  </svg>
);

const points = [
  "No wallet, no seed phrase — just Google",
  "One balance across every chain",
  "Send money as easily as a text",
];

/**
 * Signed-out entry. A real new visitor sees this — a proper welcome and
 * sign-in — not the mocked demo claim. The demo is reachable as an explicit
 * "see how it works" for the curious (and judges).
 */
export function Landing({
  onDemo,
  onSignedIn,
}: {
  onDemo: () => void;
  onSignedIn: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    if (loading) return;
    haptic();
    setLoading(true);
    if (authEnabled) {
      // Real Magic: redirects to Google and back to "/" (never returns here).
      try {
        await beginGoogleLogin();
      } catch {
        setLoading(false);
      }
      return;
    }
    // Mock fallback when keys aren't configured.
    await signIn();
    onSignedIn();
  }

  return (
    <main className="flex flex-1 flex-col px-6 pb-8 pt-10">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <motion.div variants={rise}>
          <RippleMark size={80} animate />
        </motion.div>

        <motion.h1
          variants={rise}
          className="mt-8 text-4xl font-semibold leading-tight tracking-tighter text-slate-900"
        >
          Money that moves
          <br />
          like a message
        </motion.h1>
        <motion.p
          variants={rise}
          className="mt-3 max-w-[18rem] text-base font-medium text-slate-500"
        >
          Send anyone money with a link. They tap, sign in, and it lands — no
          wallet, no chains, no idea it&apos;s crypto.
        </motion.p>

        <motion.ul variants={rise} className="mt-8 space-y-2.5 text-left">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-accent">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="text-sm font-medium text-slate-600">{p}</span>
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 0.35 } }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          onClick={handleGoogle}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-800 shadow-sm disabled:opacity-70"
        >
          {loading ? (
            <motion.span
              className="size-5 rounded-full border-2 border-slate-300 border-t-accent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
            />
          ) : (
            <>
              <GoogleG />
              Continue with Google
            </>
          )}
        </motion.button>

        <button
          onClick={() => {
            haptic(10);
            onDemo();
          }}
          className="text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          See how claiming works &rarr;
        </button>
      </motion.div>
    </main>
  );
}
