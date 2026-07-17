<div align="center">
  <img src="public/brand/tap-logo-light.svg" alt="tap" height="72" />
  <h1>tap — send money with a link. no chains, no wallets, no idea it's crypto.</h1>
  <p><em>Consumer-simple on the surface. Chain-abstracted underneath.</em></p>
</div>

---

**tap** turns an onchain payment into a link. Create one, share it, and the
recipient taps it, signs in with Google, and the money lands — no wallet, no
seed phrase, no gas, no visible chain. It feels like sending a text.

Built for the **UXmaxx Hackathon** (Encode × Particle Network).

> **Live demo:** [tap-xyz.vercel.app](https://tap-xyz.vercel.app/)
> **Walkthrough:** open the link on your phone → tap to claim → sign in with Google → watch it land.

## The core experience

A recipient opens a tap link and sees **"Maya sent you $42.50."** One tap,
Google sign-in, and the amount counts up as it lands — settled on Arbitrum,
sourced from whatever chain the sender's money actually lived on. No chain
selection, no token approval, no gas, no wallet install. Every transfer moves
value cross-chain through a Particle **Universal Account in EIP-7702 mode**,
in real USDC, on Arbitrum mainnet — proven end-to-end during development, not
a testnet simulation.

## Positioning: tap vs. Peanut Protocol

[tap](https://tap-xyz.vercel.app) and [Peanut Protocol](https://peanut.to) address the same category:
link-based crypto transfer with no wallet required to receive. Peanut is the
more established project in this category — live across 30+ chains and
featured in Arbitrum's own ecosystem. The distinction between the two
products is architectural, not cosmetic.

|  | Peanut | tap |
|---|---|---|
| **Custody of funds in transit** | A deposit contract per link. Possession of the URL is sufficient to attempt a withdrawal — a bearer secret. | A Universal Account minted from identity. The claim key is necessary but not sufficient; the sweep executes only after Google sign-in through Magic. |
| **What the recipient's wallet is** | A separate protocol account. | The recipient's own EOA, upgraded in place via EIP-7702 — no new address, no migration. |
| **Recovery model** | Reclaim by the sender before the link is claimed. | Same reclaim mechanism, plus an account bound to Google identity rather than a device or a link. |
| **Core technical bet** | General-purpose cross-chain payment protocol. | EIP-7702 and Universal Accounts as the mechanism that removes the wallet from the payment experience entirely. |

Peanut established that link-based payments work at scale. tap is a focused
exploration of one question: what does that experience become when the
wallet is not a separate protocol account, but the user's own EOA, upgraded
invisibly via EIP-7702. Application-layer directions that build on the same
account architecture without sitting in the same product category are
outlined in [`FUTURE.md`](FUTURE.md).

## Architecture

Three components, each doing one job, none of them visible to the user:

```
Google login ──▶ Magic embedded wallet ──▶ Particle Universal Account ──▶ Arbitrum
 (identity)         (an EOA, no seed)        (EIP-7702, one balance)      (settlement)
```

- **Magic** converts a Google sign-in into an EOA. No seed phrase, no browser
  extension. Identity is the key — a new device with the same Google account
  has full access to the same funds.
- **Particle Universal Accounts (EIP-7702)** upgrade that EOA in place into a
  chain-abstracted account: one address, one balance pooled across every
  supported chain, no smart-account deployment, no migration. The balance
  shown in the app is read directly from `getPrimaryAssets()`, and every
  payment is a Universal Account transaction signed by the EOA — including
  the EIP-7702 delegation authorization itself, signed headlessly via
  `magic.wallet.sign7702Authorization()` on a user's first transaction.
- **Arbitrum** is the settlement layer. Transfers land as USDC on Arbitrum
  One; the SDK sources liquidity from wherever the sender holds value, so
  neither party needs gas or assets on Arbitrum specifically.

### Link mechanics

Creating a link generates a throwaway keypair and funds it directly from the
sender's Universal Account — a real transfer, not a database record. The
claim key travels in the URL **fragment** (`/t/abc#k=…`), which browsers
never send to a server, so only the holder of the full link can access it.
Claiming wraps a Universal Account around that key and sweeps the balance to
the recipient, with fees deducted from the swept amount — the recipient
never needs gas on any chain. Unclaimed links can be reclaimed by the sender
at any time (Profile → Outstanding links), using the same sweep mechanism in
reverse.

## Product surface

| Surface | Route | Description |
|---|---|---|
| Landing | `/` | Sign-in entry point for new visitors. A separate, explicitly-labeled walkthrough demonstrates the claim flow without being mistaken for a real payment. |
| Claim | `/t/[id]` | Recipient flow: see who sent what, sign in, tap to claim, watch it land in real time. Already-claimed, reclaimed, and invalid links each resolve to a designed state rather than a raw error. |
| Home | `/` (signed in) | Unified balance across chains, activity feed with on-chain receipts, live claim detection. |
| Send | `/send` | Create a funded claim link via a real cross-chain transfer, with live available balance and a QR/shareable link. |
| Request / Pay | `/request`, `/pay` | Fixed- or open-amount payment requests; the payer settles directly from their Universal Account balance. |
| Cash out | `/withdraw` | Send USDC to any address on Arbitrum — a self-custodial off-ramp. Bank transfer and debit card are marked "Soon." |
| Scan | `/scan` | Camera-based QR scanner (`BarcodeDetector`) that reads tap codes and routes directly into pay/claim, with a manual-entry fallback. |
| Profile | `/profile` | Deposit address, link reclaim, push-notification preferences, account recovery details, and an optional technical view of the underlying Universal Account. |
| Rewards | `/rewards` | Points and tier computed from the account's own transaction volume. |
| Onboarding | — | First-run introduction shown once, immediately after sign-in. |

Every screen uses spring-based motion (Framer Motion), is designed
mobile-first at 390px, and installs as a PWA with a self-updating service
worker.

## Feature status

| Feature | Status |
|---|---|
| Link funding, claiming, reclaiming | Live. Verified end-to-end with real USDC on Arbitrum mainnet. |
| Direct pay and cash-out to any address | Live. Same Universal Account and EIP-7702 path as link transfers. |
| Unified balance, activity feed, claim detection | Live, read directly from the chain. |
| Push notifications | Live, including background delivery while the app is closed (see *Backend and data* below). |
| Rewards points | Live — the account's own activity volume plus real referral bonuses. |
| Referral attribution | Live. A `?ref=` code is captured at first-run signup and the referrer credited on the referred account's first real send. |
| Bank transfer / debit card cash-out | Not built. Labeled "Soon" in the interface. |

## Backend and data

Application state lives in three places:

- **The blockchain**, via Particle's Universal Account API. Balances,
  transfer status, and claim detection (an emptied link balance indicates a
  completed claim) are read live and are never cached as the source of
  truth.
- **`localStorage`, per device.** Session, activity history, settings, and
  outstanding-link keys — client-only, never transmitted.
- **A small server-side store** (Upstash Redis), used for the handful of
  things that need a shared, cross-device source of truth:
  - **Background push.** When a real link is funded, its address and the
    sender's push subscription are registered; a scheduled job (Upstash
    QStash, every two minutes, request-signature verified) checks each
    outstanding link's balance and pushes "your link was claimed" the
    moment it empties, then stops watching it. Client-side detection (an
    open tab noticing the same thing) still fires instantly and is
    unaffected — this closes the gap for when no tab is open.
  - **Referral attribution.** A referrer's short code (derived from their
    own address) maps to that address; a `?ref=` code seen on landing is
    captured against a brand-new account exactly once, at the moment it
    finishes onboarding — never on a returning sign-in, so an existing
    account can't retroactively generate a referral. The referrer is
    credited once the referred account completes its first real send.
  - **Real usage numbers.** A running count and USD total per transaction
    kind, exposed at `/api/stats`, used to report genuine traction rather
    than an estimate.

  All of the above are best-effort: a failed write only costs a missed
  notification or an uncredited referral, never a broken transfer.

