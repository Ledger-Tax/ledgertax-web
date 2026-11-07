# ledgertax-web

Next.js app for Stellar Ledger Tax: enter a public Stellar address, review the classified events, relabel them, supply prices, and download two CSV reports.

**Accounting export, not tax advice.** Tax rules differ by country, classification can be wrong, and a wrong price gives a wrong result.

**Status:** early. It talks to a running [ledgertax-api](https://github.com/Ledger-Tax/ledgertax-api) over HTTP; it is not deployed.

## What it does

- **Address field** with inline validation. Anything shaped like a secret key is cleared from the field at once, never sent and never stored, with a plain-language warning.
- **Events table** that streams events from the API (progress for long histories), with loading, empty and error states, a type filter, and events the classifier did not understand clearly marked "Unknown" (also in text, not only colour).
- **Labels** (income, disposal, transfer, gift, ignore) chosen with a normal select per event, so they work with the keyboard. Labels are kept **only in your browser** (`localStorage`, guarded: the app works without it) and are sent to the API only inside a report request.
- **Prices and report**: upload a price CSV (`asset,date,price,currency`), choose a currency, generate the report, see totals, every problem as a visible row, a plain gains table, and download `gains.csv` and `events.csv`. Both files start with "Accounting export, not tax advice." and state the source and history range.

## Not included yet

Bulk relabelling, a report preview with totals by year, an audited accessibility pass beyond the automated checks below, and anything not listed above.

## Configure and run

```bash
cp .env.example .env     # set NEXT_PUBLIC_API_URL to your API, for example http://localhost:8787
pnpm install --frozen-lockfile
pnpm dev
```

The API must allow this app's origin: start it with `CORS_ORIGINS` set to the app's origin (for example `http://localhost:3000`). `NEXT_PUBLIC_API_URL` is read at build time.

## API types

Types come from the API's OpenAPI spec, committed in this package: `openapi/openapi.yaml` and the generated `lib/api-schema.d.ts`. To update them after the API changed, copy the new [`openapi.yaml` from the api repository](https://github.com/Ledger-Tax/ledgertax-api/blob/main/openapi.yaml) into `openapi/` and run `pnpm gen:api`, then commit both files.

## Check

```bash
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Tests include component tests for the address form and the label flow, an API client test with streamed responses, WCAG AA contrast ratios computed from the colour tokens (light and dark), a check that no colour is hardcoded outside the tokens, and a check that every control has an accessible name and no positive tabindex.

Colours and spacing come from CSS variables in `app/globals.css`.
