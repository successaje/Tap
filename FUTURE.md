# Roadmap

This document covers two categories of future work: the backend
infrastructure required to close known gaps in the current build, and
application-layer directions on the same account architecture that extend
tap beyond its current product category.

---

## Part 1 — Backend infrastructure

tap currently has no backend and no database, as described in the README's
*Backend and data* section. In priority order, this is what a minimal
backend would add.

### 1. Background push notifications
The current implementation delivers a push notification only when a sender's
own browser tab is open and polling detects a claim. The delivery
infrastructure already exists (`lib/push.ts`, `/api/push`, VAPID keys,
service-worker handlers); what is missing is a process watching the chain on
the user's behalf, independent of any open tab.

Proposed implementation:
- A key-value store (Vercel KV or Upstash Redis) holding
  `{ userId, pushSubscription, outstandingLinkAddresses[] }`.
- A scheduled job (Vercel Cron, every one to two minutes) that checks each
  outstanding link's balance using the same logic `syncSentLinkClaims()`
  already runs client-side (`lib/links.ts`), and sends a push directly for
  any link that emptied since the previous run.
- No new user-facing surface. This closes an existing feature rather than
  introducing one.

### 2. Cross-device activity history
Signing in on a new device currently shows the correct balance, read live
from the chain, but an empty activity feed, since history is stored in
`localStorage`. Moving activity writes to a small API backed by the same
data store, keyed by the user's Magic email or EOA address, resolves this
with `localStorage` retained as a local cache. The read/write shape in
`lib/activity.ts` requires minimal change.

### 3. Referral attribution
Referral tracking requires a server because a referring device cannot
observe activity on a referred device. A minimal version: a `?ref=`
parameter writes a pending referral record keyed by referral code; when the
referred account completes its first funded send, a webhook or the same
scheduled job marks the referral activated and credits the referrer. An
earlier version of this feature was removed from the codebase rather than
shipped with fabricated data — see `lib/referrals.ts` in git history.

### 4. Aggregate metrics
Product-level statistics ("total volume moved," "links claimed") become
meaningful once activity history is centralized (item 2), since they are an
aggregate query over the same store rather than a separate system.

Each item above is independently shippable and does not require changes to
the account architecture already in production.

---

## Part 2 — Application-layer directions

The account architecture underlying tap — identity mints a Universal
Account, a link is a claim ticket against value moved through that account,
Arbitrum settles it — is reusable beyond peer-to-peer transfer. The three
directions below apply the same architecture to different products.

### A. Group expense settlement
Replace the single sender-to-recipient link with a shared bill: one person
creates an event, individual claim links are generated per participant, each
participant pays their share independently, and the event settles to one
place with running balance state.

This differs structurally from a single-link transfer rather than
restyling it — the underlying primitive becomes a many-to-one settlement
event rather than a single deposit and claim. It also has the broadest
existing user base of the three directions, since group expense-splitting
is an established behavior independent of crypto adoption.

Implementation outline:
1. A `SplitEvent { id, title, totalUsd, participants[] }` record, where each
   participant receives a throwaway claim key using the same mechanism as
   `lib/links.ts`.
2. Creation UI reuses the existing keypad and amount components with a
   participant list in place of a single recipient.
3. Claim UI reuses `ClaimMoment` and `ClaimUnavailable` with adjusted copy.
4. Settlement is a standard `transferOnArbitrum()` call per participant to
   the event creator's address; no new on-chain mechanism is required.
5. A live "N of M paid" state across participants' devices requires the
   cross-device activity sync described in Part 1, item 2.

### B. Durable receive requests
Invert the direction of the existing request flow: instead of a one-time
link created per transaction, a recipient publishes a permanent request — a
printed QR or NFC code for a market stall, tip jar, or independent seller —
that remains payable indefinitely.

Most of the underlying mechanism already exists: `/request` generates a
link and QR code via `PaymentQR`, and a signed-in user's personal pay link
is already durable. The remaining work is presentation: a dedicated
high-contrast QR screen designed for printing or display, without a fixed
amount, and repeat-payer recognition on the `/pay` flow. This is the
smallest of the three directions to implement, composed largely from
existing components.

### C. Agent-to-agent micropayments
Arbitrum's bounty documentation cites AI applications with invisible
on-chain payments as an example direction. In this model, tap is not a
human-facing application — it is infrastructure an AI agent or backend
service uses to pay another agent or service for an API call, a tool
invocation, or a unit of compute, with a claim token replacing the
human-facing claim link.

This direction pairs naturally with [x402](https://github.com/coinbase/x402),
the emerging HTTP-native "402 Payment Required" standard for exactly this
pattern: a server responds with HTTP 402 and payment requirements, the
calling agent pays, and the request is retried with proof of payment
attached. The underlying account primitives tap already implements —
Universal Account creation, cross-chain transfer, on-chain receipt
verification — are the components x402 requires from a payer implementation.

```
Agent A (caller)                    Agent B (service)
     │                                     │
     │──── GET /api/resource ────────────▶│
     │                                     │
     │◀─── 402 Payment Required ──────────│  { amount, chain: Arbitrum,
     │       + payment requirements       │    receiver, asset: USDC }
     │                                     │
     │  tap-agent-sdk pays via the        │
     │  caller's Universal Account,       │
     │  reusing transferOnArbitrum()      │
     │                                     │
     │──── GET /api/resource ────────────▶│
     │      + X-PAYMENT: <tx proof>       │
     │                                     │
     │◀─── 200 OK + resource ─────────────│  (B verifies the on-chain
     │                                     │   receipt before releasing)
```

Implementation outline:
1. **Agent identity.** Each agent requires a Universal Account without an
   interactive Google login on every call. Two approaches: a human owner
   authenticates once via the existing Magic flow and issues a scoped,
   long-lived credential for server-side use by their agent, or Magic's
   server-side authentication is used directly (current documentation
   should be consulted at implementation time, as this surface evolves
   quickly). The Particle Universal Account layer in `lib/particle.ts` is
   already identity-agnostic — it requires only an EOA and a signer, which
   either approach provides.
2. **`tap-agent-sdk`.** A thin wrapper exposing `pay(requirements)` and
   `verifyPayment(txProof)`, built directly on the existing
   `transferOnArbitrum()` and `getUniversalAccount()` functions — largely
   a packaging exercise rather than new payment logic.
3. **x402 middleware.** A small server-side middleware for the receiving
   agent that issues the 402 response with payment requirements and
   validates the `X-PAYMENT` proof against Particle's transaction API
   before releasing the resource.
4. **Human interface.** The core payment loop requires no human-facing UI.
   A monitoring surface for the account owner — spend limits, transaction
   log, funding and cash-out — can reuse tap's existing Home, Activity, and
   Cash-out screens with minimal modification.

This direction carries the highest execution risk of the three: x402 is an
early-stage standard, agent identity delegation requires implementation
research against current provider documentation, and the core interaction
has no human-facing moment to evaluate against the hackathon's UX criterion.
It is also the direction with the least overlap with existing link-payment
products, and the closest alignment with where agent-native payment
infrastructure is heading.

### Relative priority

Ordered by implementation cost and time to ship, independent of long-term
strategic value:

1. **Durable receive requests** — smallest scope, composed mostly from
   existing components, ships independently of any backend work.
2. **Group expense settlement** — a genuine second product surface with a
   new data model, most valuable once cross-device activity sync (Part 1)
   is in place.
3. **Agent-to-agent micropayments** — highest ceiling and the direction
   with the most distinct market position, but requires dedicated research
   time on agent identity and x402 before implementation begins.

None of these directions require modification to the core payment
architecture currently in production.
