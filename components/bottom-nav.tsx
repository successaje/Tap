"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, QrCode, Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { haptic } from "@/lib/motion";
import { getUser } from "@/lib/auth";
import { isOnboarded } from "@/lib/store";

// Only the top-level tabs show the floating pill — deep flows (send, claim,
// pay, onboarding) and the signed-out landing stay chromeless.
const ROOT_PATHS = new Set(["/", "/rewards", "/profile"]);

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Only for signed-in, onboarded users — the landing at "/" and the
  // first-run Onboarding (rendered inline at "/", not a separate route)
  // must both stay chromeless. null until mounted so SSR/first paint
  // renders nothing (no flash, no hydration mismatch).
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const sync = () => {
      setSignedIn(!!getUser());
      setOnboarded(isOnboarded());
    };
    sync();
    window.addEventListener("tap:auth", sync);
    return () => window.removeEventListener("tap:auth", sync);
  }, [pathname]);

  if (!signedIn || !onboarded || !ROOT_PATHS.has(pathname)) return null;

  const navs = [
    { name: "Home", icon: Home, path: "/" },
    { name: "Scan", icon: QrCode, path: "/scan", isPrimary: true },
    { name: "Withdraw", icon: Landmark, path: "/withdraw" },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[85%] max-w-sm rounded-full bg-white/80 backdrop-blur-xl shadow-ios-heavy border border-white/50 px-8 py-3 flex items-center justify-between">
      {navs.map((n) => {
        const isActive = pathname === n.path;
        if (n.isPrimary) {
          return (
            <button
              key={n.name}
              onClick={() => {
                haptic(10);
                router.push(n.path);
              }}
              className="flex flex-col items-center justify-center"
            >
              <div className="flex size-14 items-center justify-center rounded-full btn-tap text-white shadow-xl shadow-accent/30 -mt-6 active:scale-95 transition-transform">
                <n.icon size={24} strokeWidth={2} />
              </div>
              <span className="mt-1 text-[10px] font-bold tracking-wide text-slate-800">{n.name}</span>
            </button>
          );
        }
        return (
          <button
            key={n.name}
            onClick={() => {
              haptic(10);
              router.push(n.path);
            }}
            className={`flex flex-col items-center gap-1.5 transition-colors ${isActive ? "text-accent" : "text-slate-400 hover:text-slate-600"}`}
          >
            <n.icon size={24} strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-[10px] font-bold tracking-wide">{n.name}</span>
          </button>
        );
      })}
    </div>
  );
}
