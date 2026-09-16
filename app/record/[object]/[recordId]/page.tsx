import { notFound, redirect } from "next/navigation";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { Badge, Panel, PanelHeader, PageHeader } from "@/components/ui";
import { readOrBuildPeople } from "@/lib/people";
import { outreachState, OUTREACH_LABELS } from "@/lib/people-derive";

export const metadata = { title: "Record" };

/** Resolve demo record links to local company or people views. */
export default async function RecordPage({
  params,
}: {
  params: Promise<{ object: string; recordId: string }>;
}) {
  const { object, recordId } = await params;

  if (object === "companies") redirect(`/company/${recordId}`);
  if (object !== "people") notFound();

  const people = await readOrBuildPeople();
  const person =
    people.data.stealthFounders.find((p) => p.recordId === recordId) ??
    people.data.coInvestors.find((p) => p.recordId === recordId);

  if (!person) notFound();

  const isCoInvestor = people.data.coInvestors.some((p) => p.recordId === recordId);

  // Only populated fields get a row. Rendering "Location: —" for the majority with no
  // location buries the facts that do exist — the same rule the company detail page
  // follows, and the reason both pages report what is missing once, at the bottom.
  const rows: [string, string][] = [];
  if (person.fundFirm) rows.push(["Firm", person.fundFirm]);
  if (person.linkedinPosition ?? person.jobTitle) {
    rows.push(["Role", (person.linkedinPosition ?? person.jobTitle)!]);
  }
  if (person.linkedinCompany) rows.push(["Affiliation", person.linkedinCompany]);
  if (person.location) rows.push(["Location", person.location]);
  if (person.education) rows.push(["Education", person.education]);
  if (person.stageFocus) rows.push(["Stage focus", person.stageFocus]);
  if (person.checkSizeRange) rows.push(["Cheque size", person.checkSizeRange]);
  if (person.sectorThesisFocus) rows.push(["Thesis", person.sectorThesisFocus]);
  if (person.sourcedBy.length > 0) rows.push(["Sourced by", person.sourcedBy.join(", ")]);
  if (person.dealsCoInvested.length > 0) {
    rows.push(["Co-invested on", person.dealsCoInvested.join(", ")]);
  }
  if (person.email) rows.push(["Email", person.email]);

  return (
    <div>
      <PageHeader
        eyebrow={isCoInvestor ? "Co-Investor" : "Stealth Founder"}
        title={person.name ?? "Unnamed person"}
        description={<code className="font-mono text-[12px]">{person.recordId}</code>}
      />

      <Panel className="overflow-hidden">
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <CompanyAvatar name={person.name} logoUrl={person.avatarUrl} size={20} />
              {person.name ?? "Unnamed"}
            </span>
          }
          description={
            isCoInvestor ? undefined : OUTREACH_LABELS[outreachState(person)]
          }
          actions={
            person.highlights.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {person.highlights.slice(0, 3).map((h) => (
                  <Badge key={h}>{h}</Badge>
                ))}
              </span>
            ) : undefined
          }
        />
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink-muted">No additional details.</p>
        ) : (
          <dl className="divide-y divide-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[160px_1fr]">
                <dt className="text-[12px] font-medium text-ink-muted">{label}</dt>
                <dd className="text-[13px] break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}
