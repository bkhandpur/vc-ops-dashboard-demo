/**
 * Server-side half of the people features: Stealth Founders (180) and Co-Investors (96).
 *
 * Same architecture as lib/stats.ts — read, cache, hand a plain snapshot to the UI. Pure
 * derivations (grouping, filtering, sorting, the co-investment rollups) live in
 * lib/people-derive.ts so the client can re-run them on every keystroke without a round
 * trip.
 */

import "server-only";

import { getPeopleInList } from "./crm";
import { cacheGet, cacheSet, envelope, type Cached } from "./cache";
import { CACHE_KEYS, PEOPLE_LISTS, type PeopleListKey } from "./constants";
import type { TrackedPerson } from "./people-derive";

export interface PeopleSnapshot {
  stealthFounders: TrackedPerson[];
  coInvestors: TrackedPerson[];
}

export async function buildPeopleSnapshot(): Promise<PeopleSnapshot> {
  const [stealthFounders, coInvestors] = await Promise.all(
    PEOPLE_LISTS.map(async (list: PeopleListKey) => {
      const people = await getPeopleInList(list);
      return people.map(
        (p): TrackedPerson => ({
          recordId: p.recordId,
          createdAt: p.createdAt,
          name: p.name,
          email: p.emails[0] ?? null,
          description: p.description,
          linkedin: p.linkedin,
          linkedinCompany: p.linkedinCompany,
          linkedinPosition: p.linkedinPosition,
          jobTitle: p.jobTitle,
          highlights: p.highlights,
          sourcedBy: p.sourcedBy,
          reachedOut: p.reachedOut,
          avatarUrl: p.avatarUrl,
          // `current_location` is free text and 81% covered on founders;
          // `home_location` is 32%. Prefer the better-covered one, as everywhere else.
          location: p.currentLocation ?? p.location,
          stageFocus: p.stageFocus,
          sectorThesisFocus: p.sectorThesisFocus,
          education: p.education,
          twitter: p.twitter,
          sourceDocumentUrl: p.sourceDocumentUrl,
          connectedCompanyId: p.connectedCompanyId,
          fundFirm: p.fundFirm,
          checkSizeRange: p.checkSizeRange,
          dealsCoInvested: p.dealsCoInvested,
        }),
      );
    }),
  );

  return {
    stealthFounders: stealthFounders ?? [],
    coInvestors: coInvestors ?? [],
  };
}

export function readCachedPeople(): Promise<Cached<PeopleSnapshot> | null> {
  return cacheGet<Cached<PeopleSnapshot>>(CACHE_KEYS.people);
}

/** See the note on `readOrBuildSnapshot()` in lib/stats.ts. */
export async function readOrBuildPeople(): Promise<Cached<PeopleSnapshot>> {
  const cached = await readCachedPeople();
  if (cached) return cached;
  return refreshPeopleSnapshot();
}

export async function refreshPeopleSnapshot(): Promise<Cached<PeopleSnapshot>> {
  const snapshot = await buildPeopleSnapshot();
  const wrapped = envelope(snapshot);
  await cacheSet(CACHE_KEYS.people, wrapped);
  return wrapped;
}
