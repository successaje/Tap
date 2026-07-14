"use client";

// Referral & rewards persistence layer. Tracks invited friends, their
// activity-based points contribution, and the referral bonus per friend.

export interface Referral {
  /** Unique ID for this referral record. */
  id: string;
  /** Display name of the invited friend. */
  name: string;
  /** Email (shown truncated in the list). */
  email: string;
  /** When they signed up via the referral link. */
  joinedAt: string;
  /** True once they've sent their first link (triggers the 500pt bonus). */
  activated: boolean;
  /** Points earned from their activation bonus. */
  bonusPoints: number;
}

const REFERRALS_KEY = "tap:referrals";
const REFERRAL_BONUS = 500; // points per activated friend

export function getReferrals(): Referral[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(REFERRALS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveReferrals(refs: Referral[]) {
  window.localStorage.setItem(REFERRALS_KEY, JSON.stringify(refs));
}

export function addReferral(name: string, email: string): Referral {
  const ref: Referral = {
    id: Math.random().toString(36).slice(2, 10),
    name,
    email,
    joinedAt: new Date().toISOString(),
    activated: false,
    bonusPoints: 0,
  };
  saveReferrals([ref, ...getReferrals()]);
  return ref;
}

export function activateReferral(id: string): Referral | null {
  const refs = getReferrals();
  const target = refs.find((r) => r.id === id);
  if (!target || target.activated) return null;
  target.activated = true;
  target.bonusPoints = REFERRAL_BONUS;
  saveReferrals(refs);
  return target;
}

/** Total referral bonus points earned from all activated friends. */
export function getTotalReferralPoints(): number {
  return getReferrals().reduce((sum, r) => sum + r.bonusPoints, 0);
}

/**
 * Seed demo referrals for a realistic rewards page. Called once on first
 * visit to the rewards page to make it look alive.
 */
export function seedDemoReferrals() {
  if (typeof window === "undefined") return;
  if (getReferrals().length > 0) return; // already seeded
  const now = Date.now();
  const DAY = 86400000;
  const demos: Referral[] = [
    {
      id: "ref-maya",
      name: "Maya Chen",
      email: "maya.c@gmail.com",
      joinedAt: new Date(now - 12 * DAY).toISOString(),
      activated: true,
      bonusPoints: REFERRAL_BONUS,
    },
    {
      id: "ref-james",
      name: "James Okafor",
      email: "j.okafor@gmail.com",
      joinedAt: new Date(now - 5 * DAY).toISOString(),
      activated: true,
      bonusPoints: REFERRAL_BONUS,
    },
    {
      id: "ref-sofia",
      name: "Sofia Rivera",
      email: "sofia.r@outlook.com",
      joinedAt: new Date(now - 1 * DAY).toISOString(),
      activated: false,
      bonusPoints: 0,
    },
  ];
  saveReferrals(demos);
}
