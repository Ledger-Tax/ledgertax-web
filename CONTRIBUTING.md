# Contributing to ledgertax-web

Accounting export, not tax advice.

ledgertax-web is the Next.js app where people enter an address, review and relabel events, supply prices and download reports. It is **read-only**: it never holds keys, signs or sends a transaction. Thank you for helping.

## Set up

You need Node.js 22.12 or newer and [pnpm](https://pnpm.io).

- `pnpm install --frozen-lockfile`
- Copy `.env.example` to `.env` and set `NEXT_PUBLIC_API_URL`; the API must list the app's origin in its `CORS_ORIGINS`.

## Check your work

Run this before every pull request. It must pass:

```bash
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Rules that matter here

- **No secrets, ever.** Never put a secret key, seed phrase or API key in code, tests, logs, commits or issues. Use public addresses and testnet only; never target mainnet in tests.
- **No personal data.** Do not commit the history of a real person's account.
- **Do not guess.** Unknown things stay unknown; a missing price is an error row, not a guess. Documentation describes only what exists and is tested.
- **Money is not a float.** Use `bigint` or decimal strings.
- **Every public function** has JSDoc, one test for success and at least one for failure.
- **Ask before adding a dependency** (open an issue first). New dependencies must be justified.
- TypeScript is `strict`, with no `any`.
- API types are generated from `openapi/openapi.yaml` (`pnpm gen:api`) and committed; do not edit `lib/api-schema.d.ts` by hand.
- Colours and spacing come from the CSS variables in `app/globals.css`; a test fails on a hardcoded colour or on a contrast ratio below WCAG AA.
- Every data view needs a loading, an empty and an error state, and every control an accessible name.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/) with `web` as the scope, for example `feat(web): add something` or `fix(web): handle an edge case`. Keep one logical change per commit.

## Claiming an issue

1. Pick an issue and comment that you would like to work on it. Wait for a maintainer to assign it to you.
2. Look for the marker named in the issue (for example `WAVE-ISSUE(...)`) in the code: it shows where your change plugs in.
3. Open a pull request that links the issue, states what you changed and shows the output of the check above.

Good first areas: bulk relabelling, a report preview, better empty and error states, or an accessibility pass.

By contributing you agree that your contribution is licensed under the MIT license of this repository.
