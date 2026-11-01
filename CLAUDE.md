# costroid-schemas

Open, versioned contracts for Costroid and Costroid Platform. This repository is public under Apache-2.0.

## Layout

- `tags/v0.1/`, `tags/v0.2/`: the per-PR tag convention.
- `focus-row/v0.1/`, `focus-row/v0.2/`, `focus-row/v0.3/`: one Costroid FOCUS row.
- `integration/v0.1/`: the OpenAPI contract between the two products.
- `scripts/validate.mjs`: checks every example against its schema.

## Check

Run `npm ci`, then `node scripts/validate.mjs`. It must exit 0. Read its exit code directly.

## Rules

- A published version directory is never edited. A change is a new directory.
- Every schema has examples. `examples/` must pass and `examples/rejected/` must fail.
- Amounts are decimal strings, at most 12 fractional digits, never JSON numbers.
- An external fact carries its source URL and retrieval date.
- Example names and figures are synthetic. Say so.
- No platform code enters this repository. The contract is the only dependency between the products.
- Only contracts, schemas and their examples belong here. Company matters do not.
- `STYLE.md` is the bar for every public line.
- Commits use the imperative mood and carry a `Signed-off-by` trailer on pull requests.
