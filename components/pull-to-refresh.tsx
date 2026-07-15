"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { haptic } from "@/lib/motion";

const TRIGGER_PX = 64; // pull distance that commits to a refresh
const MAX_PULL_PX = 110; // visual ceiling — resists past this
const MIN_SPINNER_MS = 550; // avoids a one-frame flash on fast refreshes

/**
 * Native-feeling pull-to-refresh for a window-scrolled page (no overflow
 * container — this app scrolls the body). Only engages when the page is
 * already at the top; ordinary scrolling is untouched.
 *
 * Uses a real (non-passive) touchmove listener so it can preventDefault the
 * browser's own rubber-banding while dragging — React's JSX touch handlers
 * are passive by default and can't do this reliably.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pull = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false); // pulled past TRIGGER_PX

  // Keep the latest callback/flag in refs so the listener setup below runs
  // exactly once and never rebinds mid-drag because the parent re-rendered.
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(refreshing);
  useLayoutEffect(() => {
    onRefreshRef.current = onRefresh;
    refreshingRef.current = refreshing;
  });

  const indicatorOpacity = useTransform(pull, [0, 24], [0, 1]);
  const indicatorScale = useTransform(pull, [0, TRIGGER_PX], [0.5, 1]);
  const rotate = useTransform(pull, [0, TRIGGER_PX], [0, 180]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let tracking = false;
    let armedNow = false;

    function onTouchStart(e: TouchEvent) {
      if (refreshingRef.current || window.scrollY > 0) {
        tracking = false;
        return;
      }
      startY = e.touches[0].clientY;
      tracking = true;
      armedNow = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return;
      const delta = e.touches[0].clientY - startY;
      if (delta <= 0) {
        pull.set(0);
        return;
      }
      // Damped resistance — feels elastic, never scrolls the page under it.
      const resisted = Math.min(MAX_PULL_PX, Math.sqrt(delta) * 6);
      pull.set(resisted);
      if (e.cancelable) e.preventDefault();

      const nowArmed = resisted >= TRIGGER_PX;
      if (nowArmed && !armedNow) haptic(12); // tick the instant it commits
      armedNow = nowArmed;
      setArmed(nowArmed);
    }

    async function onTouchEnd() {
      if (!tracking) return;
      tracking = false;

      if (armedNow) {
        haptic(18);
        setRefreshing(true);
        animate(pull, 48, { type: "spring", stiffness: 300, damping: 30 });
        const started = Date.now();
        try {
          await onRefreshRef.current();
        } finally {
          const elapsed = Date.now() - started;
          if (elapsed < MIN_SPINNER_MS) {
            await new Promise((r) => setTimeout(r, MIN_SPINNER_MS - elapsed));
          }
          setRefreshing(false);
          setArmed(false);
          animate(pull, 0, { type: "spring", stiffness: 300, damping: 30 });
        }
      } else {
        animate(pull, 0, { type: "spring", stiffness: 400, damping: 32 });
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull]);

  return (
    <div ref={containerRef} className="relative">
      <motion.div
        style={{ opacity: indicatorOpacity, scale: indicatorScale }}
        className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center"
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-white shadow-ios">
          {refreshing ? (
            <span className="size-4 rounded-full border-2 border-slate-200 border-t-accent animate-spin" />
          ) : (
            <motion.svg
              style={{ rotate }}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={armed ? "text-accent" : "text-slate-400"}
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </motion.svg>
          )}
        </div>
      </motion.div>

      <motion.div style={{ y: pull }}>{children}</motion.div>
    </div>
  );
}
