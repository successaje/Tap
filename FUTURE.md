# Roadmap

This document covers two categories of future work: the backend
infrastructure required to close known gaps in the current build, and
application-layer directions on the same account architecture that extend
tap beyond its current product category.

---

## Part 1 — Backend infrastructure

tap runs almost entirely without a backend, as described in the README's
*Backend and data* section. One piece of server-side state exists today —
the background push watcher below — added specifically because it could not
be built any other way. The remaining items are not yet implemented.

### Implemented — background push notifications
A sender's own browser tab previously had to be open and polling for "your
link was claimed" to arrive as a notification. This now works while the app
is closed: a scheduled job (Upstash QStash, every two minutes, request
signature verified) checks each outstanding link's balance server-side
(`app/api/cron/check-claims`) against a small Upstash Redis store
(`lib/server/kv.ts`) of registered links and push subscriptions, and pushes
the moment a link empties. Registration happens automatically when a link is
funded (`lib/links.ts`) and is removed on claim or reclaim, in both cases
best-effort — a failed call costs a missed notification, never a broken
transfer. Client-side detection is unchanged and still fires instantly when
a tab is open; this only closes the gap for when one isn't. Setup
instructions are in `.env.example`.

### 1. Cross-device activity history
Signing in on a new device currently shows the correct balance, read live
from the chain, but an empty activity feed, since history is stored in
`localStorage`. Moving activity writes to a small API backed by the same
Redis store, keyed by the user's Magic email or EOA address, resolves this
with `localStorage` retained as a local cache. The read/write shape in
`lib/activity.ts` requires minimal change, and the store already exists for
the push feature above.

### 2. Referral attribution
Referral tracking requires a server because a referring device cannot
observe activity on a referred device. A minimal version: a `?ref=`
parameter writes a pending referral record keyed by referral code; when the
referred account completes its first funded send, a webhook or the same
scheduled job marks the referral activated and credits the referrer. An
earlier version of this feature was removed from the codebase rather than
shipped with fabricated data — see `lib/referrals.ts` in git history.

### 3. Aggregate metrics
Product-level statistics ("total volume moved," "links claimed") become
meaningful once activity history is centralized (item 1), since they are an
aggregate query over the same store rather than a separate system.

Each remaining item is independently shippable and does not require changes
to the account architecture already in production.

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
   cross-device activity sync described in Part 1, item 1.

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

**A minimal slice of this is built and runs today**, not just outlined:
[`app/api/agent/resource`](app/api/agent/resource/route.ts) issues a real
402 with payment requirements, and [`scripts/agent-demo.mjs`](scripts/agent-demo.mjs)
is a standalone script — no browser, no human, no Next.js dependency — that
pays it in real USDC on Arbitrum using the same account primitives as the
rest of the product, then retries with proof and receives the resource.
Payment is verified by comparing the receiver's balance at challenge-issue
time against its balance on retry, rather than by parsing an individual
transaction's receipt — a deliberate simplification for a proof of concept,
documented in the route itself, that would need to become per-transaction
verification before this could serve more than one concurrent request.

```
Agent A (caller)                    Agent B (service)
     │                                     │
     │──── GET /api/agent/resource ──────▶│
     │                                     │
     │◀─── 402 Payment Required ──────────│  { challengeId, price, chain,
     │       + payment requirements       │    receiver }
     │                                     │
     │  scripts/agent-demo.mjs pays via   │
     │  its own Universal Account,        │
     │  real USDC, real Arbitrum          │
     │                                     │
     │──── GET /api/agent/resource ──────▶│
     │      X-Payment-Id, X-Payment-Tx    │
     │                                     │
     │◀─── 200 OK + resource ─────────────│  (B checks the receiver's
     │                                     │   balance moved by that much)
```

What's left to go from this proof of concept to the direction described
above:
1. **Agent identity without a human in the loop on every call.** The demo
   script holds its own raw private key — fine for a demo, not how a real
   agent would be provisioned. A human owner authenticating once via the
   existing Magic flow and issuing a scoped, long-lived credential for
   their agent's server-side use is the likely shape; Magic's server-side
   authentication is the other option (current documentation should be
   consulted at implementation time, as this surface evolves quickly). The
   Particle Universal Account layer in `lib/particle.ts` is already
   identity-agnostic — it requires only an EOA and a signer, which either
   approach provides.
2. **Per-transaction payment verification**, replacing the balance-delta
   check above — necessary once more than one payment can be outstanding
   against the same receiver at once.
3. **`tap-agent-sdk`.** Packaging `scripts/agent-demo.mjs`'s payment logic
   into a reusable `pay(requirements)` / `verifyPayment(txProof)` client,
   rather than a standalone script.
4. **Human interface.** The core payment loop requires no human-facing UI.
   A monitoring surface for the account owner — spend limits, transaction
   log, funding and cash-out — can reuse tap's existing Home, Activity, and
   Cash-out screens with minimal modification.

This direction has the least overlap with existing link-payment products,
and the closest alignment with where agent-native payment infrastructure is
heading — and unlike when this was purely a roadmap item, the core payment
mechanism is no longer a research question, since the proof of concept above
already moves real money on a 402 challenge/response.

### Relative priority

Ordered by implementation cost and time to ship, independent of long-term
strategic value:

1. **Durable receive requests** — smallest scope, composed mostly from
   existing components, ships independently of any backend work.
2. **Group expense settlement** — a genuine second product surface with a
   new data model, most valuable once cross-device activity sync (Part 1)
   is in place.
3. **Agent-to-agent micropayments** — highest ceiling and the direction
   with the most distinct market position. A working proof of concept
   already exists (see above); what's left is agent identity delegation
   and production-grade payment verification, not a research phase before
   implementation can begin.

None of these directions require modification to the core payment
architecture currently in production.
