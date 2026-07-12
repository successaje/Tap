"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const SEEN_KEY = "tap:splashed";

/**
 * App-boot splash: the tap mark breathing on white, then the whole thing
 * releases with a scale-up fade — like a native app launch. Shown once per
 * session (so in-app navigation and the OAuth bounce don't re-splash).
 */
export function Splash() {
  const [show, setShow] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (sessionStorage.getItem(SEEN_KEY)) {
      // Post-hydration sessionStorage read; SSR must render the splash. Intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(false);
      return;
    }
    sessionStorage.setItem(SEEN_KEY, "1");
    const t = setTimeout(() => setShow(false), reduce ? 500 : 1700);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white"
          exit={{
            opacity: 0,
            scale: reduce ? 1 : 1.08,
            transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
          }}
        >
          {/* Breathing mark: dot pulses, rings swell outward like a heartbeat */}
          <motion.svg
            width="96"
            height="96"
            viewBox="0 0 96 96"
            animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            {[
              { r: 38, w: 2.5, o: 0.3, d: 0.5 },
              { r: 26, w: 3, o: 0.55, d: 0.25 },
            ].map(({ r, w, o, d }) => (
              <motion.circle
                key={r}
                cx="48"
                cy="48"
                r={r}
                fill="none"
                stroke="#2563eb"
                strokeWidth={w}
                initial={{ opacity: o, scale: 1 }}
                animate={
                  reduce
                    ? undefined
                    : { opacity: [o, 0, o], scale: [1, 1.28, 1] }
                }
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: d,
                }}
                style={{ transformOrigin: "center" }}
              />
            ))}
            <circle cx="48" cy="48" r="14" fill="#2563eb" />
          </motion.svg>

          <motion.img
            src="/brand/tap-wordmark.svg"
            alt="tap"
            className="mt-5 h-9 select-none"
            draggable={false}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
