"use client";

import { getUser } from "@/lib/auth";

// VAPID public key conversion utility
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushResult {
  ok: boolean;
  /** Machine-readable reason, so the UI can show something more useful than "it failed." */
  reason?: "unsupported" | "denied" | "no-vapid-key" | "not-subscribed" | "server-error" | "error";
  detail?: string;
}

/**
 * Request notification permissions and subscribe to the push manager.
 */
export async function subscribeToPush(): Promise<PushResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied" };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        return { ok: false, reason: "no-vapid-key" };
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
    }

    // Save the subscription to the backend
    const saved = await saveSubscriptionOnServer(subscription);
    if (!saved.ok) return saved;
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Persists the subscription server-side, keyed by the signed-in user's EOA —
 * this is what lets the background watcher (app/api/cron/check-claims) push
 * to this device even when no tab is open. Without an owner address (signed
 * out, or mock/no-Particle mode) it still "succeeds" locally; the push just
 * stays client-triggered only, same as before this existed.
 */
async function saveSubscriptionOnServer(subscription: PushSubscription): Promise<PushResult> {
  try {
    const ownerAddress = getUser()?.address;
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription, ownerAddress }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: "server-error", detail: body.error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "server-error", detail: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Triggers a test push notification by asking the server to push a payload
 * back down to the current subscription.
 */
export async function triggerTestPush(title: string, body: string, url?: string): Promise<PushResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "unsupported" };
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { ok: false, reason: "not-subscribed" };

  try {
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "notify",
        subscription,
        payload: { title, body, url },
      }),
    });
    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}));
      return { ok: false, reason: "server-error", detail: responseBody.error };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "server-error", detail: err instanceof Error ? err.message : String(err) };
  }
}
