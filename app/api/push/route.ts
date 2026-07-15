import { NextResponse } from "next/server";
import webpush from "web-push";
import { addSubscription, kvConfigured } from "@/lib/server/kv";

// Configuration for web-push. VAPID private keys are 32-byte values,
// base64url-encoded to 43 characters — validate the shape before handing it
// to web-push, whose setVapidDetails() throws synchronously on a bad key.
// Doing that unguarded at module scope previously took the ENTIRE production
// build down (Next collects page data for all routes, including this one)
// whenever the env var was unset or a placeholder — not just push.
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidConfigured =
  publicVapidKey.length === 87 && privateVapidKey.length === 43;

if (vapidConfigured) {
  webpush.setVapidDetails(
    "mailto:hello@tap.cash",
    publicVapidKey,
    privateVapidKey
  );
} else if (publicVapidKey || privateVapidKey) {
  console.warn(
    "[tap] VAPID keys are set but malformed — push notifications disabled. Generate real ones with `npx web-push generate-vapid-keys`."
  );
}

export async function POST(req: Request) {
  if (!vapidConfigured) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { action, subscription, payload, ownerAddress } = body;

    if (action === "subscribe") {
      // Persisted so the background watcher (app/api/cron/check-claims) can
      // reach this device even when no tab is open. Without a KV store
      // configured, subscribing still "succeeds" — push just stays
      // client-triggered only, same as before this feature existed.
      if (kvConfigured && ownerAddress && subscription) {
        await addSubscription(ownerAddress, subscription);
      }
      return NextResponse.json({ success: true, persisted: kvConfigured });
    }

    if (action === "notify") {
      // Triggers a push back to the exact subscription that requested it —
      // the immediate, client-side path (fires only while a tab is open).
      if (!subscription) {
        return NextResponse.json(
          { error: "No subscription provided" },
          { status: 400 }
        );
      }

      const pushPayload = JSON.stringify({
        title: payload?.title || "tap",
        body: payload?.body || "New notification from tap",
        url: payload?.url || "/",
      });

      await webpush.sendNotification(subscription, pushPayload);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Push API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
