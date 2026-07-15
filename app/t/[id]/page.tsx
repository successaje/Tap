import type { Metadata } from "next";
import { ClaimView } from "./claim-view";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; a?: string; n?: string }>;
}

/**
 * Server-rendered so link previews (iMessage, WhatsApp, Discord, X) show the
 * sender and amount instead of a bare URL. The claim key lives in the
 * fragment and never reaches the server — only `from`/`a`/`n` (query params)
 * are readable here, which is exactly what the preview needs and nothing
 * more sensitive.
 */
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { from, a, n } = await searchParams;
  const sender = from || "Someone";
  const amount = Number(a);
  const title = amount > 0 ? `${sender} sent you $${amount.toFixed(2)}` : "You've got a tap link";
  const description = n ? `"${n}" — tap to claim, sign in with Google.` : "Tap to claim, sign in with Google, and it lands in seconds.";

  const ogParams = new URLSearchParams();
  if (from) ogParams.set("from", from);
  if (a) ogParams.set("a", a);
  if (n) ogParams.set("n", n);
  const ogImage = `/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ClaimPage({ params }: PageProps) {
  const { id } = await params;
  return <ClaimView id={id} />;
}
