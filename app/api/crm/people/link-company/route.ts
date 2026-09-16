import { z } from "zod";

import { guarded } from "@/app/api/_lib/route-helpers";
import { setFounderConnectedCompany } from "@/lib/crm";
import { crmRecordUrl } from "@/lib/constants";

const bodySchema = z.object({
  personRecordId: z.string().min(1).max(100),
  companyRecordId: z.string().min(1).max(100),
});

/**
 * Link a stealth founder to the company they launched.
 *
 * ⚠️ This writes the one field that has been 0% populated since the workspace was built,
 * and whose use is an explicit owner decision rather than a technical one. The launch
 * matcher only ever SUGGESTS these links; the UI names both records in a confirm step
 * before calling this, and there is deliberately no bulk path, no accept-all, and no
 * undo.
 *
 * Both ids are required and explicit. Nothing is inferred server-side — a route that
 * guesses one side of a link is a route that will eventually write a confident wrong one.
 */
export function POST(request: Request) {
  return guarded(async () => {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { personRecordId, companyRecordId } = parsed.data;

    const person = await setFounderConnectedCompany(personRecordId, companyRecordId);

    return {
      person: {
        recordId: person.recordId,
        name: person.name,
        crmUrl: crmRecordUrl("people", person.recordId),
      },
      companyUrl: crmRecordUrl("companies", companyRecordId),
      demo: true,
    };
  });
}
