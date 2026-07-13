"use client";

import { useEffect, useState } from "react";
import { Flow } from "@/components/flow/flow";
import { Home } from "@/components/home";
import { Splash } from "@/components/splash";
import { getUser, hasPendingResume } from "@/lib/auth";
import { demoLink } from "@/lib/mock";

/**
 * Root: signed-in users land on Home; visitors get the demo claim flow
 * (which doubles as the pitch). A pending OAuth resume always goes to the
 * flow so the claim moment continues where it left off.
 */
export default function Root() {
  const [view, setView] = useState<"loading" | "home" | "flow">("loading");

  useEffect(() => {
    // Post-hydration storage read (SSR can't see it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(!hasPendingResume() && getUser() ? "home" : "flow");
  }, []);

  return (
    <div className="relative flex flex-1 flex-col">
      {view === "home" && <Home />}
      {view === "flow" && <Flow initialLink={demoLink} />}
      <Splash />
    </div>
  );
}
