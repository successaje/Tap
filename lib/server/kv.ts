// Server-only persistence for background push. This is the one piece of
// state tap keeps off-device — everything else (balances, activity, session)
// is either read live from the chain or kept in the browser. See FUTURE.md
// for why this specific feature needed a backend.
import "server-only";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvConfigured = !!(url && token);

const redis = kvConfigured ? new Redis({ url: url!, token: token! }) : null;

const SUB_KEY = (owner: string) => `push:sub:${owner.toLowerCase()}`;
const WATCH_KEY = "push:watch";

export interface WatchedLink {
  linkId: string;
  ownerAddress: string;
  linkAddress: string;
  amountUsd: number;
  note?: string;
  createdAt: string;
}

/** Add a subscription for an owner address (a Set — naturally de-duplicates). */
export async function addSubscription(owner: string, subscription: unknown) {
  if (!redis) return;
  await redis.sadd(SUB_KEY(owner), JSON.stringify(subscription));
}

export async function removeSubscription(owner: string, subscription: unknown) {
  if (!redis) return;
  await redis.srem(SUB_KEY(owner), JSON.stringify(subscription));
}

export async function getSubscriptions(owner: string): Promise<unknown[]> {
  if (!redis) return [];
  const raw = await redis.smembers(SUB_KEY(owner));
  return raw.map((s) => {
    try {
      return typeof s === "string" ? JSON.parse(s) : s;
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export async function registerWatchedLink(link: WatchedLink) {
  if (!redis) return;
  await redis.hset(WATCH_KEY, { [link.linkId]: JSON.stringify(link) });
}

export async function unregisterWatchedLink(linkId: string) {
  if (!redis) return;
  await redis.hdel(WATCH_KEY, linkId);
}

export async function getWatchedLinks(): Promise<WatchedLink[]> {
  if (!redis) return [];
  const all = await redis.hgetall<Record<string, string>>(WATCH_KEY);
  if (!all) return [];
  return Object.values(all).map((v) =>
    typeof v === "string" ? JSON.parse(v) : (v as unknown as WatchedLink)
  );
}
