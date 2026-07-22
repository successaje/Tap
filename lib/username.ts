"use client";

// Username → address resolution, backed by the same Redis store as
// referrals and stats. Lets two people who both already have tap send
// directly to each other — the counterpart to link-sending, which exists
// for the case where the recipient doesn't have an account yet.

export async function resolveUsername(username: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/username?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.address ?? null;
  } catch {
    return null;
  }
}

export async function getUsernameForAddress(address: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/username?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.username ?? null;
  } catch {
    return null;
  }
}

export async function claimUsername(
  username: string,
  address: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch("/api/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, address }),
    });
    return await res.json();
  } catch {
    return { ok: false, reason: "network" };
  }
}
