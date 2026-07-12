"use client";

import { motion } from "framer-motion";

/**
 * The tap ripple mark — a filled dot inside two expanding rings.
 * `animate` makes the rings pulse outward (used on hero screens);
 * static by default for headers.
 */
export function RippleMark({
  size = 40,
  animate = false,
  className = "",
}: {
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  const ring = (delay: number) =>
    animate
      ? {
          animate: { scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] },
          transition: {
            duration: 2.4,
            repeat: Infinity,
            ease: "easeOut" as const,
            delay,
          },
        }
      : {};

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      aria-hidden
    >
      <motion.circle
        cx="40"
        cy="40"
        r="30"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.5"
        opacity="0.35"
        style={{ transformOrigin: "center" }}
        {...ring(0.4)}
      />
      <motion.circle
        cx="40"
        cy="40"
        r="20"
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
        opacity="0.6"
        style={{ transformOrigin: "center" }}
        {...ring(0)}
      />
      <circle cx="40" cy="40" r="11" fill="#2563eb" />
    </svg>
  );
}

/** Ripple mark + "tap" wordmark. Tight-cropped copy of the brand SVG. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/tap-wordmark.svg"
      alt="tap"
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}
