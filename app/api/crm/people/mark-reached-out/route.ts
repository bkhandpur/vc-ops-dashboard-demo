import { z } from "zod";

import { guarded } from "@/app/api/_lib/route-helpers";
import { setPersonReachedOut } from "@/lib/crm";
import { crmRecordUrl } from "@/lib/constants";

const bodySchema = z.object({
  recordId: z.string().min(1).max(100),
  /**
   * Explicit, never a toggle.
   *
   * A toggle would depend on the client's idea of the current value, which comes from a
   * cached snapshot that may be hours old — so a double click, or a stale tab, could
   * silently flip a founder back to "not contacted". The client says what it wants the
   * value to BE.
   */
  reachedOut: z.boolean(),
});

/**
 * Set `reached_out` on one person.
 *
 * The UI shows a confirm step with the exact payload before calling this, per the
 * project rule that no write happens silently. There are two entry points — the
 * outreach queue and the inline action on a founder card — and they are the same route
 * behind the same confirm, not two write paths.
 */
export function POST(request: Request) {
  return guarded(async () => {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { recordId, reachedOut } = parsed.data;

    const person = await setPersonReachedOut(recordId, reachedOut);

    return {
      person: {
        recordId: person.recordId,
        name: person.name,
        // The value actually stored, not the value we sent.
        reachedOut: person.reachedOut,
        crmUrl: crmRecordUrl("people", person.recordId),
      },
      demo: true,
    };
  });
}
