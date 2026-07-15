#!/usr/bin/env node
// Standalone x402 demo agent — no dependency on Next, no human in the loop.
// Run: node scripts/agent-demo.mjs
//
// First run (no funded key yet) prints a fresh address and stops so you can
// fund it a few cents via tap's own Send screen — pay it like any other
// recipient. Every run after that pays for and prints the demo resource.
//
// Env vars (same Particle project as the app; see .env.local — loaded
// automatically below, Next-style, since plain `node` doesn't do that):
//   NEXT_PUBLIC_PARTICLE_PROJECT_ID / _CLIENT_KEY / _APP_ID
//   AGENT_DEMO_PRIVATE_KEY   — the agent's own EOA (not your Magic login)
//   AGENT_DEMO_BASE_URL      — default http://localhost:3000

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Wallet, Signature, getBytes } from "ethers";
import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
  CHAIN_ID,
} from "@particle-network/universal-account-sdk";

function loadEnvLocal() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  let text;
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return; // no .env.local — rely on whatever's already in the shell
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const PROJECT_ID = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
const CLIENT_KEY = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;
const APP_ID = process.env.NEXT_PUBLIC_PARTICLE_APP_ID;
const BASE_URL = process.env.AGENT_DEMO_BASE_URL || "http://localhost:3000";
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

function log(step, msg) {
  console.log(`[agent] ${step ? `${step}: ` : ""}${msg}`);
}

if (!PROJECT_ID || !CLIENT_KEY || !APP_ID) {
  console.error("Missing NEXT_PUBLIC_PARTICLE_* env vars — copy them from .env.local into this shell.");
  process.exit(1);
}

let privateKey = process.env.AGENT_DEMO_PRIVATE_KEY;
if (!privateKey) {
  const fresh = Wallet.createRandom();
  console.log("\nNo AGENT_DEMO_PRIVATE_KEY set — generated a new agent identity:\n");
  console.log(`  address:     ${fresh.address}`);
  console.log(`  private key: ${fresh.privateKey}\n`);
  console.log("Fund it a few cents (e.g. $0.10) via tap's Send screen — paste the");
  console.log("address above as the recipient, same as sending to any address.");
  console.log("Then re-run with:\n");
  console.log(`  AGENT_DEMO_PRIVATE_KEY=${fresh.privateKey} node scripts/agent-demo.mjs\n`);
  process.exit(0);
}

async function payOnArbitrum(wallet, receiver, amountUsd) {
  const ua = new UniversalAccount({
    projectId: PROJECT_ID,
    projectClientKey: CLIENT_KEY,
    projectAppUuid: APP_ID,
    smartAccountOptions: {
      useEIP7702: true,
      name: "UNIVERSAL",
      version: UNIVERSAL_ACCOUNT_VERSION,
      ownerAddress: wallet.address,
    },
    tradeConfig: { slippageBps: 100 },
  });

  const tx = await ua.createTransferTransaction({
    token: { chainId: CHAIN_ID.ARBITRUM_MAINNET_ONE, address: USDC_ARBITRUM },
    amount: amountUsd.toFixed(2),
    receiver,
  });

  const authorizations = [];
  const authCache = new Map();
  for (const op of tx.userOps ?? []) {
    if (!op.eip7702Auth || op.eip7702Delegated) continue;
    const key = `${op.eip7702Auth.chainId}:${op.eip7702Auth.nonce}`;
    let sig = authCache.get(key);
    if (!sig) {
      const auth = await wallet.authorize({
        address: op.eip7702Auth.address,
        chainId: Number(op.eip7702Auth.chainId),
        nonce: Number(op.eip7702Auth.nonce),
      });
      sig = Signature.from(auth.signature).serialized;
      authCache.set(key, sig);
    }
    authorizations.push({ userOpHash: op.userOpHash, signature: sig });
  }

  const signature = await wallet.signMessage(getBytes(tx.rootHash));
  const result = await ua.sendTransaction(tx, signature, authorizations);
  return result.transactionId;
}

async function main() {
  const wallet = new Wallet(privateKey);
  log("identity", wallet.address);

  log("request", `GET ${BASE_URL}/api/agent/resource (no payment attached)`);
  const first = await fetch(`${BASE_URL}/api/agent/resource`);
  if (first.status !== 402) {
    console.error(`Expected 402, got ${first.status}:`, await first.text());
    process.exit(1);
  }
  const challenge = await first.json();
  log("402", `price $${challenge.price.amount} ${challenge.price.currency} on ${challenge.chain} → ${challenge.receiver}`);

  log("pay", `sending $${challenge.price.amount} USDC on Arbitrum…`);
  const transactionId = await payOnArbitrum(wallet, challenge.receiver, Number(challenge.price.amount));
  log("paid", `tx ${transactionId}`);

  for (let attempt = 1; attempt <= 6; attempt++) {
    log("retry", `attempt ${attempt} — GET with proof attached`);
    const res = await fetch(`${BASE_URL}/api/agent/resource`, {
      headers: { "X-Payment-Id": challenge.challengeId, "X-Payment-Tx": transactionId },
    });
    const body = await res.json();
    if (res.status === 200) {
      console.log("\n200 — payment verified, resource released:\n");
      console.log(JSON.stringify(body, null, 2));
      return;
    }
    if (res.status === 402 && body.error === "PAYMENT_NOT_CONFIRMED") {
      log("wait", "not confirmed yet, retrying in 3s…");
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    console.error(`Unexpected response ${res.status}:`, body);
    process.exit(1);
  }
  console.error("Gave up waiting for payment confirmation.");
  process.exit(1);
}

main().catch((err) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});
