# Costroid schemas

Open, versioned contracts for [Costroid](https://github.com/Costroid/costroid), the cost check for pull requests, and Costroid Platform.

| Contract                                         | What it fixes                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| [`tags/v0.5`](tags/v0.5/README.md)               | The same tags, plus where a session ran when it ran outside a CI run, and `costroid/repo` in lower case.                     |
| [`tags/v0.4`](tags/v0.4/README.md)               | The same tags, plus the repository's visibility as the CI system states it.                                                  |
| [`tags/v0.3`](tags/v0.3/README.md)               | The same tags, plus a work item, an experiment's arm and a team that a caller names.                                         |
| [`tags/v0.2`](tags/v0.2/README.md)               | The tags that join a FOCUS row to a pull request, and the mapping to OpenTelemetry.                                          |
| [`tags/v0.1`](tags/v0.1/README.md)               | The same tags, before the assumed cache lifetime.                                                                            |
| [`focus-row/v0.6`](focus-row/v0.6/README.md)     | One row per model request per token class: as v0.5, plus the tag that marks a row from a developer's machine.                |
| [`focus-row/v0.5`](focus-row/v0.5/README.md)     | One row per model request per token class, in FOCUS 1.4, with a strict profile for readers that merge it with provider data. |
| [`focus-row/v0.4`](focus-row/v0.4/README.md)     | The same row, before the repository's visibility.                                                                            |
| [`focus-row/v0.3`](focus-row/v0.3/README.md)     | The same row, before the strict profile and the tags a caller names.                                                         |
| [`focus-row/v0.2`](focus-row/v0.2/README.md)     | The same row, before the 30-minute and 12-hour cache write classes.                                                          |
| [`focus-row/v0.1`](focus-row/v0.1/README.md)     | The same row, before region and service tier columns.                                                                        |
| [`status/v0.1`](status/v0.1/README.md)           | What a run has spent while its agent works: spend per basis, cap, grade and counts.                                          |
| [`receipt/v0.1`](receipt/v0.1/README.md)         | The token counts of a developer's own agent sessions on one branch, posted on the pull request. It states no amount.         |
| [`result/v0.7`](result/v0.7/README.md)           | One object per Costroid report: its figures, the rows it was built from, the pull request's total and an agent's own figure. |
| [`result/v0.8`](result/v0.8/README.md)           | One object per Costroid report: as v0.7, plus the recorded run a report shows in place of the pull request's own.            |
| [`result/v0.9`](result/v0.9/README.md)           | One object per Costroid report: as v0.8, plus the figures OpenCode and Copilot CLI state, each in its own unit.              |
| [`result/v0.10`](result/v0.10/README.md)         | One object per Costroid report: as v0.9, plus the infrastructure estimates, stated apart from the figures.                   |
| [`result/v0.11`](result/v0.11/README.md)         | One object per Costroid report: as v0.10, plus the P95 limit, a multiple of the P95 of the agent's earlier runs.             |
| [`result/v0.12`](result/v0.12/README.md)         | One object per Costroid report: as v0.11, plus the repository's own policy pack and its results.                             |
| [`result/v0.13`](result/v0.13/README.md)         | One object per Costroid report: as v0.12, plus the developer-machine sessions a receipt states, apart from the figures.      |
| [`result/v0.6`](result/v0.6/README.md)           | The same object, before an agent's own figure and two run reasons.                                                           |
| [`result/v0.5`](result/v0.5/README.md)           | The same object, before the rows' digests and the lifetime total.                                                            |
| [`integration/v0.6`](integration/v0.6/README.md) | A merge fact graded only from a protected branch and stored with that branch, and repository names compared in lower case.   |
| [`integration/v0.5`](integration/v0.5/README.md) | One fact per merged pull request, and a reconciliation result per credential and UTC day.                                    |
| [`integration/v0.4`](integration/v0.4/README.md) | A batch of token_verified rows bound to its run, and the refusal of a restatement from another run.                          |
| [`integration/v0.3`](integration/v0.3/README.md) | Rows of focus-row/v0.5 and tags of tags/v0.4, and the refusal of a strict-profile row.                                       |
| [`integration/v0.2`](integration/v0.2/README.md) | The run token, row identity, cost refusals and month-wide restatement.                                                       |
| [`integration/v0.1`](integration/v0.1/README.md) | Tenant identity, installation proof, tokens, exports and quotas, in OpenAPI 3.1.                                             |

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
