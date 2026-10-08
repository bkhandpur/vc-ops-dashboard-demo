"use client";
import { mutateDemo } from "@/lib/demo-mutation";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function DemoReset({ stateError }: { stateError?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>Sample as of Oct 8, 2026 · edits saved in this browser for 7 days</span>
      <button
        className="underline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const response = await mutateDemo(() => fetch("/api/demo/reset", { method: "POST" }));
            if (!response.ok) throw new Error();
            router.refresh();
            setError("");
          } catch {
            setError("Reset failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Reset demo
      </button>
      {(error || stateError) && <span role="alert">{error || stateError}</span>}
    </div>
  );
}