The only related feature still unbuilt is **activity history across
devices** — a new device currently shows the correct balance (read from the
chain) but an empty activity feed, since history itself is stored locally,
not in the store above. Scoped out in [`FUTURE.md`](FUTURE.md), along with
the full architecture of the background watcher and the x402 agent-payment
proof of concept.

## Track alignment

| Requirement | Implementation |
|---|---|
| Universal Accounts SDK in EIP-7702 mode | `useEIP7702: true`; the Magic-issued EOA becomes the Universal Account in place, including signing its own delegation authorization ([`lib/particle.ts`](lib/particle.ts), [`lib/magic.ts`](lib/magic.ts)). |
| At least one cross-chain value operation via UA | Three, on mainnet: link funding, direct pay, and cash-out to any address — all settling on Arbitrum. |
| Functional demo | Runs locally and is deployed on Vercel. |
| Arbitrum bounty — invisible settlement | Every transfer lands as USDC on Arbitrum One without the user selecting a chain. |
| Magic bounty — onboarding | Google login, embedded wallet creation, and first-run introduction with no wallet setup step. |

## Local development

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys below
pnpm dev                     # http://localhost:3000
```

**Environment variables** (`.env.local` is gitignored):

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_MAGIC_API_KEY` | [dashboard.magic.link](https://dashboard.magic.link) → Publishable API Key. Enable Google login and allow `<origin>/callback` as a redirect URL. |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | [dashboard.particle.network](https://dashboard.particle.network) → project. |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | Same project. |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | The web app registered inside that project. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Optional. Generate with `npx web-push generate-vapid-keys`. Enables claim-notification push. The private key is server-only and must also be set in the deployment environment. |

Without Magic and Particle keys configured, the application runs end-to-end
on mock data. Each integration activates independently once its keys are
present; an invalid or missing VAPID key disables push without affecting the
rest of the application.

## Deployment (Vercel)

1. Import the repository at [vercel.com/new](https://vercel.com/new) — the
   framework is auto-detected.
2. Add the environment variables above under **Settings → Environment
   Variables**.
3. After the first deploy, add the production origin plus `/callback` to the
   Magic dashboard's redirect allowlist, and the production origin to the
   Particle app's allowed origins.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Framer Motion · Magic (`magic-sdk`, `@magic-ext/oauth2`) · Particle
(`@particle-network/universal-account-sdk`) · ethers v6 · Web Push
(`web-push`) · PWA (manifest, self-updating service worker).

## Roadmap

[`FUTURE.md`](FUTURE.md) covers the backend work required to close the gaps
above, and three application-layer directions on the same account
architecture — group expense settlement, durable receive requests, and
agent-to-agent micropayments.

The last of those already has a working proof of concept in this repo:
[`app/api/agent/resource`](app/api/agent/resource/route.ts) issues a real
HTTP 402 with payment requirements, and [`scripts/agent-demo.mjs`](scripts/agent-demo.mjs)
is a standalone script — no browser, no human — that pays it in real USDC
on Arbitrum through the same Universal Account primitives as the rest of
the product, then retries with proof and receives the resource. It's a
proof of concept, not a finished payment gateway — see `FUTURE.md` for
exactly what's simplified and what a production version would need.

---

<div align="center"><sub>Built during UXmaxx.</sub></div>
