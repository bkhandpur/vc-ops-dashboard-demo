import { guarded } from "@/app/api/_lib/route-helpers";
import { searchCompaniesByName } from "@/lib/crm";
import { crmRecordUrl } from "@/lib/constants";

/**
 * GET /api/crm/companies/search?q=… — typeahead for the command palette.
 *
 * Searches the object, so results carry no list-entry values: no city, no deal stage, no
 * product overview. Callers use name and domain only, and must not present a typeahead
 * hit as if it were a full record.
 */
export function GET(request: Request) {
  return guarded(async () => {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const companies = await searchCompaniesByName(query, 10);
    return {
      companies: companies.map((c) => ({
        recordId: c.recordId,
        name: c.name,
        domains: c.domains,
        crmUrl: crmRecordUrl("companies", c.recordId),
        logoUrl: c.logoUrl,
      })),
    };
  });
}
