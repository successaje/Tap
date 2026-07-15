import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Send money with a link. No wallets, no chains, no gas — just tap.";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tap-xyz.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "tap",
  description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "tap",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "tap — send money with a link",
    description,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "tap" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "tap — send money with a link",
    description,
    images: ["/api/og"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <SwRegister />
        <div className="phone-shell">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
