# What's next for tap

This is the honest "if we kept building" document — not hackathon padding.
Two kinds of work live here: **infrastructure tap already needs** (a backend,
eventually), and **application-layer concepts** on the same core stack
(identity-minted Universal Account, EIP-7702, Arbitrum settlement) that would
give tap a product surface distinct from Peanut Protocol, rather than
competing head-on in the same category. See the README's *"Isn't this just
Peanut?"* section for why that distinction matters.

---

## Part 1 — Infrastructure: closing the backend gap

tap currently has **no backend and no database** (see the README's
*Architecture* section for the full breakdown of what that does and doesn't
cost us). In priority order, here's what a real backend would unlock:

### 1. Push notifications that fire when the app is closed
**The highest-leverage addition.** Today, "your link was claimed" only fires
if the sender's own tab is open and happens to poll the chain. The
infrastructure to *deliver* the push already exists (`lib/push.ts`,
`/api/push`, VAPID keys, service-worker handlers) — what's missing is
something watching the chain on the user's behalf.

**Shape of the fix:**
- A small key-value store (Vercel KV or Upstash Redis — both have
  near-zero-setup free tiers) holding `{ userId, pushSubscription,
  outstandingLinkAddresses[] }`.
- A Vercel Cron job (every 1–2 minutes) that iterates outstanding links,
  calls `getUnifiedBalance()` on each (the exact check `syncSentLinkClaims()`
  already does client-side, in `lib/links.ts`), and calls `webpush.send()`
  directly for any that emptied since the last run.
- No new user-facing surface — this is invisible plumbing that makes the
  existing "🎉 claimed" moment work even when you're not looking at your
  phone.

### 2. Activity history that follows identity, not device
Right now, signing in on a new phone shows the correct on-chain balance
(the chain is the source of truth for that) but an **empty activity feed**
(it's `localStorage`, per-device). Fix: move `lib/activity.ts`'s writes to a
`POST /api/activity` backed by the same KV/DB, keyed by the user's Magic
`email` or EOA address, with `localStorage` staying as an optimistic local
cache. Low risk, mechanical change — the read/write shape barely changes.

### 3. Referral attribution
As covered in the README, this is fundamentally undoable client-only — a
referrer's device cannot observe what happens on a referee's device. Real
version: `?ref=` param → write a pending referral row keyed by referral code
→ when the referee's *first funded send* succeeds, a server-side webhook (or
the same cron sweep) flips it to `activated` and credits the referrer. This
was explicitly cut from the hackathon build rather than faked — see the
git history for the removed `lib/referrals.ts`.

### 4. Global metrics
"$X moved through tap today," "N links claimed" — a nice-to-have marketing
surface, but only meaningful once (1) and (2) exist, since it's just an
aggregate query over the same activity store.

None of this is a redesign — it's the same architecture with a thin,
serverless data layer added underneath. Each item is independently shippable
in isolation.

---

## Part 2 — Application-layer concepts on the same stack

The core primitive tap has built is genuinely reusable: **an identity login
mints a Universal Account; a link (or a request) is a claim ticket against
value moved through that account; Arbitrum settles it invisibly.** Below are
three different products built on exactly that primitive, each aimed at a
different buyer than Peanut's human-to-human remittance framing.

### Option A — Split: group expense settlement
Instead of tap's current one-to-one "here's a link," the primitive becomes a
**shared bill**. One person creates an event (dinner, trip, rent), it
generates individual claim links per participant, each pays their share from
whatever they hold, and it all settles to one place with running balance
state.

**Why it's structurally different from Peanut, not a reskin:** Peanut's
atomic unit is a single deposit-and-claim. This is a many-to-one settlement
event with state — closer to Splitwise's category than Peanut's. Also the
strongest **adoption** story (20% of score) of the three options, since group
expense-splitting is a universal, already-existing habit, not a
crypto-native behavior you're hoping to create.

**Rough build steps, reusing what exists:**
1. New data shape: `SplitEvent { id, title, totalUsd, participants[] }`,
   each participant gets a `share` and their own claim-link-style throwaway
   key (identical mechanic to today's `lib/links.ts`).
2. Creation UI: reuse `Keypad` + a participant list instead of a single
   recipient.
3. Claim UI: reuse `ClaimMoment`/`ClaimUnavailable` almost verbatim — "You
   owe $12 for dinner" instead of "Maya sent you $42.50."
4. Settlement: each participant's payment is a normal `transferOnArbitrum()`
   call to the event creator's address — no new on-chain mechanism needed.
5. Needs Part 1.2 (server-side activity) to show a live "3 of 5 paid" state
   across every participant's device.

### Option B — Durable receive-requests ("tap-to-pay-me")
Flip the direction: instead of a sender pushing a one-shot link, a receiver
posts a **permanent** request — a market stall, tip jar, or small creator
prints one QR/NFC sticker once, and it becomes a standing "pay me" surface
anyone can tap, indefinitely.

**Why it's different:** Peanut is entirely sender-initiated (create a link,
push it). This is receiver-initiated and durable, not one-shot — closer to a
Venmo/Cash App `$cashtag` than a claim link.

