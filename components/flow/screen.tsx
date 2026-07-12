"use client";

import { motion } from "framer-motion";
import { screenVariants } from "@/lib/motion";

/** Consistent full-height screen with spring enter/exit for AnimatePresence. */
export function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.main
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className={`absolute inset-0 flex flex-col ${className}`}
    >
      {children}
    </motion.main>
  );
}
