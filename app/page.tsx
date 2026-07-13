"use client";

import { useEffect, useState } from "react";
import { Flow } from "@/components/flow/flow";
import { Home } from "@/components/home";
import { Onboarding } from "@/components/onboarding";
import { Splash } from "@/components/splash";
import { getUser, hasPendingResume } from "@/lib/auth";
import { isOnboarded, markOnboarded, type MockUser } from "@/lib/store";
import { demoLink } from "@/lib/mock";

type View = "loading" | "home" | "flow" | "onboarding";

/**
 * Root: first-time signed-in users get the welcome moment, returning users
 * land on Home, visitors get the demo claim flow (which doubles as the pitch).
 * A pending OAuth resume always goes to the flow so the claim moment continues.
 */
export default function Root() {
  const [view, setView] = useState<View>("loading");
  const [user, setUser] = useState<MockUser | null>(null);

  useEffect(() => {
    // Post-hydration storage reads (SSR can't see them).
    /* eslint-disable react-hooks/set-state-in-effect */
    const u = getUser();
    setUser(u);
    if (hasPendingResume() || !u) {
      setView("flow");
    } else if (!isOnboarded()) {
      setView("onboarding");
    } else {
      setView("home");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return (
    <div className="relative flex flex-1 flex-col">
      {view === "home" && <Home />}
      {view === "flow" && <Flow initialLink={demoLink} />}
      {view === "onboarding" && (
        <Onboarding
          user={user}
          onDone={() => {
            markOnboarded();
            setView("home");
          }}
        />
      )}
      <Splash />
    </div>
  );
}
