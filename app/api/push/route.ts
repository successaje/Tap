import { NextResponse } from "next/server";
import webpush from "web-push";
import { addSubscription, checkRateLimit, kvConfigured } from "@/lib/server/kv";
import { isAddress } from "@/lib/server/validate";

function isPushSubscriptionShape(v: unknown): v is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://")) return false;
  const keys = s.keys as Record<string, unknown> | undefined;
  return !!keys && typeof keys.p256dh === "string" && typeof keys.auth === "string";
}

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
      let persisted = false;
      if (kvConfigured && isAddress(ownerAddress) && isPushSubscriptionShape(subscription)) {
        if (await checkRateLimit("subscribe", ownerAddress, 20, 300)) {
          persisted = await addSubscription(ownerAddress, subscription);
        }
      }
      return NextResponse.json({ success: true, persisted });
    }

    if (action === "notify") {
      // Triggers a push back to the exact subscription that requested it —
      // the immediate, client-side path (fires only while a tab is open).
      if (!isPushSubscriptionShape(subscription)) {
        return NextResponse.json(
          { error: "No subscription provided" },
          { status: 400 }
        );
      }
      // Rate-limited per endpoint (not owner — this path doesn't require one)
      // so the test-push button can't be scripted into hammering the push
      // service's send quota.
      if (!(await checkRateLimit("notify", subscription.endpoint, 10, 300))) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }

      const pushPayload = JSON.stringify({
        title: String(payload?.title || "tap").slice(0, 100),
        body: String(payload?.body || "New notification from tap").slice(0, 300),
        url: payload?.url || "/",
      });

      try {
        await webpush.sendNotification(subscription, pushPayload);
      } catch (err) {
        // A stale subscription (browser unsubscribed, permission revoked, app
        // reinstalled) surfaces here as a 404/410 from the push service —
        // report it plainly instead of a generic 500 so the client can tell
        // the difference between "broken" and "just resubscribe."
        const webpushErr = err as { statusCode?: number; body?: string; message?: string };
        const statusCode = webpushErr?.statusCode;
        console.error("[tap] webpush.sendNotification failed", {
          statusCode,
          body: webpushErr?.body,
          message: webpushErr?.message,
        });
        const message =
          statusCode === 404 || statusCode === 410
            ? "Subscription expired — re-enable push notifications."
            : `Push send failed (${statusCode ?? "unknown"}): ${webpushErr?.body || webpushErr?.message || "no detail"}`;
        return NextResponse.json({ error: message }, { status: statusCode === 404 || statusCode === 410 ? 410 : 502 });
      }
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
