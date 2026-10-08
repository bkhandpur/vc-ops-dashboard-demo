"use client";
import { mutateDemo } from "@/lib/demo-mutation";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Callout, cx } from "../ui";

/**
 * First-run affordance. Page loads never call the CRM, so a brand-new deployment has no
 * snapshot — this is the one-click way to build it rather than telling the user to curl
 * an authenticated endpoint.
 */
export function BuildSnapshotButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const res = await mutateDemo(() => fetch("/api/stats/refresh", { method: "POST" }));
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || `Failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build the snapshot");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="primary" onClick={build} disabled={busy}>
        <RefreshCw className={cx("size-3.5", busy && "animate-spin")} />
        {busy ? "Fetching from the CRM…" : "Build the first snapshot"}
      </Button>
      {error && <Callout tone="error">{error}</Callout>}
    </div>
  );
}
