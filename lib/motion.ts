// Shared spring vocabulary — every transition in the app uses one of these.
export const springs = {
  /** Default UI transition: screens, cards, buttons. */
  snappy: { type: "spring", stiffness: 340, damping: 28 },
  /** Slightly playful: elements that should visibly settle (amounts, checkmarks). */
  bouncy: { type: "spring", stiffness: 300, damping: 18 },
  /** Slow and weighty: full-screen washes, sheets. */
  soft: { type: "spring", stiffness: 200, damping: 26 },
} as const;

export const screenVariants = {
  enter: { opacity: 0, y: 28, scale: 0.99 },
  center: { opacity: 1, y: 0, scale: 1, transition: springs.snappy },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.99,
    transition: { duration: 0.18, ease: "easeIn" },
  },
} as const;

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
} as const;

export const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: springs.snappy },
} as const;

/** Best-effort haptic tick (Android Chrome; silently ignored elsewhere). */
export function haptic(pattern: number | number[] = 18) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not available */
    }
  }
}
