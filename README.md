# Costroid schemas

Open, versioned contracts for [Costroid](https://github.com/Costroid/costroid), the cost check for pull requests, and Costroid Platform.

| Contract                                         | What it fixes                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [`tags/v0.2`](tags/v0.2/README.md)               | The tags that join a FOCUS row to a pull request, and the mapping to OpenTelemetry. |
| [`tags/v0.1`](tags/v0.1/README.md)               | The same tags, before the assumed cache lifetime.                                   |
| [`focus-row/v0.3`](focus-row/v0.3/README.md)     | One row per model request per token class, in FOCUS 1.4.                            |
| [`focus-row/v0.2`](focus-row/v0.2/README.md)     | The same row, before the 30-minute and 12-hour cache write classes.                 |
| [`focus-row/v0.1`](focus-row/v0.1/README.md)     | The same row, before region and service tier columns.                               |
| [`integration/v0.1`](integration/v0.1/README.md) | Tenant identity, installation proof, tokens, exports and quotas, in OpenAPI 3.1.    |

## Why it exists

Costroid and Costroid Platform share nothing but these files. Any other tool can read the same rows or implement the same contract.

## Install

```sh
git clone https://github.com/Costroid/costroid-schemas
cd costroid-schemas
npm ci
```

Node.js 22 or later. The one dependency is [Ajv](https://ajv.js.org/), pinned in `package.json`.

## First command

```sh
node scripts/validate.mjs
```

It checks every file in `examples/` against its schema and confirms that every file in `examples/rejected/` fails. The last line reads:

```text
all examples match their schemas
```

## Versions

A version is a directory, and the version number is in every path. A published version never changes in place: a change is a new directory, and the old one stays.

## Licence

Apache-2.0. Costroid does not relicense this repository. Contributions are under the [Developer Certificate of Origin](CONTRIBUTING.md).
