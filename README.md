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
Particle **Universal Account in EIP-7702 mode**.

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
  Account transaction the EOA signs.
- **Arbitrum** is the invisible settlement layer. Transfers land as USDC on
  Arbitrum One; the SDK sources liquidity from wherever the sender holds value,
  so nobody needs gas or assets on Arbitrum — or even knows it's involved.

### Every link is a wallet

Creating a link generates a throwaway keypair and **really funds it** from the
sender's Universal Account. The claim key rides in the URL **fragment**
(`/t/abc#k=0x…`) — fragments never reach a server, so only the person holding
the link can open it. Claiming wraps a Universal Account around that key and
sweeps the balance to the recipient; **fees come out of the swept funds**, so
the recipient needs zero gas on any chain.

> **On prior art — we're honest about this.** The link-is-a-wallet mechanic was
> pioneered by [Peanut Protocol](https://peanut.to) (and TipLink on Solana).
> We didn't invent claim links. What tap adds is the entire chain-abstraction
> layer on top: Google login instead of a wallet, **one balance instead of
> per-chain balances**, and invisible Arbitrum settlement. Peanut proved links
> work for crypto users; tap removes the crypto.

## What you can do

| Surface | What it does |
|---|---|
| **Claim** (`/t/[id]`) | The hero flow. See who sent what → sign in → tap → ripple-from-touch → count-up landing. Handles already-claimed / reclaimed / invalid as designed states. |
| **Home** | One balance, one number ("N chains underneath"). Activity feed with on-chain receipts. Send / Request. |
| **Send** | Fund a claim link, or pay an address directly. Live "available" balance, real cross-chain transfer with progress. |
| **Request / Pay** | Generate a fixed or open-amount request (link **+ QR**); the payer sees who's asking and pays from their one balance. |
| **Settings** | Deposit address, **reclaim** outstanding links, the no-seed-phrase recovery story. |
| **Onboarding** | First-run "you've got a tap account" welcome after sign-in. |

Every screen is spring-animated (Framer Motion), mobile-first at 390px, and
installable as a PWA — no browser chrome, home-screen icon, offline shell.

## Track alignment

| Requirement | How tap meets it |
|---|---|
| **Universal Accounts SDK in EIP-7702 mode** | `useEIP7702: true`; the Magic EOA becomes the Universal Account in place ([`lib/particle.ts`](lib/particle.ts)) |
| **≥1 cross-chain value op via UA** | Two, on real mainnet: **link funding** and **direct pay**, both settling on Arbitrum |
| **Functional demo** | Runs locally; deployed on Vercel |
| **Arbitrum bonus** — settlement behind the scenes | Every transfer lands as USDC on Arbitrum One; user never sees a chain |
| **Magic bonus** — best onboarding | Google login → embedded wallet → first-run welcome, zero wallet setup |

Judging weights the main track cares about: **UX (40%)** — a relentlessly
polished, walletless consumer flow; **UA + EIP-7702 (30%)** — the account model
*is* the product, not a bolt-on; **adoption (20%)** — a payments app people
could actually use, with the trust surfaces (reclaim, receipts, recovery) that
crypto payment apps usually skip; **polish (10%)** — spring physics, haptics,
PWA, edge states.

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys below
pnpm dev                     # http://localhost:3000
```

**Environment** (all client-side; `.env.local` is gitignored):

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_MAGIC_API_KEY` | [dashboard.magic.link](https://dashboard.magic.link) → Publishable API Key (`pk_…`). Enable Google login; allow `<origin>/callback` as a redirect URL. |
| `NEXT_PUBLIC_PARTICLE_PROJECT_ID` | [dashboard.particle.network](https://dashboard.particle.network) → your project |
| `NEXT_PUBLIC_PARTICLE_CLIENT_KEY` | same project |
| `NEXT_PUBLIC_PARTICLE_APP_ID` | the Web app inside that project |

> Without keys, the app still runs end-to-end on mock data — the whole flow is
> demoable offline, and each SDK activates the moment its keys are present.

## Deploy (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new) (framework
   auto-detects as Next.js — no config needed).
2. Add the four `NEXT_PUBLIC_*` vars above in **Settings → Environment
   Variables**.
3. After the first deploy, add your production URL + `/callback` to the **Magic**
   dashboard redirect allowlist, and your production origin to the **Particle**
   app's allowed origins.

## Tech

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Framer Motion · Magic (`magic-sdk` + `@magic-ext/oauth2`) · Particle
(`@particle-network/universal-account-sdk`) · ethers v6 · PWA (manifest +
service worker).

---

<div align="center"><sub>Built during UXmaxx. The crypto is invisible. The money is serious.</sub></div>
