import { z } from "zod";

import { guarded } from "@/app/api/_lib/route-helpers";
import { addRecordToList, upsertPerson } from "@/lib/crm";
import { crmRecordUrl } from "@/lib/constants";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  notes: z.string().max(5000).optional(),
});

/** Upsert a person (matched on email), then add them to the Stealth Founders list. */
export function POST(request: Request) {
  return guarded(async () => {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { name, email, notes } = parsed.data;

    const person = await upsertPerson({ name, email, description: notes });
    await addRecordToList("stealthFounders", person.recordId);

    return {
      person: {
        recordId: person.recordId,
        name: person.name,
        crmUrl: crmRecordUrl("people", person.recordId),
      },
      addedToList: true,
      demo: true,
    };
  });
}
