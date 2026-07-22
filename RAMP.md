# Local cash-in / cash-out — design and scope

Status: **design only, not implemented.** No code in this repo talks to
Yellow Card yet. This document exists so the integration can start the day
sandbox credentials exist, instead of starting from a blank page.

Both `app/withdraw/page.tsx` and `components/deposit-sheet.tsx` already ship
a "Bank transfer" / "Debit card" rail marked `live: false`. This is the
design for turning that into something real, starting with Nigeria.

---

## Provider: Yellow Card

Chosen over building anything in-house because, as of Nigeria's July 2026
Executive Order on Virtual Assets Coordination, moving NGN in or out of
crypto requires an SEC-licensed VASP — not a thing to become, a thing to
integrate with. Yellow Card is Africa's largest licensed on/off-ramp (20
countries, ~1.7M users), and their public API docs
(`docs.yellowcard.engineering`) confirm the two things that matter most:

- **`POST /business/details/bank`** ("Resolve Bank Account") — validates an
  account number against a bank and returns the holder's name before any
  money moves. Their docs say this endpoint is *"currently only required
  for Nigeria"* — i.e. they built the exact trust-building step every
  Nigerian fintech user already expects (enter account number, see the name
  resolve, confirm), specifically because Nigeria needs it.
- A working sandbox environment (`sandbox.api.yellowcard.io`) with a
  `Simulate Deposit` endpoint for virtual accounts — this is genuinely
  testable before going live, not just a live-or-nothing API.

**Access is not self-serve.** Their onboarding is a real B2B pipeline: intro
call → pre-integration form → KYB documentation → AML process review →
signed partnership agreement → *then* sandbox API keys. That's the actual
first step, and it's a business-development task with a multi-week
timeline, not a coding task. Nothing below can be tested against real
sandbox behavior until that's done.

---

## The architectural shift this forces

