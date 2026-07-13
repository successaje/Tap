"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function ScanPage() {
  const router = useRouter();

  return (
    <main className="relative flex flex-1 min-h-[100dvh] flex-col bg-slate-900">
      {/* Overlay mask */}
      <div className="absolute inset-0 flex flex-col z-10 pointer-events-none">
        <div className="flex flex-1 bg-black/60" />
        <div className="flex h-72">
          <div className="flex-1 bg-black/60" />
          <div className="w-72 relative">
             {/* Reticle corners */}
             <div className="absolute -left-0.5 -top-0.5 size-8 border-l-4 border-t-4 border-white rounded-tl-xl" />
             <div className="absolute -right-0.5 -top-0.5 size-8 border-r-4 border-t-4 border-white rounded-tr-xl" />
             <div className="absolute -left-0.5 -bottom-0.5 size-8 border-l-4 border-b-4 border-white rounded-bl-xl" />
             <div className="absolute -right-0.5 -bottom-0.5 size-8 border-r-4 border-b-4 border-white rounded-br-xl" />
             
             {/* Scanning laser animation (mock) */}
             <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-accent opacity-50 shadow-[0_0_8px_2px_rgba(10,10,10,0.5)] animate-pulse" />
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
        <div className="flex flex-1 bg-black/60" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 pt-5">
        <button
          onClick={() => router.push("/")}
          className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md"
        >
          <X size={22} strokeWidth={2} />
        </button>
        <p className="font-medium text-white tracking-wide">Scan Code</p>
        <span className="size-10" />
      </header>

      <div className="relative z-20 mt-auto px-6 pb-16 text-center text-white">
        <p className="text-sm font-medium opacity-80">Point your camera at a tap QR code.</p>
      </div>
    </main>
  );
}
