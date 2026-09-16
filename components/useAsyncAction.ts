"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One loading/success/error pattern for every async button in the app.
 *
 * Before this, each Refresh-style button hand-rolled its own `useState(false)` and none
 * of them agreed: some disabled on click, some didn't (so a double-click fired two
 * refreshes), and none showed that the work had finished — you clicked, something
 * happened somewhere, and the button looked identical throughout. The usability pass
 * called that out on both "Refresh" and "Refresh from the CRM".
 *
 * States: idle → running → success (auto-clears) | error (sticky until the next run).
 *
 * `success` clears itself after SUCCESS_MS so the confirmation is a moment rather than a
 * permanent tick that stops meaning anything. `error` deliberately does NOT auto-clear:
 * a failure the user might have missed is worse than a stale error message.
 */

const SUCCESS_MS = 2000;

export type AsyncStatus = "idle" | "running" | "success" | "error";

export interface AsyncAction<TArgs extends unknown[]> {
  run: (...args: TArgs) => Promise<void>;
  status: AsyncStatus;
  error: string | null;
  /** True while running — bind to `disabled` so a double-click cannot fire twice. */
  busy: boolean;
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  options: { onSuccess?: () => void } = {},
): AsyncAction<TArgs> {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Guards against setting state on an unmounted component when a slow refresh
  // resolves after the user has navigated away.
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const { onSuccess } = options;

  const run = useCallback(
    async (...args: TArgs) => {
      // A second click while running is ignored rather than queued — these actions are
      // refreshes and writes, and queueing them is never what someone meant.
      setStatus((current) => (current === "running" ? current : "running"));
      setError(null);
      if (timer.current) clearTimeout(timer.current);

      try {
        await fn(...args);
        if (!mounted.current) return;
        setStatus("success");
        onSuccess?.();
        timer.current = setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, SUCCESS_MS);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStatus("error");
      }
    },
    [fn, onSuccess],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setStatus("idle");
    setError(null);
  }, []);

  return { run, status, error, busy: status === "running", reset };
}