**Rough build steps:** tap already has 80% of this — `/request` generates a
link+QR via `PaymentQR`, and a signed-in user's own pay link (surfaced on
Home) is *already* durable. The gap is packaging: a dedicated "My tap code"
screen meant for printing/display (large, high-contrast QR, no amount
baked in, brandable), plus letting the `/pay` flow remember "who paid me
before" for repeat tippers. Smallest lift of the three — mostly a new screen
composed from existing components (`PaymentQR`, `Keypad`), not new payment
logic.

### Option C — Agent-to-agent micropayments (most novel, most distinct from Peanut)
Arbitrum's own bounty brief names *"AI apps with invisible onchain
payments"* as an example. Here tap isn't a human-facing app at all — it's
infrastructure an AI agent or backend service calls to pay another
agent/service for an API call, a tool invocation, or a slice of compute,
with the "claim link" becoming a programmatic payment token instead of
something a human taps.

**Why it's the sharpest differentiator:** Peanut is explicitly
human-to-human P2P. This is agent-to-agent, machine-initiated, and pairs
naturally with **[x402](https://github.com/coinbase/x402)** — the emerging
HTTP-native "402 Payment Required" standard for exactly this pattern (a
server responds `402` with payment requirements in the response headers; the
caller's agent pays and retries the request with proof of payment). tap's
stack already has every primitive x402 needs — it's the missing "payer"
implementation, not a new payment rail.

**Concrete architecture:**
```
Agent A (caller)                    Agent B (service)
     │                                     │
     │──── GET /api/resource ────────────▶│
     │                                     │
     │◀─── 402 Payment Required ──────────│  { amount, chain: Arbitrum,
     │       + payment requirements       │    receiver, asset: USDC }
     │                                     │
     │  [tap-agent-sdk pays via the       │
     │   caller's Universal Account —     │
     │   same transferOnArbitrum() the    │
     │   app already uses]                │
     │                                     │
     │──── GET /api/resource ────────────▶│
     │      + X-PAYMENT: <tx proof>       │
     │                                     │
     │◀─── 200 OK + resource ─────────────│  (B verifies the on-chain
     │                                     │   receipt before releasing)
```

**Rough build steps:**
1. **Agent identity**: each agent needs a Universal Account without an
   interactive Google login on every call. Two viable paths: (a) a human
   owner signs in once via the existing Magic flow and issues a scoped,
   long-lived credential for their agent to hold server-side, or (b) Magic's
   server-side/delegated auth (check current docs at build time — this
   space moves fast, same rule as the rest of this project). Either way,
   the *Particle Universal Account* layer (`lib/particle.ts`) is already
   identity-agnostic — it just needs an EOA and a signer, which either path
   provides.
2. **`tap-agent-sdk`**: a thin wrapper exposing `pay(requirements)` and
   `verifyPayment(txProof)`, built directly on the existing
   `transferOnArbitrum()` / `getUniversalAccount()` functions in
   `lib/particle.ts` — this is largely repackaging, not new logic.
3. **x402 middleware**: a small Express/Next middleware for the *receiving*
   agent that emits the `402` + requirements and validates the `X-PAYMENT`
   proof against Particle's transaction API before releasing the resource.
4. **No human UI required for the core loop** — the "product" becomes a
   dashboard for the human owner to set spend limits, watch their agent's
   transaction log, and fund/cash-out its Universal Account, reusing tap's
   existing Home/Activity/Cash-out screens almost as-is.

**Honest risk assessment:** highest execution risk of the three (x402 is
young, agent-identity delegation needs real research against current Magic
docs, and there's no human tapping a ripple animation to score on the 40%
UX weighting) — but it's the one furthest from "isn't this just Peanut,"
and it's the direction most aligned with where agent-native payments are
heading industry-wide.

---

## My honest ranking, if choosing one to build next

1. **Option B (durable receive-requests)** — smallest lift, ships in days
   not weeks, and is purely additive to what exists today.
2. **Option A (Split)** — best balance of distinctiveness and demoability,
   but a real second build effort (new data model, new claim copy, needs
   Part 1.2 for the live "who's paid" state to feel real across devices).
3. **Option C (Agent payments)** — most interesting, most defensible against
   the Peanut comparison, but the one to attempt only with real runway and
   a clear owner for the x402/agent-identity research — not a "quick add."

None of these require touching the core architecture that's already proven
end-to-end with real money. That part stays exactly as it is.
