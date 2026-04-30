"use client";
import * as React from "react";
import { Copy, Share2, ExternalLink, Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";
import { GAME_GLYPHS, GAME_LABELS, type GameId } from "@/lib/types";
import Link from "next/link";

interface Props {
  gameId: GameId;
  date: string;
  shareGrid: string;
  score: number;
  shareUrl: string | null;
  rank: number | null;
  total: number | null;
  handle: string | null;
  discriminator: number | null;
}

function buildShareText(opts: Props, fullUrl: string | null): string {
  const head = `${GAME_GLYPHS[opts.gameId]} ${GAME_LABELS[opts.gameId]} — ${opts.date}`;
  const grid = opts.shareGrid;
  const tail = fullUrl ? `\n${fullUrl}` : "";
  return `${head}\n${grid}${tail}`;
}

export function ShareResult(props: Props) {
  const { push } = useToast();
  const [siteUrl, setSiteUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (props.shareUrl) {
      setSiteUrl(`${window.location.origin}${props.shareUrl}`);
    }
  }, [props.shareUrl]);

  const text = buildShareText(props, siteUrl);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      push("Copied your grid", "success");
    } catch {
      push("Couldn't copy. Long-press the grid and copy manually.", "error");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: `${GAME_LABELS[props.gameId]} — Daily Arcade`,
          text,
          url: siteUrl ?? undefined,
        });
        return;
      } catch { /* user cancelled or blocked; fall through to copy */ }
    }
    copy();
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-strong)] bg-[var(--color-bg-elevated)] p-5 sm:p-6 space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)]">your result</div>
          <div className="font-display text-2xl sm:text-3xl font-semibold mt-1">
            {props.handle ? (
              <>
                {props.handle}
                {props.discriminator != null && (
                  <span className="text-[var(--color-fg-dim)]">#{String(props.discriminator).padStart(2, "0")}</span>
                )}
              </>
            ) : (
              <span className="text-[var(--color-fg-muted)]">guest</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-fg-dim)]">score</div>
          <div className="font-display text-3xl sm:text-4xl font-bold tabular-nums text-[var(--color-accent)]">{props.score}</div>
        </div>
      </div>

      <pre
        className="whitespace-pre-wrap font-mono text-base sm:text-lg leading-tight text-[var(--color-fg)] select-all"
        aria-label="Shareable grid"
      >
        {props.shareGrid}
      </pre>

      {props.rank != null && props.total != null && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] font-mono">
          <Trophy className="w-4 h-4 text-[var(--color-amber)]" aria-hidden />
          rank {props.rank} of {props.total} today
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={share} className="flex-1" aria-label="Share your grid">
          <Share2 className="w-4 h-4" aria-hidden /> Share
        </Button>
        <Button variant="secondary" onClick={copy} className="flex-1" aria-label="Copy your grid">
          <Copy className="w-4 h-4" aria-hidden /> Copy
        </Button>
        {props.shareUrl && (
          <Button
            variant="outline"
            onClick={() => window.open(props.shareUrl!, "_blank")}
            className="flex-1"
          >
            <ExternalLink className="w-4 h-4" aria-hidden /> Open share page
          </Button>
        )}
      </div>

      <div className="pt-2 flex flex-wrap gap-2 text-sm">
        <Link href={`/leaderboard/${props.gameId}`} className="font-mono underline underline-offset-4 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
          today's leaderboard →
        </Link>
        <Link href="/" className="font-mono underline underline-offset-4 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] ml-auto">
          back to arcade
        </Link>
      </div>
    </div>
  );
}
