"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/**
 * Animated currency counter. Eases from `from` to `to` on mount —
 * the "money landing" moment. Uses a spring-ish ease-out so it
 * overshoots slightly and settles rather than stopping dead.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.1,
  className = "",
}: {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
}) {
  const value = useMotionValue(from);
  const text = useTransform(value, (v) =>
    v.toLocaleString("en-US", { style: "currency", currency: "USD" })
  );

  useEffect(() => {
    const controls = animate(value, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [to, duration, value]);

  return (
    <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>
  );
}
