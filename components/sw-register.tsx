"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // PWAs resumed from the home screen can sit on a stale worker for up
        // to a day — force an update check on launch and on every foreground.
        reg.update().catch(() => {});
        const onVisible = () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
      })
      .catch(() => {
        // Offline shell is progressive enhancement; the app works without it.
      });

    // When a new worker takes over (skipWaiting + clients.claim), reload once
    // so the page runs the fresh build instead of a stale-HTML/new-chunk mix
    // (the classic blank-white-screen after a deploy).
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }, []);
  return null;
}
