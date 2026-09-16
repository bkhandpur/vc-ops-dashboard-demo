import { DigestList } from "@/components/digest/DigestList";
import { ensureDigestHistory } from "@/lib/digest-history";

export const metadata = { title: "Weekly Digest" };

export const dynamic = "force-dynamic";

export default async function DigestPage() {
  const digests = await ensureDigestHistory();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Weekly Digest</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
          Weekly changes across the pipeline, portfolio, founder list, notes and sector mix.
          The scheduled job builds a stored snapshot without changing company records.
        </p>
      </header>

      <div className="space-y-4">
        <DigestList digests={digests} />
      </div>
    </div>
  );
}
