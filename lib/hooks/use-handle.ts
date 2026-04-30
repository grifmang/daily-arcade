"use client";
import * as React from "react";

const KEY = "da:handle";

interface HandleStore {
  handle: string | null;
}

export function useHandle() {
  const [handle, setHandle] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HandleStore;
        if (parsed.handle) setHandle(parsed.handle);
      }
    } catch { /* ignore */ }
  }, []);
  const persist = React.useCallback((h: string) => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ handle: h } satisfies HandleStore)); } catch { /* */ }
    setHandle(h);
  }, []);
  return { handle, setHandle: persist };
}
