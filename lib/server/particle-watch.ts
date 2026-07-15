// Server-side Particle balance check, used only by the background claim
// watcher (app/api/cron/check-claims). Deliberately separate from
// lib/particle.ts: that file is a client bundle (dynamic-imports the SDK to
// keep it out of the initial page weight, and no-ops on the server on
// purpose). An API route has no bundle-size concern and no "am I in a
// browser" ambiguity, so this imports the SDK directly.
import "server-only";
import {
  UniversalAccount,
  UNIVERSAL_ACCOUNT_VERSION,
} from "@particle-network/universal-account-sdk";

const PROJECT_ID = process.env.NEXT_PUBLIC_PARTICLE_PROJECT_ID;
const CLIENT_KEY = process.env.NEXT_PUBLIC_PARTICLE_CLIENT_KEY;
const APP_ID = process.env.NEXT_PUBLIC_PARTICLE_APP_ID;

export const particleServerEnabled = !!(PROJECT_ID && CLIENT_KEY && APP_ID);

/** Live USD balance for an address's Universal Account, or null on failure. */
export async function getServerBalanceUsd(
  ownerAddress: string
): Promise<number | null> {
  if (!particleServerEnabled) return null;
  try {
    const ua = new UniversalAccount({
      projectId: PROJECT_ID!,
      projectClientKey: CLIENT_KEY!,
      projectAppUuid: APP_ID!,
      smartAccountOptions: {
        useEIP7702: true,
        name: "UNIVERSAL",
        version: UNIVERSAL_ACCOUNT_VERSION,
        ownerAddress,
      },
    });
    const primary = await ua.getPrimaryAssets();
    return Number(primary.totalAmountInUSD ?? 0);
  } catch (err) {
    console.error("[tap:cron] balance check failed for", ownerAddress, err);
    return null;
  }
}
