import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import webpush from "web-push";
import {
  getWatchedLinks,
  getSubscriptions,
  removeSubscription,
  unregisterWatchedLink,
} from "@/lib/server/kv";
import { getServerBalanceUsd } from "@/lib/server/particle-watch";

// The one background job in the app: fires on a schedule from Upstash
// QStash (set up once in the Upstash console — see FUTURE.md / README) and
// checks every outstanding link's on-chain balance. An emptied link means
// someone claimed it; this is what lets "your link was claimed" arrive as a
// push notification even when the sender's tab is closed, which the
// client-only polling in lib/links.ts can never do on its own.
//
// Verifying the QStash signature matters here specifically because, unlike
// every other route in this app, this one moves no money and returns no
// user data — but it DOES spend push-send quota and could be used to spam
// notifications if left open to arbitrary callers.

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const receiver =
  currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;

const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidConfigured =
  publicVapidKey.length === 87 && privateVapidKey.length === 43;
if (vapidConfigured) {
  webpush.setVapidDetails("mailto:hello@tap.cash", publicVapidKey, privateVapidKey);
}

const EMPTY_THRESHOLD_USD = 0.01;

export async function POST(req: Request) {
  if (!receiver) {
    return NextResponse.json({ error: "QStash not configured" }, { status: 501 });
  }

  const body = await req.text();
  const signature = req.headers.get("Upstash-Signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }
  const valid = await receiver
    .verify({ signature, body })
    .catch(() => false);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const links = await getWatchedLinks();
  let checked = 0;
  let notified = 0;

  for (const link of links) {
    checked++;
    const balance = await getServerBalanceUsd(link.linkAddress);
    // null = the balance check itself failed (transient network/API error) —
    // leave the link in the watch list and try again next run, rather than
    // risk a false "claimed" push.
    if (balance === null || balance > EMPTY_THRESHOLD_USD) continue;

    const subs = await getSubscriptions(link.ownerAddress);
    const payload = JSON.stringify({
      title: "Money claimed",
      body: `Your ${formatUsd(link.amountUsd)} link was claimed 🎉`,
      url: "/",
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub as never, payload);
        notified++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked on the device — drop it.
          await removeSubscription(link.ownerAddress, sub);
        } else {
          console.error("[tap:cron] push send failed:", err);
        }
      }
    }

    await unregisterWatchedLink(link.linkId);
  }

  return NextResponse.json({ checked, notified });
}

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
