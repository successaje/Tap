"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "@/components/count-up";
import { springs, haptic } from "@/lib/motion";
import { formatUsd, type PaymentLink } from "@/lib/mock";

type Phase = "ready" | "filling" | "landed";

/**
 * (c) The claim moment. Tap the target → an accent ripple expands from the
 * exact touch point to fill the screen → the amount counts up → a checkmark
 * settles. This is the emotional peak of the flow.
 */
export function ClaimMoment({
  link,
  onDone,
}: {
  link: PaymentLink;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const shellRef = useRef<HTMLDivElement>(null);

  // Diameter large enough that a ripple from any point covers the whole shell.
  const [diameter, setDiameter] = useState(1200);

  function handleTap(e: React.PointerEvent) {
    if (phase !== "ready") return;
    const rect = shellRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setOrigin({ x, y });
      // Farthest corner from the tap point, doubled for the radius→diameter.
      const far = Math.max(
        Math.hypot(x, y),
        Math.hypot(rect.width - x, y),
        Math.hypot(x, rect.height - y),
        Math.hypot(rect.width - x, rect.height - y)
      );
      setDiameter(far * 2.1);
    }
    haptic(18);
    setPhase("filling");
  }

  return (
    <motion.div
      ref={shellRef}
      className="absolute inset-0 overflow-hidden bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: springs.snappy }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* Ready state: the tap target */}
      <AnimatePresence>
        {phase === "ready" && (
          <motion.div
            key="target"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
          >
            <p className="mb-1 text-slate-500">It&apos;s yours to claim</p>
            <p className="mb-10 text-4xl font-semibold tracking-tight tabular-nums">
              {formatUsd(link.amountUsd)}
            </p>

            <motion.button
              onPointerDown={handleTap}
              whileTap={{ scale: 0.94 }}
              transition={springs.snappy}
              className="relative flex size-56 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white shadow-xl shadow-accent/30"
            >
              {/* Pulsing rings inviting the tap */}
              {[0, 0.6].map((delay) => (
                <motion.span
                  key={delay}
                  className="absolute inset-0 rounded-full border-2 border-accent"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeOut",
                    delay,
                  }}
                />
              ))}
              Tap to claim
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanding ripple from the tap point */}
      {phase !== "ready" && (
        <motion.div
          className="absolute rounded-full bg-accent"
          style={{
            left: origin.x,
            top: origin.y,
            x: "-50%",
            y: "-50%",
          }}
          initial={{ width: 0, height: 0 }}
          animate={{ width: diameter, height: diameter }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => {
            if (phase === "filling") {
              haptic([0, 30, 40, 60]);
              setPhase("landed");
            }
          }}
        />
      )}

      {/* Landed state: checkmark + count-up on the accent wash */}
      <AnimatePresence>
        {phase === "landed" && (
          <motion.div
            key="landed"
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.05 } }}
          >
            <motion.div
              className="flex size-20 items-center justify-center rounded-full bg-white/20"
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: { ...springs.bouncy, delay: 0.05 } }}
            >
              <motion.svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  initial={{ pathLength: 0 }}
                  animate={{
                    pathLength: 1,
                    transition: { duration: 0.4, delay: 0.15, ease: "easeOut" },
                  }}
                />
              </motion.svg>
            </motion.div>

            <motion.p
              className="mt-6 text-white/80"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
            >
              Landed
            </motion.p>
            <CountUp
              to={link.amountUsd}
              duration={1}
              className="mt-1 text-6xl font-semibold tracking-tight"
            />

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { ...springs.snappy, delay: 1.2 } }}
              whileTap={{ scale: 0.96 }}
              onClick={onDone}
              className="absolute bottom-8 left-6 right-6 h-14 rounded-full bg-white text-lg font-semibold text-accent"
            >
              Continue
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
