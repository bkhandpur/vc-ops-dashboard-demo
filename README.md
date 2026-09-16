# VC Operations Dashboard

A public version of an internal operations tool I built for Watershed Ventures. It
brings pipeline, portfolio, founder and co-investor workflows into one interface.

This repository is separate from the internal product. It uses generated records and
does not connect to Watershed systems.

## Why I built it

The CRM held the underlying records, but recurring questions still required manual
filtering and cross-referencing: where the pipeline was concentrated, which founders
needed follow-up, which co-investors fit a round and where records were incomplete. I
built the dashboard around those decisions rather than around the CRM schema.

## What it includes

- Pipeline and portfolio views
- Theme, sector and sub-sector analysis
- Company momentum and data-quality checks
- Founder sourcing and outreach queues
- Co-investor history and matching
- Company tear sheets and a weekly activity digest
- Global search and a command palette
- Confirmation screens for simulated write actions

## Data safety

The app runs on a fixed synthetic dataset in [`data/seed`](data/seed). Company names are
assembled from invented syllables. Links use reserved `.example` domains. The project
contains no production credentials, account IDs, contact details or portfolio figures.

All data access goes through local adapters. Page loads do not call an external service.
Actions that look like CRM writes are stored locally during development and do not leave
the application.

See [`NOTICE`](NOTICE) for the repository disclaimer.

## Run it locally

You need Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No account or API key is required.

## Project checks

```bash
npm run typecheck
npm run build
npm run coverage
npm run check:docs
```

`npm run coverage` measures field coverage in the committed seed and updates
[`COVERAGE.md`](COVERAGE.md). `npm run check:docs` confirms that documented figures
still match the generated records.

## Structure

```text
app/          Next.js pages and local API routes
components/   Interface, charts and workflow views
lib/          Data adapters, aggregation and scoring
data/seed/    Generated demo records
scripts/      Seed, coverage and preview tools
content/      In-app help articles
```

The app uses Next.js, React, TypeScript and Tailwind CSS. Charts are rendered with local
SVG components.

## Implementation choices

The application reads through typed local adapters, so the interface is independent of
the backing data source. Rankings are deterministic and expose their component scores.
Write actions show the proposed change before confirmation. Coverage thresholds prevent
thin data from being presented as a meaningful chart.

The interface uses Watershed Ventures' navy and green brand colors, compact typography
and bordered data panels. The public version has its own information architecture,
generated records and labels.

## License

MIT. See [`LICENSE`](LICENSE).
