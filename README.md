# Workely open data

Open data from Workely (https://www.workely.ai), an AI lead-response product that quotes home-service leads from the owner's own pricing rules. This repository holds two datasets and the pricing-rule schema. The two datasets are kept separate and are never blended.

Canonical sources on the Workely site, which this repository mirrors:

- Price Index: https://www.workely.ai/index
- Price Index method: https://www.workely.ai/index/method
- Open Ledger: https://www.workely.ai/research/lead-ledger (data: https://www.workely.ai/research/lead-ledger/data.json)
- Price book: https://www.workely.ai/data/price-book

If this repository and the site ever disagree, the site is right and this is a bug; please open an issue.

## 1. Workely Price Index (advertised prices)

What businesses say they charge, read from their own public price pages. It is not what customers paid, and it is not advice on what to charge.

Method, in short (full version at /index/method):

- Only public price pages, and `robots.txt` is respected. A page a site asks crawlers not to read is not read.
- No business name is stored or shown. Raw page text is deleted after the prices are read. No domain, address, phone number or email is in this repository.
- A cell is published only when at least 30 distinct businesses back it. Every published row says so with `n_businesses`.
- Every published number is labeled "advertised prices, captured on <date>, n = <real count>". The capture period in this release is October 2026.
- Figures are quartiles (25th percentile, median, 75th percentile) and the share of businesses whose price is a starting "from" price.

Published now (`data/price-index/cells.csv`):

| Cell | Unit | Captured | n businesses | Median |
|---|---|---|---|---|
| United Kingdom window cleaning | per clean | October 2026 | 45 | 20 GBP |
| United States pressure washing | per house wash | October 2026 | 44 | 360 USD |
| United States pressure washing | per driveway | October 2026 | 43 | 225 USD |

Collecting (below the floor, so not published; counts are the businesses with a usable price so far):

| Cell | Unit | n so far | Needed |
|---|---|---|---|
| United States pressure washing | per square foot | 11 | 30 |
| United States pressure washing | other units (mixed) | 17 | 30 |
| Any region inside a cell (for example Southeast, Midlands and East) | all units | under 30 | 30 |

Nothing is published for a cell until it clears 30. New trades and countries are added to the collecting table when capture starts.

## 2. TWC's Open Ledger (one company's residential numbers)

Real, binned residential numbers from The Total Wash Co. (TWC), an exterior-cleaning company in Madison, Wisconsin, which is owned by Workely's founder. Residential work only; TWC's commercial pricing is kept private and is not here. Prices are rounded to the nearest $5, any cell under 10 is hidden, and a rate is shown only when its group has at least 20. No names, addresses, emails or phone numbers.

`data/ledger/data.json` is a copy of https://www.workely.ai/research/lead-ledger/data.json. The CSVs in `data/ledger/` are generated from it by `scripts/build-ledger-csv.mjs`, and `scripts/validate.mjs` fails if they drift. The reliable window is 2026 Q2 and Q3; read the `verdict` note on each table in the JSON before using it.

| File | What it holds |
|---|---|
| `t1_leads_by_channel_quarter.csv` | Residential leads by channel and quarter |
| `t2_lead_to_quote_rate_by_channel.csv` | Share of leads with a recorded quote, by channel |
| `t3_quote_outcomes.csv` | Closed quotes: booked, accepted, no reply |
| `t5_price_bands_by_service.csv` | Job-total quartiles by service |
| `t6_booked_rate_by_quote_total_band.csv` | Booked rate by quote total band |
| `t9_median_ticket_by_quarter.csv` | Median job total by quarter |

## 3. Pricing-rule schema

`schema/pricing-rule.schema.json` (JSON Schema draft 2020-12) describes an owner's service and pricing rules, matching the types in Workely's quote engine. See `schema/README.md` for the source files. Three illustrative examples (pressure washing, window cleaning, gutter cleaning) are in `examples/`; their numbers are examples, not recommendations.

## Update cadence

Quarterly. Each release states its capture month and `n` per row.

## How to cite

Workely. (2026). *Workely open data: Price Index and Open Ledger* (version 0.1.0) [Data set]. https://www.workely.ai/index

Machine-readable: `CITATION.cff`. Archiving on Zenodo, Kaggle and Hugging Face begins only once a cell has 100 rows; `.zenodo.json` is ready for that day.

## Licenses

- Code (`scripts/`, `.github/`): MIT, see `LICENSE`.
- Data (`data/`) and the schema and examples: Creative Commons Attribution 4.0 (CC BY 4.0), see `LICENSE-DATA`. Credit "Workely" and link to https://www.workely.ai.

## Check the data yourself

```
npm ci
node scripts/validate.mjs
```

This checks every CSV against `datapackage.json`, every example against the schema, that every Price Index row has at least 30 businesses, and that no column or value looks like a business name, domain, URL, email, phone number or street address.

## Contact

hello@workely.ai
