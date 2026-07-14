<div align="center">
  <img src="public/brand/tap-logo-light.svg" alt="tap" height="72" />
  <h1>tap — send money with a link. no chains, no wallets, no idea it's crypto.</h1>
  <p><em>Consumer-simple on the surface. Chain-abstracted underneath.</em></p>
</div>

---

**tap** turns an onchain payment into a link. You create one, share it, and the
recipient taps it, signs in with Google, and the money lands — no wallet, no
seed phrase, no gas, no idea which chain it's on. It feels like sending a text.

Built for the **UXmaxx Hackathon** (Encode × Particle Network).

> **Live demo:** _<add your Vercel URL here after deploy>_
> **Walkthrough:** open the link on your phone → tap to claim → sign in with Google → watch it land.

## The magic moment

A recipient opens a tap link and sees **“Maya sent you $42.50.”** They tap once,
sign in with Google, and the amount counts up as it lands — settled on Arbitrum,
sourced from whatever chain the sender's money actually lived on. They never
picked a chain, approved a token, paid gas, or installed anything. That is the
whole pitch, and it is real: every transfer moves value cross-chain through a
Particle **Universal Account in EIP-7702 mode**, with real USDC, on Arbitrum
mainnet, proven end-to-end during development — not a testnet simulation.

## "Isn't this just Peanut?"

