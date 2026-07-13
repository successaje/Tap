"use client";

import type { PaymentLink } from "@/lib/mock";

// Client-side mock store (localStorage). Magic + Particle replace this later:
// the exported function signatures are the seam.

export interface MockUser {
  name: string;
  email: string;
  /** Present once real Magic auth is wired in (the embedded-wallet address). */
  address?: string;
  avatar?: string;
}

const USER_KEY = "tap:user";
const LINKS_KEY = "tap:links";
const BALANCE_KEY = "tap:balance";
const ONBOARDED_KEY = "tap:onboarded";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUser(): MockUser | null {
  return read<MockUser>(USER_KEY);
}

/** First-run flag: gates the "you now have an account" welcome moment. */
export function isOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded() {
  if (typeof window !== "undefined")
    window.localStorage.setItem(ONBOARDED_KEY, "1");
}

/** Mock Google sign-in: resolves after a short "network" delay. */
export function signIn(): Promise<MockUser> {
  return new Promise((resolve) =>
    setTimeout(() => {
      const user: MockUser = { name: "Alex", email: "alex.rivera@gmail.com" };
      write(USER_KEY, user);
      resolve(user);
    }, 900)
  );
}

export function signOut() {
  if (typeof window !== "undefined") window.localStorage.removeItem(USER_KEY);
}

export function getBalance(): number {
  return read<number>(BALANCE_KEY) ?? 0;
}

export function addToBalance(amount: number): number {
  const next = Math.round((getBalance() + amount) * 100) / 100;
  write(BALANCE_KEY, next);
  return next;
}

export function deductFromBalance(amount: number): number {
  const next = Math.round((getBalance() - amount) * 100) / 100;
  write(BALANCE_KEY, next);
  return next;
}

/** Links this user created (sender side). */
export function getSentLinks(): PaymentLink[] {
  return read<PaymentLink[]>(LINKS_KEY) ?? [];
}

export function createLink(amountUsd: number, note?: string): PaymentLink {
  const DAY = 24 * 60 * 60 * 1000;
  const link: PaymentLink = {
    id: Math.random().toString(36).slice(2, 8),
    amountUsd,
    senderName: getUser()?.name ?? "You",
    note: note || undefined,
    status: "unclaimed",
    boundTo: null,
    createdAt: new Date().toISOString(),
    // Short expiry window; sender can reclaim any time before it's claimed.
    expiresAt: new Date(Date.now() + 7 * DAY).toISOString(),
  };
  write(LINKS_KEY, [link, ...getSentLinks()]);
  return link;
}

export function reclaimLink(id: string) {
  const links = getSentLinks().map((l) =>
    l.id === id && (l.status === "unclaimed" || l.status === "expired")
      ? { ...l, status: "reclaimed" as const }
      : l
  );
  write(LINKS_KEY, links);
}
