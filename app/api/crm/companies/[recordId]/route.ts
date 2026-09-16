import { guarded } from "@/app/api/_lib/route-helpers";
import { getRecord, toCompany } from "@/lib/crm";

/**
 * Fetch ONE company directly from the source.
 *
 * This is the single place in the app reached from a page's own UI rather than from a
 * refresh job, and it does not break the "page loads never call an external service"
 * rule: it is only ever reached by clicking "Refresh this record" on a company detail
 * page. The page itself renders from the cached snapshot; this replaces what is on
 * screen with current values for that one record.
 *
 * It deliberately does NOT write the result back into the cached snapshot. That snapshot
 * is one consistent point-in-time view that Statistics, Data Health and Trends all read;
 * patching a single company into it would make the "snapshot taken at …" caption a lie
 * for that one row while leaving it true for every other. The freshened values live in
 * component state until the next full refresh.
 *
 * Note also what this route does NOT return: a record fetched on its own has no list
 * context, so every list-entry field (city, deal stage, product overview) comes back
 * null. The detail page keeps its snapshot values for those rather than overwriting
 * them with nulls — which is why `toCompany()` takes the entry as optional.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await params;
  return guarded(async () => {
    const record = await getRecord("companies", recordId);
    return { company: toCompany(record), fetchedAt: new Date().toISOString() };
  });
}
