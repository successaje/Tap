"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { springs } from "@/lib/motion";

/**
 * Branded QR for share/receive surfaces. The tap ripple mark sits in the
 * center (high error-correction keeps it scannable). Framed as a "scan to pay"
 * card so it reads like a payment sticker, not a crypto QR.
 */
export function PaymentQR({
  value,
  size = 208,
  caption,
}: {
  value: string;
  size?: number;
  caption?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1, transition: springs.bouncy }}
      className="flex flex-col items-center"
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          bgColor="#ffffff"
          fgColor="#0f172a"
          marginSize={0}
          imageSettings={{
            src: "/icons/icon.svg",
            height: size * 0.22,
            width: size * 0.22,
            excavate: true,
          }}
        />
      </div>
      {caption && (
        <p className="mt-3 text-sm text-slate-500">{caption}</p>
      )}
    </motion.div>
  );
}
