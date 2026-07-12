"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RippleMark } from "@/components/logo";
import { completeLoginFromRedirect } from "@/lib/auth";
import { haptic } from "@/lib/motion";

/**
 * OAuth return route. Magic sends the browser here after Google; we finish the
 * handshake, persist the user, then bounce back to the flow which resumes at
 * the claim moment.
 */
export default function Callback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    completeLoginFromRedirect()
      .then(() => {
        if (cancelled) return;
        haptic();
        router.replace("/");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      {error ? (
        <>
          <p className="text-lg font-semibold">Sign-in didn&apos;t complete</p>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-6 h-12 rounded-full bg-accent px-6 font-semibold text-white"
          >
            Back to start
          </button>
        </>
      ) : (
        <>
          <RippleMark size={56} animate />
          <motion.p
            className="mt-6 text-slate-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Signing you in…
          </motion.p>
        </>
      )}
    </main>
  );
}
