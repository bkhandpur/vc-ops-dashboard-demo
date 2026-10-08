import { withDemoPage } from "@/lib/demo-session";
import { notFound } from "next/navigation";

import { CompanyDetail } from "@/components/company/CompanyDetail";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Company" };

/**
 * Company detail, built from the CACHED snapshot — no external call on page load.
 * The explicit refresh action re-reads this browser’s sample record.
 */
async function CompanyPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const [cached, people, enrichment] = await Promise.all([
    readOrBuildSnapshot(),
    readOrBuildPeople(),
    readOrBuildEnrichment(),
  ]);

  const company = cached?.data.companies.find((c) => c.recordId === recordId);
  if (!company) notFound();

  /**
   * The company's `team` is a list of people record ids. We can only put names to the
   * ones that also appear on a list we snapshot (Stealth Founders / Co-Investors), which
   * in practice is almost none of them — so the detail view shows a count and links to
   * the CRM rather than pretending to a roster it does not have.
   */
  const knownPeople = [
    ...(people?.data.stealthFounders ?? []),
    ...(people?.data.coInvestors ?? []),
  ];
  const team = company.teamRecordIds
    .map((id) => knownPeople.find((p) => p.recordId === id) ?? null)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <CompanyDetail
      company={company}
      team={team}
      companies={cached!.data.companies}
      coInvestors={people?.data.coInvestors ?? []}
      enrichedFact={enrichment?.data.companies.find((f) => f.recordId === recordId) ?? null}
      generatedAt={cached!.generatedAt}
    />
  );
}

export default withDemoPage(CompanyPage);
