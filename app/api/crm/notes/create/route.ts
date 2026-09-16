import { z } from "zod";

import { guarded } from "@/app/api/_lib/route-helpers";
import { createNote } from "@/lib/crm";

const bodySchema = z.object({
  // Not `.uuid()`: record ids in this dataset are readable demo ids, and a validator
  // that encodes the *format* of an id rather than its constraints breaks the moment
  // the id format changes. Length-bounded instead.
  recordId: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(20000),
  parentObject: z.enum(["companies", "people"]).default("companies"),
});

/** Attach a note to a company (or person) record. */
export function POST(request: Request) {
  return guarded(async () => {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new Error(`Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { recordId, title, content, parentObject } = parsed.data;

    const note = await createNote({ parentObject, recordId, title, content });
    return { noteId: note.id.note_id, demo: true };
  });
}
