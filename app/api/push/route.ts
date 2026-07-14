import { NextResponse } from "next/server";
import webpush from "web-push";

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
    const { action, subscription, payload } = body;

    if (action === "subscribe") {
      // In a real app, you would save the subscription object to your database
      // linked to the currently authenticated user.
      // For this MVP, we just accept it.
      return NextResponse.json({ success: true });
    }

    if (action === "notify") {
      // This triggers a push message back to the exact subscription that requested it.
      // Useful for testing or immediate feedback.
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
