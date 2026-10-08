---
title: What this demo is
summary: How the public demo handles data and simulated actions
order: 1
---

This public demonstration runs on generated records. Every company, founder, investor
and figure is synthetic. The seed can be reproduced with `npm run seed`.

The demo uses local adapters over committed seed files. It needs no API key or account.

Simulated write actions show their payload and require confirmation. Edits are stored in a bounded cookie owned by this browser for seven days. Other
visitors receive the original seed. Reset deletes only this demo cookie. The cookie
limit produces a visible error before accepting an oversized edit. Digest summaries are composed from
the stored demo figures.

The synthetic records include missing and inconsistent fields so the data-health views
remain useful. See [empty fields](/help/empty-fields) and
[classification](/help/classification).

History charts are illustrative. Ten weekly digests (nine with metric blocks)
use deterministic prefixes and scale factors anchored on October 8, 2026. No
weekly production collection or cron schedule is configured. Manual diffs compare
your current edits with the immutable sample and retain at most three results.
