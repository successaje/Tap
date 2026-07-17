import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://tap-xyz.vercel.app";
const MAX_FIELD_LENGTH = 60;

const TITLES: Record<string, string> = {
  "received:link": "Received via link",
  "sent:link": "Sent via link",
  "sent:direct": "Direct payment",
  "sent:withdrawal": "Cash out",
  "reclaimed:link": "Reclaimed",
};

function row(label: string, value: string) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        padding: "14px 0",
        borderBottom: "1px solid #eef0f4",
        fontSize: 22,
      }}
    >
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span style={{ color: "#0f172a", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "sent").slice(0, 20);
  const kind = (searchParams.get("kind") || "direct").slice(0, 20);
  const amountRaw = Number(searchParams.get("a"));
  const amount = Number.isFinite(amountRaw) && amountRaw > 0 && amountRaw <= 1_000_000 ? amountRaw : 0;
  const counterparty = (searchParams.get("cp") || "Someone").slice(0, MAX_FIELD_LENGTH);
  const status = (searchParams.get("status") || "settled").slice(0, MAX_FIELD_LENGTH);
  const date = (searchParams.get("date") || "").slice(0, MAX_FIELD_LENGTH);
  const txId = (searchParams.get("tx") || "").slice(0, 40);

  const title = TITLES[`${type}:${kind}`] || "Transaction";
  const statusLabel =
    status === "awaiting-claim" ? "Awaiting claim" : status === "reclaimed" ? "Reclaimed" : "Completed";
  const isCredit = type === "received" || type === "reclaimed";

  return new ImageResponse(
    (
      <div
        style={{
          width: "900px",
          height: "1200px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#f8fafc",
          fontFamily: "sans-serif",
          padding: "70px 60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            background: "#ffffff",
            borderRadius: 32,
            padding: "56px 48px",
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (edge Satori renderer), not a DOM <img>. */}
          <img
            src={`${SITE_ORIGIN}/icons/icon-192.png`}
            width={64}
            height={64}
            style={{ borderRadius: 16 }}
            alt=""
          />
          <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#64748b", fontWeight: 600 }}>
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 72,
              fontWeight: 700,
              color: isCredit ? "#16a34a" : "#0f172a",
              letterSpacing: "-0.03em",
            }}
          >
            {isCredit ? "+" : "-"}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 16,
              fontSize: 20,
              fontWeight: 600,
              color: "#16a34a",
              background: "#f0fdf4",
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {statusLabel}
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 48 }}>
            {row(type === "received" || type === "reclaimed" ? "From" : "To", counterparty)}
            {date ? row("Date", date) : null}
            {txId ? row("Reference", `${txId.slice(0, 14)}…`) : null}
            {row("Network", "Arbitrum")}
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 40, fontSize: 22, fontWeight: 600, color: "#2563eb" }}>
          tap
        </div>
      </div>
    ),
    { width: 900, height: 1200 }
  );
}
