"use client";

import { useEffect, useState } from "react";
import { Flow } from "@/components/flow/flow";
import { Home } from "@/components/home";
import { Landing } from "@/components/landing";
import { Onboarding } from "@/components/onboarding";
import { Splash } from "@/components/splash";
import { getUser, hasPendingResume } from "@/lib/auth";
import { isOnboarded, markOnboarded, type MockUser } from "@/lib/store";
import { demoLink } from "@/lib/mock";

type View = "loading" | "landing" | "demo" | "onboarding" | "home";

/**
 * Root routing:
 * - not signed in → Landing (a real welcome + sign-in, NOT the mock claim)
 * - "see how it works" → the demo claim flow, an explicit opt-in
 * - signed in, first run → Onboarding welcome
 * - signed in, returning → Home
 *
 * Real claim links live at /t/[id], so the demo never masquerades as a real
 * payment on the front door.
 */
export default function Root() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<MockUser | null>(null);

  useEffect(() => {
    // Post-hydration storage reads (SSR can't see them).
    /* eslint-disable react-hooks/set-state-in-effect */
    const u = getUser();
    setUser(u);
    if (!u || hasPendingResume()) {
      setView(u ? "home" : "landing");
    } else if (!isOnboarded()) {
      setView("onboarding");
    } else {
      setView("home");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="relative flex flex-1 flex-col">
      {view === "landing" && (
        <Landing
          onDemo={() => setView("demo")}
          onSignedIn={() => {
            setUser(getUser());
            window.dispatchEvent(new Event("tap:auth"));
            setView(isOnboarded() ? "home" : "onboarding");
          }}
        />
      )}
      {view === "demo" && <Flow initialLink={demoLink} />}
      {view === "home" && <Home />}
      {view === "onboarding" && (
        <Onboarding
          user={user}
          onDone={() => {
            markOnboarded();
            window.dispatchEvent(new Event("tap:auth"));
            setView("home");
          }}
        />
      )}
      <Splash />
    </div>
  );
}
