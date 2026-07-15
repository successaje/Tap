/**
 * Every money-movement path (send, claim, pay, withdraw) throws errors that
 * originate from Magic's RPC, Particle's Universal Account SDK, or a raw
 * network failure — none of which are written for a user who's never heard
 * the word "wallet." `stage()` in lib/particle.ts prefixes these with which
 * step failed for our own debugging; this turns that into copy that fits
 * the rest of the product. The original error always still reaches the
 * console for real debugging — this only changes what's shown on screen.
 */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("denied") || lower.includes("rejected") || lower.includes("cancel")) {
    return "Cancelled — nothing was sent.";
  }
  if (lower.includes("insufficient") || lower.includes("empty")) {
    return raw.includes("already been claimed")
      ? raw
      : "Not enough balance to cover this, including fees.";
  }
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("enotfound") ||
    lower.includes("econnrefused")
  ) {
    return "Network hiccup — check your connection and try again.";
  }
  if (lower.includes("not configured")) {
    return "This isn't available in demo mode.";
  }
  // A handful of our own messages are already written for a human — anything
  // short, capitalized, and free of stage-prefix colons is one of these.
  if (raw.length < 80 && !/^[A-Za-z ()0-9]+:/.test(raw)) {
    return raw;
  }
  return "Something went wrong on our end — please try again.";
}
