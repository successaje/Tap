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
const RATE_KEY = (bucket: string, id: string) => `push:rl:${bucket}:${id.toLowerCase()}`;

// Bounds the cron watcher's worst-case cost per run (one Particle balance
// check per watched link) against a flood of fake registrations from a
// client that has no server-verified identity to rate-limit more precisely.
const MAX_WATCHED_LINKS = 2000;

/**
 * A crude but real deterrent against one caller spamming an endpoint: at
 * most `limit` calls per `windowSeconds` for a given (bucket, id) pair.
 * Not a substitute for authenticated rate limiting — ownerAddress here is
 * client-asserted, not verified — but it caps the blast radius of casual
 * abuse without needing a session system this app doesn't have.
 */
export async function checkRateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (!redis) return true;
  const key = RATE_KEY(bucket, id);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count <= limit;
}

export interface WatchedLink {
  linkId: string;
  ownerAddress: string;
  linkAddress: string;
  amountUsd: number;
  note?: string;
  createdAt: string;
}

const MAX_SUBSCRIPTIONS_PER_OWNER = 10;

/** Add a subscription for an owner address (a Set — naturally de-duplicates). */
export async function addSubscription(owner: string, subscription: unknown): Promise<boolean> {
  if (!redis) return false;
  const key = SUB_KEY(owner);
  const existing = await redis.scard(key);
  if (existing >= MAX_SUBSCRIPTIONS_PER_OWNER) return false;
  await redis.sadd(key, JSON.stringify(subscription));
  return true;
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

/** Returns false (registration skipped) if the global watch list is already at capacity. */
export async function registerWatchedLink(link: WatchedLink): Promise<boolean> {
  if (!redis) return false;
  const size = await redis.hlen(WATCH_KEY);
  if (size >= MAX_WATCHED_LINKS) return false;
  await redis.hset(WATCH_KEY, { [link.linkId]: JSON.stringify(link) });
  return true;
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
