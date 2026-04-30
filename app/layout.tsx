import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0b10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://daily-arcade.vercel.app"),
  title: {
    default: "Daily Arcade — three games. one streak. every day.",
    template: "%s — Daily Arcade",
  },
  description:
    "A daily arcade of three small, addictive games. Word Volley, Drift 2049, Snap Trivia. Same puzzle for everyone every day. Share your grid.",
  applicationName: "Daily Arcade",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Daily Arcade",
  },
  openGraph: {
    title: "Daily Arcade",
    description: "Three small games. One streak. Every day.",
    type: "website",
    siteName: "Daily Arcade",
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-arcade-grid">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