Say it before a judge does. **Functionally, tap and [Peanut Protocol](https://peanut.to)
sit in the same category** — link-based crypto payments, claim-and-go, no wallet
required on the receiving end. Peanut got there first, is deployed across 30+
chains, and is a featured project in Arbitrum's own ecosystem. We're not going
to pretend otherwise, and we're not going to out-build years of protocol
hardening in a hackathon sprint.

Here's the honest difference, and it's architectural, not cosmetic:

|  | Peanut | tap |
|---|---|---|
| **What "owns" the money in transit** | A deposit contract per link. Whoever holds the URL can attempt to withdraw — a bearer secret. | A **Universal Account minted from your identity**. The claim key in the URL is necessary but not sufficient — the sweep only executes after Google sign-in through Magic. |
| **What the recipient's wallet *is*** | A separate protocol account/vault. | **Their own EOA**, upgraded in place via **EIP-7702** — no new address, no migration, ever. |
| **Recovery model** | Standard wallet-connect assumptions — lose the link before claiming, the money's stuck until the sender reclaims it. | Same reclaim safety net, *plus* the recipient's account is tied to their Google identity forever, not a device or a link. |
| **Core technical bet** | General-purpose cross-chain payment protocol. | A specific, narrow claim: **EIP-7702 + Universal Accounts make the wallet disappear entirely** — which is exactly what this hackathon's main track (30% of score) is judging. |

Peanut proved link-based payments work. tap asks a narrower question: *what
does that experience look like when the wallet isn't a separate protocol
account, but your own EOA, invisibly upgraded via EIP-7702?* We're not
competing with Peanut's breadth — we're going deeper on the one mechanic the
sponsor cares about most, and being honest that we're standing on the
category Peanut validated.

*(For where this product goes next — including an application layer that
sidesteps this comparison entirely — see [`FUTURE.md`](FUTURE.md).)*

## How the invisible part works

Three pieces of infrastructure, each doing exactly one job, none of them visible
to the user:

```
Google login ──▶ Magic embedded wallet ──▶ Particle Universal Account ──▶ Arbitrum
 (identity)         (an EOA, no seed)        (EIP-7702, one balance)      (settlement)
```

- **Magic** turns a Google sign-in into an EOA. No seed phrase, no extension.
  The user's identity *is* their key — lose your phone, sign in anywhere, your
  money follows you.
- **Particle Universal Accounts (EIP-7702)** upgrade that EOA *in place* into a
  chain-abstracted account. One address, one balance pooled across every chain,
  no smart-account deployment, no migration. This is the core of the app — the
  balance you see is `getPrimaryAssets()`, and every payment is a Universal
  Account transaction the EOA signs — **including the EIP-7702 delegation
  authorization itself**, signed headlessly via
  `magic.wallet.sign7702Authorization()` on a user's very first transaction.
- **Arbitrum** is the invisible settlement layer. Transfers land as USDC on
  Arbitrum One; the SDK sources liquidity from wherever the sender holds value,
  so nobody needs gas or assets on Arbitrum — or even knows it's involved.

### Every link is a wallet

Creating a link generates a throwaway keypair and **really funds it** from the
sender's Universal Account. The claim key rides in the URL **fragment**
(`/t/abc#k=0x…`) — fragments never reach a server, so only the person holding
the link can open it. Claiming wraps a Universal Account around that key and
sweeps the balance to the recipient; **fees come out of the swept funds**, so
the recipient needs zero gas on any chain. Unclaimed links can be pulled back
by the sender at any time (**Profile → Outstanding links → Reclaim**) — the
same sweep mechanic, run by the sender instead of the recipient.

## What you can do

| Surface | Route | What it does |
|---|---|---|
| **Landing** | `/` | Real welcome + Google sign-in for new visitors. The demo claim below is an opt-in ("See how claiming works"), never the front door — it must never be mistaken for a real payment. |
| **Claim** | `/t/[id]` | The hero flow. See who sent what → sign in → tap → ripple-from-touch → count-up landing, settled on Arbitrum in real time. Handles already-claimed / reclaimed / invalid as designed states, not raw errors. |
| **Home** | `/` (signed in) | One balance, one number ("N chains underneath"). Activity feed with on-chain receipts, live claim detection ("your link was claimed 🎉"). |
| **Send** | `/send` | Fund a claim link with a real cross-chain transfer. Live available balance, working Send-max, QR + copyable link. |
| **Request / Pay** | `/request`, `/pay` | Generate a fixed- or open-amount request (link + QR); the payer sees who's asking and pays straight from their one balance. |
| **Cash out** | `/withdraw` | Send USDC to **any address** on Arbitrum — the self-custodial off-ramp. Bank transfer / debit card are honestly labeled "Soon," not faked. |
| **Scan** | `/scan` | A real camera QR scanner (`BarcodeDetector`) that reads tap codes and routes straight into pay/claim — with a graceful "paste a link" fallback when no camera is available. |
| **Profile** | `/profile` | Deposit address, **reclaim** outstanding links, push-notification opt-in, the no-seed-phrase recovery story, Pro Mode (raw address + the EIP-7702 explainer, for the curious). |
| **Rewards** | `/rewards` | Points and tier derived from **real activity volume** — no fabricated social proof. |
| **Onboarding** | — | First-run "you've got a tap account" welcome after sign-in, with the same three-line pitch this README opens with. |

Every screen is spring-animated (Framer Motion), mobile-first at 390px, and
installable as a PWA — no browser chrome, home-screen icon, offline shell,
self-updating service worker.

## What's real vs. what's a preview

We'd rather a judge read this table than discover it by clicking. Everything
not explicitly marked "Preview" moves real money on Arbitrum mainnet.

| Feature | Status |
|---|---|
| Link funding, claiming, reclaiming | **Real.** Verified end-to-end with live USDC. |
| Direct pay (`/pay`) and cash-out to any address (`/withdraw`) | **Real.** Same Universal Account + EIP-7702 path. |
| Unified balance, activity ledger, claim detection | **Real**, read from the chain — polled client-side (see *Architecture* below for what that means). |
| Bank transfer / debit card cash-out | **Preview.** Explicitly labeled "Soon" in the UI — no fake account numbers, no simulated ACH flow. |
| Push notifications | **Real** delivery (Web Push + VAPID), but **client-triggered** — see *Architecture*. |
| Rewards points | **Real**, computed from your own activity volume. |
| Referral *tracking* (who joined via your link) | **Not built.** Removed a fabricated version of this rather than ship fake social proof — see *Architecture* for what real tracking would need. |

## Architecture: what's on-chain, on-device, and what would need a backend

**There is no backend and no database.** Every piece of state lives in one of
two places:

- **The blockchain**, via Particle's Universal Account API — balances,
  transfer status, and claim detection (we poll a link's on-chain balance;
  empty means someone swept it) are always asked for live, never cached as
  truth.
- **`localStorage`, per device** — session, activity history, settings,
  outstanding-link keys (client-only, never transmitted).

That split is a deliberate, defensible hackathon scope — but it's worth being
precise about what it rules out, because "should we add a backend" has a
different answer for each of these:

- **Doesn't need one, ever:** balances, transfer success/failure, claim
  status. The chain already *is* the database for these.
- **Would need one for real, no shortcut:** activity history that follows you
  across devices (right now a new phone shows a correct balance but an empty
  history); referral attribution (a referrer's device fundamentally cannot
  observe what happens on the referee's device); **push notifications that
  fire while the app is closed** (today's push only fires from an open tab
  that happens to poll and notice a claim — a true "you got paid" push needs
  a server watching the chain); global product metrics ("$X moved through
  tap" across all users).

We scoped the backend out on purpose to keep the hackathon build honest and
finishable. The single highest-leverage addition post-hackathon is a small
serverless watcher (Vercel Cron + a KV store for subscriptions) that turns the
already-built push infrastructure into true background notifications — see
[`FUTURE.md`](FUTURE.md) for the shape of that and other next steps.

## Track alignment

| Requirement | How tap meets it |
|---|---|
| **Universal Accounts SDK in EIP-7702 mode** | `useEIP7702: true`; the Magic EOA becomes the Universal Account in place, including signing its own delegation authorization ([`lib/particle.ts`](lib/particle.ts), [`lib/magic.ts`](lib/magic.ts)) |
| **≥1 cross-chain value op via UA** | Three, on real mainnet: **link funding**, **direct pay**, and **cash-out to any address**, all settling on Arbitrum |
| **Functional demo** | Runs locally; deployed on Vercel |
| **Arbitrum bonus** — settlement behind the scenes | Every transfer lands as USDC on Arbitrum One; user never sees a chain |
| **Magic bonus** — best onboarding | Google login → embedded wallet → first-run welcome, zero wallet setup |

Judging weights the main track cares about: **UX (40%)** — a relentlessly
polished, walletless consumer flow; **UA + EIP-7702 (30%)** — the account model
*is* the product, not a bolt-on; **adoption (20%)** — a payments app people
could actually use, with the trust surfaces (reclaim, receipts, recovery,
honest "Soon" labels) that crypto payment apps usually skip; **polish (10%)** —
spring physics, haptics, PWA, edge states.

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys below
pnpm dev                     # http://localhost:3000
```

**Environment** (`.env.local` is gitignored):

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_MAGIC_API_KEY` | [dashboard.magic.link](https://dashboard.magic.link) → Publishable API Key (`pk_…`). Enable Google login; allow `<origin>/callback` as a redirect URL. |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | [dashboard.particle.network](https://dashboard.particle.network) → your project |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | same project |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | the Web app inside that project |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | optional — generate with `npx web-push generate-vapid-keys`. Powers "your link was claimed" push. The public key ships to the client; the private key is server-only and must also be set in your Vercel project for production. |

> Without the Magic/Particle keys, the app still runs end-to-end on mock
> data — the whole flow is demoable offline, and each SDK activates the
> moment its keys are present. A malformed VAPID key degrades push
> gracefully; it can't take down the app.

## Deploy (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new) (framework
   auto-detects as Next.js — no config needed).
2. Add the env vars above in **Settings → Environment Variables**.
3. After the first deploy, add your production URL + `/callback` to the **Magic**
   dashboard redirect allowlist, and your production origin to the **Particle**
   app's allowed origins.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Framer Motion · Magic (`magic-sdk` + `@magic-ext/oauth2`) · Particle
(`@particle-network/universal-account-sdk`) · ethers v6 · Web Push
(`web-push`) · PWA (manifest + self-updating service worker).

## What's next

See [`FUTURE.md`](FUTURE.md) for the post-hackathon roadmap, including an
application-layer concept (agent-to-agent payments on the same architecture)
that sidesteps the Peanut comparison entirely by targeting a different buyer.

---

<div align="center"><sub>Built during UXmaxx. The crypto is invisible. The money is serious.</sub></div>
