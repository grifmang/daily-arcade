"use client";

/**
 * Cloudflare Turnstile widget — vanilla JS API integration (no extra deps).
 *
 * Loads the Cloudflare api.js script once, renders the widget into a host
 * div, and surfaces the resulting token via `onVerify`. The parent owns
 * what happens when verification fails downstream (server-side reject) and
 * is expected to call `reset()` via the imperative ref to clear the widget
 * for retry.
 *
 * The site key is passed as a prop (not read from env here) because this
 * is a client component and `lib/env.ts` is server-only. See DECISIONS.md
 * ADR-1 (2026-04-30).
 */
import * as React from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetIdOrEl?: string | HTMLElement) => void;
      remove: (widgetIdOrEl?: string | HTMLElement) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Turnstile cannot load on the server."));
  }
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Turnstile script failed to load.")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = TURNSTILE_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile script failed to load."));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface Props {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export const TurnstileWidget = React.forwardRef<TurnstileWidgetHandle, Props>(
  function TurnstileWidget({ siteKey, onVerify, onError, onExpire }, ref) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const widgetIdRef = React.useRef<string | null>(null);
    // Ref-mirrored callbacks so we don't re-render the widget when parent re-renders.
    const onVerifyRef = React.useRef(onVerify);
    const onErrorRef = React.useRef(onError);
    const onExpireRef = React.useRef(onExpire);
    React.useEffect(() => {
      onVerifyRef.current = onVerify;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    });

    React.useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      }),
      [],
    );

    React.useEffect(() => {
      let cancelled = false;
      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => onVerifyRef.current(token),
            "error-callback": () => onErrorRef.current?.(),
            "expired-callback": () => onExpireRef.current?.(),
            "timeout-callback": () => onErrorRef.current?.(),
            theme: "auto",
            appearance: "interaction-only",
          });
        })
        .catch(() => onErrorRef.current?.());
      return () => {
        cancelled = true;
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore — widget may already be detached */
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey]);

    return (
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-testid="turnstile-widget"
      />
    );
  },
);
