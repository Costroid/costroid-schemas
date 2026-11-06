# Contributing

## Developer Certificate of Origin

Every commit carries a sign-off. There is no contributor licence agreement.

Sign off with `git commit -s`. The trailer states that you agree to the [Developer Certificate of Origin 1.1](https://developercertificate.org/):

```text
Signed-off-by: Your Name <you@example.com>
```

CI rejects a pull request with an unsigned commit. Contributions are licensed under Apache-2.0, the licence of this repository.

## Changing the repository

1. Run `npm ci`.
2. Make the change.
3. Run the repository's check, `node scripts/validate.mjs`. It must exit 0.
4. Read [STYLE.md](STYLE.md). It is the bar for every public line.
5. Open a pull request with three sections: changed, deliberately unchanged, verified.

Commit messages use the imperative mood and say what changed and why.

## Rules

- A published version directory is never edited. A change is a new directory.
- Every schema has examples. `examples/` must pass and `examples/rejected/` must fail.
- Amounts are decimal strings, at most 12 fractional digits, never JSON numbers.
- An external fact carries its source URL and retrieval date.
- Example names and figures are synthetic. Say so.
- No platform code enters this repository. The contract is the only dependency between the products.
