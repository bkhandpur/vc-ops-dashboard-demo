import { guarded } from "@/app/api/_lib/route-helpers";
import { getTaxonomyOptions, type TaxonomyOptions } from "@/lib/crm";
import { cacheGet, cacheSet, envelope, type Cached } from "@/lib/cache";
import { CACHE_KEYS } from "@/lib/constants";

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h — options change rarely

/**
 * Select options for the taxonomy fields, used by the palette forms.
 *
 * FETCHED, not hardcoded. A hardcoded option list silently stops offering a new option
 * the moment somebody adds one, and the form keeps working, so nobody notices. Cached
 * because the palette opens often and these barely change.
 */
export function GET() {
  return guarded(async () => {
    const cached = await cacheGet<Cached<TaxonomyOptions>>(CACHE_KEYS.attributes);
    if (cached && Date.now() - new Date(cached.generatedAt).getTime() < MAX_AGE_MS) {
      return cached.data;
    }
    const options = await getTaxonomyOptions();
    await cacheSet(CACHE_KEYS.attributes, envelope(options));
    return options;
  });
}
