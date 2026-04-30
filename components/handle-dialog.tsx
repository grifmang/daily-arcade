"use client";
import * as React from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TurnstileWidget, type TurnstileWidgetHandle } from "./turnstile-widget";

interface Props {
  open: boolean;
  initial?: string;
  /**
   * Cloudflare Turnstile site key. Read from env on the server (see
   * `lib/env.ts` `turnstileSiteKey`) and passed down through the page
   * shell + game client. In dev/preview, this is the Cloudflare always-pass
   * test key (`1x00000000000000000000AA`).
   */
  turnstileSiteKey: string;
  /**
   * Receives `(handle, turnstileToken)`. The Turnstile token is verified
   * server-side as the first step of `submitScore`; on a server-side
   * verification failure, the parent should call `resetTurnstile()` (see
   * imperative-handle pattern below) so the widget regenerates a fresh
   * token for retry.
   */
  onSubmit: (handle: string, turnstileToken: string) => Promise<void> | void;
  onCancel: () => void;
  busy?: boolean;
}

export interface HandleDialogHandle {
  /**
   * Reset the embedded Turnstile widget so the user can retry after a
   * server-side rejection (e.g. `timeout-or-duplicate` on a stale token).
   */
  resetTurnstile: () => void;
}

export const HandleDialog = React.forwardRef<HandleDialogHandle, Props>(
  function HandleDialog(
    { open, initial, turnstileSiteKey, onSubmit, onCancel, busy },
    ref,
  ) {
    const [value, setValue] = React.useState(initial ?? "");
    const [err, setErr] = React.useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
    const [turnstileFailed, setTurnstileFailed] = React.useState(false);
    const widgetRef = React.useRef<TurnstileWidgetHandle | null>(null);

    React.useEffect(() => {
      if (initial !== undefined) setValue(initial);
    }, [initial]);

    // When the dialog closes, drop the token so it can't be reused.
    React.useEffect(() => {
      if (!open) {
        setTurnstileToken(null);
        setTurnstileFailed(false);
      }
    }, [open]);

    React.useImperativeHandle(
      ref,
      () => ({
        resetTurnstile: () => {
          setTurnstileToken(null);
          widgetRef.current?.reset();
        },
      }),
      [],
    );

    function validate(v: string): string | null {
      const trimmed = v.trim();
      if (trimmed.length < 3) return "At least 3 characters.";
      if (trimmed.length > 12) return "12 characters or fewer.";
      if (!/^[A-Za-z0-9_]+$/.test(trimmed)) return "Letters, numbers, and underscores only.";
      return null;
    }

    const submitDisabled = !!busy || !turnstileToken;

    return (
      <Dialog
        open={open}
        onOpenChange={o => { if (!o) onCancel(); }}
        title="Pick a handle"
      >
        <p className="text-sm text-[var(--color-fg-muted)] mb-4">
          Your handle shows on the leaderboard and your share grid. No account needed.
          If someone else already used this handle today, you'll get a #number after it.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const reason = validate(value);
            if (reason) { setErr(reason); return; }
            if (!turnstileToken) {
              setErr("We couldn't verify this submission. Try again.");
              return;
            }
            setErr(null);
            await onSubmit(value.trim(), turnstileToken);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="handle-input" className="block text-xs uppercase tracking-widest text-[var(--color-fg-dim)] mb-1.5">handle</label>
            <Input
              id="handle-input"
              value={value}
              onChange={e => { setValue(e.target.value); if (err) setErr(null); }}
              maxLength={12}
              placeholder="GAMER"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-autofocus
              aria-invalid={!!err}
              aria-describedby={err ? "handle-err" : undefined}
            />
            {err && (
              <p id="handle-err" className="mt-2 text-sm text-[var(--color-bad)]" role="alert">
                {err}
              </p>
            )}
          </div>

          {/* Turnstile widget. Renders invisibly in the common case
              (appearance: interaction-only) and surfaces a challenge if the
              client looks bot-like. */}
          <div className="min-h-[1.5rem]" aria-live="polite">
            <TurnstileWidget
              ref={widgetRef}
              siteKey={turnstileSiteKey}
              onVerify={(token) => {
                setTurnstileToken(token);
                setTurnstileFailed(false);
              }}
              onError={() => {
                setTurnstileToken(null);
                setTurnstileFailed(true);
              }}
              onExpire={() => {
                setTurnstileToken(null);
              }}
            />
            {turnstileFailed && (
              <p className="mt-2 text-sm text-[var(--color-bad)]" role="alert">
                Couldn't verify your browser. Refresh and try again.
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={submitDisabled}>{busy ? "Submitting…" : "Submit"}</Button>
          </div>
        </form>
      </Dialog>
    );
  },
);
