import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import { verify, sharePayload } from "@/lib/sign";
import { ALL_GAMES, GAME_LABELS, GAME_GLYPHS, type GameId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ game: string }> }) {
  const { game } = await ctx.params;
  if (!ALL_GAMES.includes(game as GameId)) {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Bad request", { status: 400 });

  const rec = await store().getShare(id);
  if (!rec || rec.gameId !== game) return new Response("Not found", { status: 404 });

  // Verify HMAC matches the canonical payload — defense against tampered query strings.
  const payload = sharePayload({
    gameId: rec.gameId as GameId,
    date: rec.date,
    handle: rec.handle,
    discriminator: rec.discriminator,
    score: rec.score,
    shareId: rec.id,
  });
  const valid = await verify(payload, rec.signature);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0b10",
          color: "#f3f0e6",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          justifyContent: "space-between",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          backgroundImage:
            "radial-gradient(circle at 80% -20%, rgba(212,255,58,0.15), transparent 50%), repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 4px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: "#d4ff3a",
            color: "#0a0b10", fontSize: 36, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>▣</div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>
            DAILY <span style={{ color: "#d4ff3a" }}>ARCADE</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 24, color: "#a3a191", letterSpacing: 4, textTransform: "uppercase", fontFamily: "ui-monospace, monospace" }}>
            {rec.date} · {GAME_LABELS[rec.gameId as GameId]}
          </div>
          <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>
            <span style={{ color: "#d4ff3a", fontSize: 90, marginRight: 16 }}>{GAME_GLYPHS[rec.gameId as GameId]}</span>
            {rec.handle}
            {rec.discriminator > 0 && (
              <span style={{ color: "#6f6e64" }}>#{String(rec.discriminator).padStart(2, "0")}</span>
            )}
          </div>
          <div style={{ fontSize: 36, color: "#a3a191" }}>scored</div>
          <div style={{ fontSize: 180, fontWeight: 800, color: "#d4ff3a", lineHeight: 1 }}>{rec.score}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", color: "#6f6e64", fontFamily: "ui-monospace, monospace", fontSize: 22 }}>
          <span>same puzzle for everyone — daily-arcade.vercel.app</span>
          <span>resets 00:00 utc</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
