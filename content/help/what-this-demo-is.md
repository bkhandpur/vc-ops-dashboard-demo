---
title: What this demo is
summary: How the public demo handles data and simulated actions
order: 1
---

This public demonstration runs on generated records. Every company, founder, investor
and figure is synthetic. The seed can be reproduced with `npm run seed`.

The demo uses local adapters over committed seed files. It needs no API key or account.

Simulated write actions show their payload and require confirmation. Development writes
land in a local store and do not survive a restart. Digest summaries are composed from
the stored demo figures.

The synthetic records include missing and inconsistent fields so the data-health views
remain useful. See [empty fields](/help/empty-fields) and
[classification](/help/classification).
