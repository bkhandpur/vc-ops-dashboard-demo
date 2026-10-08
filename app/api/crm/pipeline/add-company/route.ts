import { z } from "zod";

import { guarded } from "@/app/api/_lib/route-helpers";
import { addRecordToList, upsertCompany } from "@/lib/crm";
import { crmRecordUrl } from "@/lib/constants";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  domain: z
    .string()
    .min(3)
    .max(255)
    // Accept "acme.com" or a pasted URL; normalise to the bare host. Users paste URLs,
    // and the domain is the upsert matching key — a scheme in it creates a duplicate.
    .transform((raw) =>
      raw
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase(),
    ),
  description: z.string().max(5000).optional(),
  theme: z.string().max(200).optional(),
  canonicalSector: z.string().max(200).optional(),
  subSectors: z.array(z.string().max(200)).max(20).optional(),
  rounds: z.array(z.string().max(200)).max(20).optional(),
});

/**
 * Upsert a company (matched on domain), then add it to the Pipeline list.
 *
 * Called only from the command palette's confirm step, which has already shown the user
 * the exact payload. Input is validated here anyway: the UI having shown a payload is
 * not the same as the server having checked one.
 */
export function POST(request: Request) {
  return guarded(async () => {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const input = parsed.data;

    const company = await upsertCompany({
      name: input.name,
      domain: input.domain,
      description: input.description,
      theme: input.theme,
      canonicalSector: input.canonicalSector,
      subSectors: input.subSectors,
      rounds: input.rounds,
    });

    await addRecordToList("pipeline", company.recordId);

    return {
      company: {
        recordId: company.recordId,
        name: company.name,
        crmUrl: crmRecordUrl("companies", company.recordId),
      },
      // The upsert endpoint does not report whether it created or matched, so this is
      // inferred from the record's age. Not elegant, but it is the only signal available.
      created: Date.now() - new Date(company.createdAt).getTime() < 60_000,
      addedToList: true,
      demo: true,
    };
  });
}
