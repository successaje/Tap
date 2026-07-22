"use client";

// Saved recipients, kept device-local like activity and sent-link records —
// no server needed, since this is purely "make sending to the same person
// twice faster," not something another device needs to see.

export interface Beneficiary {
  id: string;
  label: string;
  address: string;
  addedAt: string;
}

const KEY = "tap:beneficiaries";

export function getBeneficiaries(): Beneficiary[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function findBeneficiaryByAddress(address: string): Beneficiary | undefined {
  const target = address.trim().toLowerCase();
  return getBeneficiaries().find((b) => b.address.toLowerCase() === target);
}

/** Add or rename — one entry per address, keyed case-insensitively. */
export function saveBeneficiary(label: string, address: string): Beneficiary {
  const trimmedLabel = label.trim() || address.slice(0, 8);
  const target = address.trim().toLowerCase();
  const existing = getBeneficiaries();
  const match = existing.find((b) => b.address.toLowerCase() === target);
  const entry: Beneficiary = match
    ? { ...match, label: trimmedLabel }
    : {
        id: Math.random().toString(36).slice(2, 10),
        label: trimmedLabel,
        address: address.trim(),
        addedAt: new Date().toISOString(),
      };
  const rest = existing.filter((b) => b.address.toLowerCase() !== target);
  window.localStorage.setItem(KEY, JSON.stringify([entry, ...rest]));
  return entry;
}

export function removeBeneficiary(id: string) {
  const rest = getBeneficiaries().filter((b) => b.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(rest));
}