Everything tap has built so far avoids a real backend on purpose (see
README's *Backend and data* section): balances and activity are either read
live from the chain or kept in `localStorage`; the only server-side state
(`lib/server/kv.ts`) is explicitly **best-effort** — a lost push
subscription costs a missed notification, never a broken transfer, and
every function in that file is written to fail silently and safely.

A fiat rail breaks that assumption for the first time. Yellow Card's
webhook for "the NGN deposit landed" or "the payout settled" can arrive at
any time, including while no tab is open — and unlike a missed push
notification, losing track of it means losing track of whether a user's
real money is in flight. This needs a **durable, authoritative** record,
not a best-effort one. It still lives in the same Redis instance (no new
infrastructure), but it's a new reliability tier for that file: a
`ramp:*` key namespace that is the source of truth for "does this user have
money moving through a rail right now," not a cache of something recoverable
elsewhere.

---

## Flow 1 — Withdraw (crypto → NGN)

The simpler direction: no inbound webhook has to trigger an outbound crypto
transfer, so there's no new "who gets credited" ambiguity.

1. User picks "Bank transfer" on the existing Withdraw screen (flips
   `live: false` → `true` in `app/withdraw/page.tsx`).
2. User enters their bank + account number. Call **Resolve Bank Account**;
   show the returned account name back to them for confirmation — same
   trust step Paystack/Flutterwave/Opay users already know.
3. Call **Get Channels** (filtered to Nigeria) to get the `channelId` for
   that bank-transfer rail, and a rate/quote.
4. User confirms an amount. tap moves their real USDC from their Universal
   Account to a Yellow Card collection address — this is `transferOnArbitrum`
   exactly as it already exists in `lib/particle.ts`, just with Yellow
   Card's address as the destination instead of another tap link or wallet.
5. Once that transfer lands, call **Submit Send Request** with the
   `channelId`, destination bank details, and amount.
6. Yellow Card's webhook reports the payout status; tap's durable record
   moves `pending → sent | failed`. The UI polls its own status endpoint
   (`GET /api/ramp/status?id=…`) the same way the existing "sending…" phase
   already waits on `transferOnArbitrum`'s promise — just longer, and
   resumable if the tab closes.

## Flow 2 — Deposit (NGN → crypto)

The harder direction, because Yellow Card's own docs are explicit that NGN
**virtual accounts are receive-only** — money lands in *their* ledger, not
directly on a chain, so tap has to bridge the last hop itself.

1. User picks "Bank transfer" on the existing Deposit sheet
   (`components/deposit-sheet.tsx`).
2. tap creates a dedicated virtual account for that user
   (`POST /sub-wallets` with `createVirtualAccount: true`) — or reuses one if
   it already exists for that address. This is the one place tap would
   provision anything per-user on Yellow Card's side.
3. Show the returned `accountNumber` / `bankName` / `accountName` — the user
   pays into it from their own banking app, exactly like paying anyone else
   in Nigeria.
4. Yellow Card's webhook fires once the deposit is credited to that
   sub-wallet.
5. tap triggers **Submit Crypto Send Request** to move the equivalent USDC
   from Yellow Card's side to the user's real Universal Account address on
   Arbitrum.
6. From here, nothing about tap changes: the arrival shows up exactly like
   any other incoming transfer, because `getUnifiedBalance` polling doesn't
   know or care where a deposit came from. This is the payoff of the whole
   design — the rail is new, tap's own display logic isn't.

**Open question that gates step 5**: whether Yellow Card's Crypto Send can
target an arbitrary external address (the user's own Universal Account) or
only their own vault-managed addresses. Their Wallet Infrastructure Guide
describes both a "customer receive address" model and inter-vault sweeps,
but this needs a direct confirmation once there's a contact — it's the one
assumption everything else in Flow 2 rests on.

---

## New surface this needs (none of it built yet)

- **`lib/server/kv.ts`** — extend with a `ramp:*` namespace: create/get/update
  a ramp transaction record keyed by owner address + Yellow Card's
  `sequenceId`, plus a lookup for "does this address already have a virtual
  account." Same file, new durability bar (see above) — everything else in
  it stays best-effort.
- **`lib/server/yellowcard.ts`** (new, `server-only`, API keys never reach
  the browser) — a thin typed wrapper around the endpoints above. Not
  written yet on purpose: writing real request/response shapes against
  undocumented edge cases before sandbox access exists means guessing, and
  guessing wrong here means guessing wrong about real money.
- **`app/api/ramp/deposit`, `app/api/ramp/withdraw`, `app/api/ramp/status`**
  — new routes following the existing `app/api/push/route.ts` shape:
  validate input (`lib/server/validate.ts`), rate-limit
  (`checkRateLimit`), thin pass-through to `lib/server/yellowcard.ts`.
- **`app/api/webhooks/yellowcard`** (new) — verifies Yellow Card's webhook
  signature (exact scheme to confirm from their Webhooks doc once we have
  keys), updates the durable ramp record, and for deposits, triggers the
  Crypto Send onward.
- **`lib/ramp.ts`** (new, client-side) — fetch wrappers the UI calls,
  mirroring how `lib/stats.ts` and `lib/referrals.ts` are the client
  counterparts to their API routes.
- **UI**: give the "Bank transfer" rail its own phase sub-flow in both
  screens, reusing the exact phase-machine pattern `app/withdraw/page.tsx`
  already uses for the crypto-address rail (`method → address → amount →
  sending → sent/error`) rather than inventing a new one.

---

## Security and compliance boundaries

- Yellow Card owns KYC/AML for the fiat leg — that's the entire point of
  partnering instead of building it. tap's job is the API calls and the UX.
- **Address-ownership binding is a bigger deal here than anywhere else in
  tap.** Every other server-side write today (`push:sub:*`, referral codes)
  takes a client-asserted `ownerAddress` at low stakes — worst case is a
  wasted notification. A ramp transaction ties real fiat to an address, so
  a client-asserted address isn't good enough on its own. Worth requiring a
  signed message proving control of the address before creating a virtual
  account for it — tap's signer already supports arbitrary message signing
  (`magicUaSigner()` / `walletUaSigner()` in `lib/links.ts`), so this is a
  new call, not new infrastructure.
- Webhook requests must be signature-verified before anything in the
  durable record is trusted — exact mechanism TBD from their docs.
- Same `checkRateLimit` pattern as every other endpoint.

---

## Phasing

1. **Now**: this document. No code.
2. **Once sandbox keys exist**: Flow 1 (withdraw) only, behind a feature
   flag — it's the simpler direction and has no webhook-triggered outbound
   transfer to get wrong.
3. **Next**: Flow 2 (deposit), once the Crypto-Send-to-arbitrary-address
   question above is confirmed.
4. **Later**: parameterize country/currency instead of hardcoding Nigeria —
   Yellow Card covers 20 countries, and the design above doesn't assume NGN
   anywhere except the Resolve Bank Account requirement, which their docs
   say is Nigeria-specific by nature, not a limitation tap is imposing.

## Open questions for the first call with Yellow Card

- Can Crypto Send target an arbitrary external address, or only vault-
  managed ones?
- Cost/limits of provisioning one virtual account per end user, at scale.
- Exact webhook signature scheme.
- Realistic minimum volume expectations for onboarding as a small partner.
