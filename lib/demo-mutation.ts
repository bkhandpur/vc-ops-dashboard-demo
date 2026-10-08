/** Serialize cookie writes in this tab and, where supported, across tabs. */
let pending: Promise<unknown> = Promise.resolve();
export function mutateDemo<T>(action: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> =>
    typeof navigator !== "undefined" && navigator.locks
      ? await navigator.locks.request("vc-demo-mutation", action)
      : await action();
  const next = pending.then(run, run);
  pending = next.catch(() => undefined);
  return next;
}
