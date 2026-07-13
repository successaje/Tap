"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ImageOff, Keyboard } from "lucide-react";
import { haptic } from "@/lib/motion";

// Minimal typing for the BarcodeDetector API (not yet in lib.dom).
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

type Status = "starting" | "scanning" | "denied" | "unsupported";

/**
 * Turn any scanned/pasted value into an in-app route if it's a tap link.
 * Routes by path so a prod QR (full https URL) works in dev, and tolerates
 * bare inputs like "tap.cash/pay?…" or "localhost:3000/t/…" (whose colon would
 * otherwise be misread as a URL scheme).
 */
function toTapRoute(raw: string): string | null {
  const s = raw.trim();
  try {
    const url = s.startsWith("http")
      ? new URL(s)
      : s.startsWith("/")
        ? new URL(s, window.location.origin)
        : new URL(`https://${s}`);
    if (/^\/(pay|t)\b/.test(url.pathname)) {
      return url.pathname + url.search + url.hash;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState(false);

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }

    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const detector = new Ctor({ formats: ["qr_code"] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");
        tick();
      } catch {
        setStatus("denied");
      }
    }

    async function tick() {
      if (done || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        const hit = codes.map((c) => toTapRoute(c.rawValue)).find(Boolean);
        if (hit) {
          done = true;
          haptic([0, 30, 40, 60]);
          router.push(hit);
          return;
        }
      } catch {
        /* transient decode error — keep scanning */
      }
      raf = requestAnimationFrame(tick);
    }

    start();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  function submitManual() {
    const route = toTapRoute(manual.trim());
    if (route) {
      haptic(15);
      router.push(route);
    } else {
      setManualError(true);
      haptic(30);
    }
  }

  const camActive = status === "scanning";

  return (
    <main className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden bg-slate-900">
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          camActive ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Dimmed mask with a clear reticle window */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="flex-1 bg-black/60" />
        <div className="flex h-72">
          <div className="flex-1 bg-black/60" />
          <div className="relative w-72">
            <div className="absolute -left-0.5 -top-0.5 size-8 rounded-tl-xl border-l-4 border-t-4 border-white" />
            <div className="absolute -right-0.5 -top-0.5 size-8 rounded-tr-xl border-r-4 border-t-4 border-white" />
            <div className="absolute -bottom-0.5 -left-0.5 size-8 rounded-bl-xl border-b-4 border-l-4 border-white" />
            <div className="absolute -bottom-0.5 -right-0.5 size-8 rounded-br-xl border-b-4 border-r-4 border-white" />
            {camActive && (
              <div className="absolute inset-x-4 top-1/2 h-0.5 animate-pulse bg-accent opacity-70 shadow-[0_0_8px_2px_rgba(15,82,255,0.6)]" />
            )}
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
        <div className="flex-1 bg-black/60" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 pt-5">
        <button
          onClick={() => router.push("/")}
          className="flex size-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md"
        >
          <X size={22} strokeWidth={2} />
        </button>
        <p className="font-medium tracking-wide text-white">Scan to pay</p>
        <span className="size-10" />
      </header>

      <div className="relative z-20 mt-auto px-6 pb-16 text-center text-white">
        {status === "scanning" && (
          <p className="text-sm font-medium opacity-80">
            Point your camera at a tap QR code.
          </p>
        )}
        {status === "starting" && (
          <p className="text-sm font-medium opacity-80">Starting camera…</p>
        )}

        {/* Graceful fallback: no camera / denied / unsupported → paste a link */}
        {(status === "denied" || status === "unsupported") && (
          <div className="mx-auto max-w-sm rounded-3xl bg-white/10 p-5 backdrop-blur-md">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-white/15">
              <ImageOff size={20} strokeWidth={2} />
            </div>
            <p className="mt-3 text-sm font-semibold">
              {status === "denied"
                ? "Camera access is off"
                : "Scanning isn't available here"}
            </p>
            <p className="mt-1 text-xs opacity-70">
              Paste a tap link instead and we&apos;ll open it.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-white/15 py-1 pl-4 pr-1">
              <Keyboard size={16} className="shrink-0 opacity-70" />
              <input
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  setManualError(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && submitManual()}
                placeholder="tap link…"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/50"
              />
              <button
                onClick={submitManual}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900"
              >
                Open
              </button>
            </div>
            {manualError && (
              <p className="mt-2 text-xs text-red-300">
                That doesn&apos;t look like a tap link.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
