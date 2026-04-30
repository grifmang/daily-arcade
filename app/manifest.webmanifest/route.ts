import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      name: "Daily Arcade",
      short_name: "Arcade",
      description: "Three small games. One streak. Every day.",
      start_url: "/",
      display: "standalone",
      orientation: "portrait",
      theme_color: "#0a0b10",
      background_color: "#0a0b10",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
