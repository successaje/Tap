import "server-only";
import { TX_KINDS, type TxKind } from "@/lib/server/kv";

export const isAddress = (v: unknown): v is string =>
  typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

// Matches how lib/links.ts derives an id: ephemeral.address.slice(2, 10).toLowerCase().
export const isLinkId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}$/.test(v);

export const isReasonableAmount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1_000_000;

export const MAX_NOTE_LENGTH = 280;

export function sanitizeNote(note: unknown): string | undefined {
  if (typeof note !== "string") return undefined;
  const trimmed = note.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

export const isTxKind = (v: unknown): v is TxKind =>
  typeof v === "string" && (TX_KINDS as readonly string[]).includes(v);

// Same shape as isLinkId (8 lowercase hex chars) but a distinct referral-code
// concept — kept as its own name so a future change to one doesn't silently
// affect the other just because the regex happens to match today.
export const isReferralCode = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}$/.test(v);
