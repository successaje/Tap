import { NextResponse } from "next/server";
import webpush from "web-push";

// Configuration for web-push
const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    "mailto:hello@tap.cash", // Your contact email
    publicVapidKey,
    privateVapidKey
  );
}

export async function POST(req: Request) {
  if (!publicVapidKey || !privateVapidKey) {
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
