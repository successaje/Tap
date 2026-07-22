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

export const TX_KINDS = ["send", "claim", "reclaim", "pay", "withdraw", "agentPay"] as const;
export type TxKind = (typeof TX_KINDS)[number];

const STATS_KEY = "stats:tx";

/** Real-money-movement counter — the only source of "how much has actually moved" numbers. */
export async function recordTransaction(kind: TxKind, amountUsd: number) {
  if (!redis) return;
  await redis.hincrby(STATS_KEY, `${kind}Count`, 1);
  await redis.hincrbyfloat(STATS_KEY, `${kind}Volume`, amountUsd);
}

export async function getStats(): Promise<Record<string, number>> {
  if (!redis) return {};
  const all = await redis.hgetall<Record<string, string | number>>(STATS_KEY);
  if (!all) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(all)) out[k] = Number(v) || 0;
  return out;
}

const AGENT_CHALLENGE_KEY = (id: string) => `agent:challenge:${id}`;
const AGENT_CHALLENGE_TTL_SECONDS = 300;

export interface AgentChallenge {
  id: string;
  receiver: string;
  priceUsd: number;
  balanceAtIssueUsd: number;
  issuedAt: string;
}

/**
 * The x402 demo (app/api/agent/resource) verifies payment by comparing the
 * receiver's balance at 402-issue-time against its balance when the client
 * retries with proof — not by parsing a transaction receipt. A challenge is
 * the balance snapshot that comparison is made against; it self-expires so a
 * stale one can't be replayed against a later, unrelated balance increase.
 */
export async function createAgentChallenge(
  challenge: AgentChallenge
): Promise<void> {
  if (!redis) return;
  await redis.set(AGENT_CHALLENGE_KEY(challenge.id), JSON.stringify(challenge), {
    ex: AGENT_CHALLENGE_TTL_SECONDS,
  });
}

export async function getAgentChallenge(id: string): Promise<AgentChallenge | null> {
  if (!redis) return null;
  const raw = await redis.get<string | AgentChallenge>(AGENT_CHALLENGE_KEY(id));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function consumeAgentChallenge(id: string): Promise<void> {
  if (!redis) return;
  await redis.del(AGENT_CHALLENGE_KEY(id));
}

const REFERRAL_BONUS_POINTS = 500;
const REFERRAL_CODE_KEY = (code: string) => `referral:code:${code}`;
const REFERRAL_PENDING_KEY = (referredAddress: string) =>
  `referral:pending:${referredAddress.toLowerCase()}`;
const REFERRAL_POINTS_KEY = (referrerAddress: string) =>
  `referral:points:${referrerAddress.toLowerCase()}`;

/** Registers a referrer's short code → their address, so a later signup can resolve it. */
export async function linkReferralCode(code: string, referrerAddress: string) {
  if (!redis) return;
  await redis.set(REFERRAL_CODE_KEY(code), referrerAddress.toLowerCase());
}

/**
 * Records "this address was referred by whoever owns this code" — pending,
 * not yet credited. Only meant to be called once, right when a brand-new
 * account finishes onboarding (see components/onboarding.tsx), so an
 * existing user clicking a stray `?ref=` link later can't retroactively
 * generate a referral. Silently declines a self-referral or a second
 * capture for the same address (first one wins).
 */
export async function capturePendingReferral(
  referredAddress: string,
  code: string
): Promise<boolean> {
  if (!redis) return false;
  const referrerAddress = await redis.get<string>(REFERRAL_CODE_KEY(code));
  if (!referrerAddress || referrerAddress === referredAddress.toLowerCase()) {
    return false;
  }
  const key = REFERRAL_PENDING_KEY(referredAddress);
  const existing = await redis.get(key);
  if (existing) return false;
  await redis.set(key, referrerAddress);
  return true;
}

/**
 * Credits the referrer +500 points the first time the referred address
 * completes a real send — called from lib/links.ts right after that
 * succeeds. The pending record is deleted on credit, so calling this again
 * on every subsequent send (which does happen — it's unconditional in
 * createFundedLink) correctly no-ops instead of double-crediting.
 */
export async function creditReferralIfPending(referredAddress: string): Promise<boolean> {
  if (!redis) return false;
  const key = REFERRAL_PENDING_KEY(referredAddress);
  const referrerAddress = await redis.get<string>(key);
  if (!referrerAddress) return false;
  await redis.del(key);
  await redis.hincrby(REFERRAL_POINTS_KEY(referrerAddress), "points", REFERRAL_BONUS_POINTS);
  await redis.hincrby(REFERRAL_POINTS_KEY(referrerAddress), "count", 1);
  return true;
}

export async function getReferralStats(
  address: string
): Promise<{ points: number; count: number }> {
  if (!redis) return { points: 0, count: 0 };
  const data = await redis.hgetall<Record<string, string | number>>(
    REFERRAL_POINTS_KEY(address)
  );
  return { points: Number(data?.points ?? 0), count: Number(data?.count ?? 0) };
}

const USERNAME_HANDLE_KEY = (username: string) => `username:handle:${username.toLowerCase()}`;
const USERNAME_OWNER_KEY = (address: string) => `username:owner:${address.toLowerCase()}`;

/**
 * One active handle per address. Claiming re-points the reverse index and
 * frees any previous handle that address held, so a user can change their
 * username without a stale one lingering as unusable dead weight. Claiming
 * your own already-claimed handle again is a harmless no-op success, since
 * the Profile UI re-submits the current value along with any other field.
 */
export async function claimUsername(
  username: string,
  address: string
): Promise<{ ok: boolean; reason?: "taken" }> {
  if (!redis) return { ok: false };
  const owner = await redis.get<string>(USERNAME_HANDLE_KEY(username));
  if (owner && owner !== address.toLowerCase()) {
    return { ok: false, reason: "taken" };
  }
  const previous = await redis.get<string>(USERNAME_OWNER_KEY(address));
  if (previous && previous !== username.toLowerCase()) {
    await redis.del(USERNAME_HANDLE_KEY(previous));
  }
  await redis.set(USERNAME_HANDLE_KEY(username), address.toLowerCase());
  await redis.set(USERNAME_OWNER_KEY(address), username.toLowerCase());
  return { ok: true };
}

/** Resolve @username → address, for the send flow. */
export async function resolveUsername(username: string): Promise<string | null> {
  if (!redis) return null;
  return (await redis.get<string>(USERNAME_HANDLE_KEY(username))) ?? null;
}

/** Reverse lookup, for Profile to show "you are @…". */
export async function getUsernameForAddress(address: string): Promise<string | null> {
  if (!redis) return null;
  return (await redis.get<string>(USERNAME_OWNER_KEY(address))) ?? null;
}
