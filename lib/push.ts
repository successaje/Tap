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

/**
 * Request notification permissions and subscribe to the push manager.
 * Returns true if subscribed successfully, false otherwise.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.error("VAPID public key not found in environment.");
        return false;
      }
      
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });
    }

    // Save the subscription to the backend
    await saveSubscriptionOnServer(subscription);
    return true;
  } catch (err) {
    console.error("Failed to subscribe to push notifications", err);
    return false;
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
async function saveSubscriptionOnServer(subscription: PushSubscription) {
  try {
    const ownerAddress = getUser()?.address;
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription, ownerAddress }),
    });
  } catch (err) {
    console.error("Failed to save subscription on server", err);
  }
}

/**
 * Triggers a test push notification by asking the server to push a payload
 * back down to the current subscription.
 */
export async function triggerTestPush(title: string, body: string, url?: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "notify",
      subscription,
      payload: { title, body, url },
    }),
  });
}
