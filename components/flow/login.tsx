"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Screen } from "@/components/flow/screen";
import { RippleMark } from "@/components/logo";
import { springs, stagger, rise, haptic } from "@/lib/motion";
import { signIn, type MockUser } from "@/lib/store";
import { authEnabled, beginGoogleLogin } from "@/lib/auth";
import { formatUsd, type PaymentLink } from "@/lib/mock";

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
);

/** (b) Login — Google sign-in. The link binds to this identity on success. */
export function LoginScreen({
  link,
  onSignedIn,
}: {
  link: PaymentLink;
  onSignedIn: (user: MockUser) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    if (loading) return;
    haptic();
    setLoading(true);
    if (authEnabled) {
      // Real Magic: redirects to Google and returns via /callback. The flow
      // resumes at the claim moment on the way back, so this never returns.
      try {
        await beginGoogleLogin("moment");
      } catch (err) {
        console.error("[tap] Google login failed:", err);
        setLoading(false);
      }
      return;
    }
    const user = await signIn();
    onSignedIn(user);
  }

  return (
    <Screen className="px-6 pb-8 pt-6">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-1 flex-col items-center justify-center text-center"
      >
        <motion.div variants={rise}>
          <RippleMark size={64} animate />
        </motion.div>

        <motion.p variants={rise} className="mt-7 text-lg text-slate-500">
          Sign in to claim
        </motion.p>
        <motion.p
          layoutId="amount"
          className="mt-1 text-5xl font-semibold leading-none tracking-tighter tabular-nums text-slate-900"
        >
          {formatUsd(link.amountUsd)}
        </motion.p>

        <motion.p
          variants={rise}
          className="mt-5 max-w-[17rem] text-sm leading-relaxed text-slate-400"
        >
          One sign-in locks this link to you — no one else can claim it. No
          wallet, no seed phrase, nothing to install.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { ...springs.snappy, delay: 0.3 },
        }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          transition={springs.snappy}
          onClick={handle}
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
        <p className="text-xs text-slate-400">
          🔒 Secured &middot; we never see your password
        </p>
      </motion.div>
    </Screen>
  );
}
