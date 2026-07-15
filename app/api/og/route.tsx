import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

// Deliberately not derived from the request's Host header — an edge function
// trusting `new URL(req.url).origin` for a server-side fetch is a classic
// host-header-injection footgun. This always points at the real deployment.
const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://tap-xyz.vercel.app";

const MAX_FIELD_LENGTH = 60;
const MAX_NOTE_LENGTH = 140;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sender = (searchParams.get("from") || "Someone").slice(0, MAX_FIELD_LENGTH);
  const amountRaw = Number(searchParams.get("a"));
  const note = searchParams.get("n")?.slice(0, MAX_NOTE_LENGTH) || null;
  const hasAmount = Number.isFinite(amountRaw) && amountRaw > 0 && amountRaw <= 1_000_000;
  const amount = hasAmount
    ? amountRaw.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(160deg, #eef2ff 0%, #ffffff 55%, #eff6ff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "#2563eb",
            marginBottom: 40,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (edge Satori renderer), not a DOM <img>. */}
          <img
            src={`${SITE_ORIGIN}/icons/icon-192.png`}
            width={96}
            height={96}
            style={{ borderRadius: 24 }}
            alt=""
          />
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 600,
            color: "#64748b",
            marginBottom: 14,
          }}
        >
          {sender} sent you
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.03em",
          }}
        >
          {hasAmount ? `$${amount}` : "money"}
        </div>
        {note ? (
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              color: "#94a3b8",
              maxWidth: 900,
              textAlign: "center",
            }}
          >
            &ldquo;{note}&rdquo;
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 48,
            fontSize: 28,
            fontWeight: 600,
            color: "#2563eb",
          }}
        >
          tap · sign in with Google to claim
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
