# Costroid result object, version 0.12

One object per Costroid report: the figures of one run per currency and basis, the token counts by class, the grades, the cap the run was given and what is left or over, the digests of the rows, the pull request's total, the agent's own figure in its own unit, the recorded run a report shows in place of the pull request's own, the infrastructure estimates a workflow added beside the agent's rows, the P95 limit, the repository's own policy pack and its results, and a reason when there are no figures. The schema is [`result.schema.json`](result.schema.json).

`costroid run --json` and `costroid report --json` print it. The check run named `costroid` carries the same object in its output text, inside one fenced `json` block, and the pull request comment carries a copy. The object's `schema` field reads `costroid.result/0.12`.

A report writes version 0.12 only when its object holds something version 0.11 cannot: `policy.pack`, which a report holds when `costroid.yml` names a pack. A report with no pack writes [`result/v0.11`](../v0.11/README.md) when it holds a `run_p95` result, and otherwise [`result/v0.10`](../v0.10/README.md) when it states an estimate and [`result/v0.9`](../v0.9/README.md) when it does not, as before. So a reader of any of those reads every report without a pack as it did. A version 0.12 object states `estimates` and `estimates_omitted` when the report states an estimate, and holds neither when it does not.

The examples are the objects the check run carries for the Claude Code recording in [`infrastructure-beside-the-agent.json`](../v0.10/examples/infrastructure-beside-the-agent.json), priced at catalog 0.4.1, in synthetic reports that state no digest, each beside a synthetic policy and pack: `pack-rule-fails.json` and `pack-rule-warns.json` for a pack's own rules, `pack-held-by-warn-only.json` for a pack's failure the warn-only period held back, `pack-beside-the-p95-limit.json` for a pack's warning beside a run over its P95 limit, and `pack-not-valid.json`, `pack-not-read.json` and `pack-past-its-bound.json` for a pack that did not run to its end. Every commit, check run, hash, pack rule, message and policy figure is synthetic, except the SHA-256 of zero bytes in `pack-not-read.json`.

## Figures are never summed across a currency or a basis

Each entry of `figures` is one currency, one cost basis, one attribution grade and one enforcement grade. Amounts and token counts are decimal strings, never JSON numbers. A reader adds two entries only when their `currency` and `cost_basis` match.

`tokens` holds every class the figure's rows name, with the values of the `SkuMeter` column of [`focus-row/v0.3`](../../focus-row/v0.3/README.md). `reasoning_output` and `cached_input_reported` repeat tokens that `output` and `cache_read` count.

## The rows

`rows_sha256` names the rows the report read, an estimate's rows included: the SHA-256 of each row's `x_CostroidRowId`, sorted by byte, each followed by a line feed, as lower-case hex. Two objects with the same `rows_sha256` report the same rows, whatever order or line endings their files gave them. It is null when there are no figures, and when a row names no `x_CostroidRowId` of 64 lower-case hex digits.

`rows_file_sha256` is the SHA-256 of the rows file, byte for byte, as the report read it. It is null when the report could not read the file to its end.

Both can be checked by hand against the rows file:

```sh
jq -r .x_CostroidRowId costroid-rows.jsonl | LC_ALL=C sort | sha256sum
sha256sum costroid-rows.jsonl
```

## The pull request's total

`lifetime` holds the totals the pull request comment states under the figures: the reports on every commit of the pull request, this run's included, added up per currency and basis. Nothing is added across a currency or a basis. `figures` holds at most 10 totals, sorted by currency, then by basis, and `figures_omitted` counts the rest.

Reports with the same `rows_sha256` count once. An object of an earlier version states no `rows_sha256`, so it counts once per check run. `may_repeat` is `true` when a total holds two or more reports and one of them states no digest, so a report over the same rows can be counted twice. `capped` is `true` when the host listed as many commits as it lists, 250 on GitHub, so a later commit can be missing. `unread` counts the check runs whose object could not be read or added up.

Any job of the repository can post a check run named `costroid`, so a total read from check runs is a claim. `lifetime` is null off a pull request, when the earlier reports could not be read, and in a copy that withholds amounts.

## Copies that withhold

`amounts` reads `shown` in the check run's object and in what both commands print. The comment's copy reads `withheld` on a public repository whose `costroid.yml` sets `comment.show_cost: false`, or when that setting cannot be read. A withheld copy carries no `list_cost`, no `tokens`, a null `cap`, a null `lifetime` and a null `agent_stated`.

## The cap

`cap` is the cap the run was given, as the report was told it. It is stated in USD, never in turns. It is compared with one figure: the figures in USD, when they share one basis. `remainder` is the amount minus the cost and `overshoot` the cost minus the amount, and one of them is `0`. `overshoot_tokens` counts the billed tokens of the request that took the cost past the amount and of every request that ended after it. `enforcement_grade` is the weakest grade of the figures, so a cap is never shown as held more firmly than it was.

The cap is not the policy's budget. The policy reads its budget from `costroid.yml`, and `policy.results` states it as `limit_usd` beside the rule `run_budget`. Either can be present without the other.

## The check run id

The report creates the check run, then writes the check run's id into the check run's own object as `check_run_id`. The comment's copy names it as well. When that second write fails, the check run's object has no `check_run_id` and the comment's copy still names it.

## Reasons

When `state` is not `reported`, `figures` is empty, `rows` is `0` and `reason` is one of `no_rows_file`, `empty_rows_file`, `rows_path_not_a_file`, `rows_file_unread`, `invalid_row`, `fork_no_rows` or `agent_skipped`. `fork_no_rows` is a fork's pull request whose workflow run left no rows file, as the follow-up that posts its check finds it. `agent_skipped` is a pull request whose agent job the CI system skipped, as the report was told. `reason_line` names the line of an `invalid_row`.

`run_reason` says why the run wrote no rows, when the run stated why: `no_usage` when the agent ended and reported no usage, `concurrent_run` when another run held the agent's state directory and this run never started its agent, `reader_refused` when the reader refused the agent's stream or its execution file, `agent_error` when the agent ended with an error and wrote no rows, `artifact_refused` when the report refused the artifact that carried the rows, because it held an entry besides the rows file and the run's object. The report states `artifact_refused` itself, and no release writes it yet. It appears only when `state` is not `reported`. `costroid run` and `costroid ingest-run` write their object beside the rows file they created, and the report reads `run_reason` from that object. A report from an older release ignores a `run_reason` it does not know.

`reader_error` is the reader's first error line, beside `reader_refused` and nowhere else. The error can quote the agent's stream, so every character outside letters, digits, the space and `.,:;()'=_/+-` is replaced by `?`, and the line is cut at 160 bytes. The comment shows it inside a code span.

## The agent's end

`agent_error` is null, or the class of error the agent ended with: `authentication_failed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error` or `unknown`. The class is read from the agent's own result fields, never from its text, so the object carries no word the agent wrote. An agent can fail after some requests, so `agent_error` can sit beside figures. When the rows file holds no rows, `agent_error` comes with the run reason `agent_error`, and the run reason `agent_error` always comes with a class.

`agent_skipped` is null when the report was not told the agent job's result, `false` when it was told the job ran, and `true` when the CI system skipped the job. `true` comes only with the reason `agent_skipped`, and no run reason, because no run took place.

## The CI run

`ci_run` is the CI run that wrote the object, as `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT` state it: `{"id": 19203384756, "attempt": 1}`. It is a claim the environment makes, and nothing verifies it. It is null when the environment names no run, and on every CI system other than GitHub Actions in this version.

## Estimates

`estimates` holds the figures of the estimate rows, apart from `figures`: `{"source": "infrastructure", "currency": "EUR", "charge_period_start": "2026-12-01T00:00:00Z", "charge_period_end": "2027-01-01T00:00:00Z", "cost_basis": "estimate", "list_cost": "25.488", "rows": 1}`. An estimate row states a cost source, names no agent and states the basis `estimate`, as each row `costroid ingest-run --from focus` writes from a workflow's own FOCUS cost file does. A row is an agent's when it names an agent, with the tag `costroid/agent`, or states no cost source.

Each entry is the exact sum of `ListCost` over the estimate rows that share a currency, a source and a charge period. `source` is the rows' `costroid/cost_source`. `charge_period_start` and `charge_period_end` are the period the rows state, in UTC to the second, the end exclusive. `cost_basis` is always `estimate`. A row that states a cost source and names no agent at another basis is no estimate: the comment states it, and `estimates` does not. Entries are sorted by currency, then period and source. `estimates` holds at most 20 figures, and `estimates_omitted` counts the rest.

An estimate the workflow named with `ingest-run --optional` that was not there is one entry after the figures, with its source and a reason from a closed list: `{"source": "infrastructure", "reason": "no_file"}`. `no_file` says the file was not there, because the step that writes it did not run or wrote nothing, as on a fork's pull request that gets no secret. The entry carries no amount, no currency and no period. An object holds at most one.

`rows`, `figures`, `cap`, `lifetime`, `policy` and every other field read the agent's rows alone, as in version 0.9. Costroid never adds an estimate to a figure, a cap, a pull request's total or a budget, never compares the two, and never adds one currency to another. A reader adds two estimates only when their currency and charge period match.

A copy that withholds amounts states each figure's source, currency, period, basis and rows, without `list_cost`.

## The policy

`policy` is present when a policy ran, and `conclusion` names the check's conclusion. `policy.conclusion` is `success`, `neutral` or `failure`. Each entry of `policy.results` names a rule from a closed list: `run_budget`, `run_cost_threshold`, `run_increase`, `run_increase_percent`, `run_p95`, `pr_budget`, `monthly_budget`, `model_allowlist`, `attribution` and `customer_pack`. `limit_usd`, `cost_usd`, `baseline_usd` and `p95_usd` are amounts in USD, and the comment's copy drops them when it withholds amounts. Under `pr_budget`, `cost_usd` is the pull request's total in USD, this run included. `limit_percent` is the increase over the baseline in percent, and `models` names at most 10 models outside `policy.models`. `policy.trust` is `unverified` for rows a file in the agent's own job wrote, and `token_verified` for rows whose run identity was checked against the job's OIDC token. A budget rule never concludes `success` on `unverified` rows. `pack_sha256` and `config_sha256` name the rules and the `costroid.yml` the verdict came from, and `config_ref` the commit that file was read at: the head of the pull request's base branch when the report ran, or the event's base commit when that head could not be read. `warn_only` says whether the warn-only period held a failure back.

## The P95 limit

`run_p95` holds a run to a multiple of the P95 of the agent's earlier runs. It runs only when `costroid.yml` sets `policy.max_p95_factor`, a decimal of at least 1. Beside `cost_usd`, its result carries three keys that no other rule's does:

```json
{
  "rule": "run_p95",
  "outcome": "fail",
  "reason": "over_baseline",
  "cost_usd": "0.001619725",
  "p95_usd": "0.0006",
  "limit_factor": "1.5",
  "baseline_runs": 20
}
```

`cost_usd` is the run's cost in USD. `p95_usd` is the nearest-rank P95, in USD, of the agent's latest 20 runs on pull requests merged into the base branch. The pull request's own runs never count. `limit_factor` is `policy.max_p95_factor`, at least 1 and below 10,000, written in its shortest form, so `1.50` reads `1.5`, and `baseline_runs` the number of runs the baseline holds. A run that costs more than `p95_usd` times `limit_factor` fails with `over_baseline`, or warns with `held_by_warn_only` while the warn-only period runs. The object states the P95 and the factor, never their product, whose scale can pass the 12 fractional digits an amount holds.

The rule needs all 20 runs. With fewer, the nearest-rank P95 is the highest cost, so one costly run would set the limit. Below 20 runs the rule does not run: it is `unproven` with `no_baseline`, `baseline_runs` counts the runs it found, and there is no `p95_usd`. Beside a `p95_usd`, `baseline_runs` is 20.

A run within the limit passes, with `within_limit`, only when the rows and the baseline are both `token_verified`. Otherwise it is `unproven`, never `pass`. Any job of the repository can post a check run named `costroid`, so a baseline read from check runs is a claim, as `lifetime` is.

## The policy pack

`policy_pack` in `costroid.yml` names one Rego file in the repository, such as `policy_pack: .costroid/policy.rego`. Costroid reads it at `config_ref`, the commit it read `costroid.yml` at, so a pull request cannot change the pack that judges it. `policy.pack` names the file and holds what the pack returned:

```json
{
  "path": ".costroid/policy.rego",
  "sha256": "fd234a9085f3d8c077d02dc60067ae40824b66a8d8155a9d9df38dd635cbf218",
  "results": [
    {
      "rule": "no_opus_on_docs",
      "outcome": "fail",
      "reason": "model_on_docs_change",
      "message": "Opus models are not used on a change to docs/ alone."
    }
  ]
}
```

`path` is relative to the repository's root, has no `.` or `..` segment, ends `.rego` and is at most 256 characters. `sha256` is the SHA-256 of the bytes read, and of zero bytes when none were, as `config_sha256` is. `pack_sha256` keeps its meaning: it names Costroid's own rules.

A pack's results sit in their own array, `pack.results`, and never in `policy.results`. So the closed lists stay closed: `policy.results` names only the rules and reasons this page lists, and a reader that switches on them meets no id a release has not listed. A pack rule named `run_budget` is still the pack's, because of where it sits.

Each pack result holds the pack's own `rule` and `reason`: a lower-case letter, then at most 62 lower-case letters, digits and underscores. `outcome` is `warn` or `fail`. A pack has no word for pass, and a result that states another outcome faults the pack. `message` is optional text from the pack: every character outside letters, digits, the space and `.,:;()'=_/+-` is replaced by `?`, the text is cut at 160 bytes, and the comment shows it inside a code span. `held_by_warn_only` is `true` on a pack's `fail` that the warn-only period held to `warn`. `pack.results` holds at most 32.

A pack only adds warnings and failures. Its results can move the conclusion up the order `success`, `neutral`, `failure`, never down, and no pack result changes an entry of `policy.results`.

When the pack did not run to its end, `policy.results` holds one result of the rule `customer_pack` that says why, and `pack.results` is empty:

| `reason`       | `outcome`                                                          | When                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack_unread`  | `unproven`                                                         | The file is absent or too large, or the host did not answer.                                                                                                          |
| `pack_invalid` | `unproven`                                                         | The file does not parse or compile, calls a built-in a pack may not call, or declares a package other than `costroid.pack`. `line` names the line the compiler named. |
| `pack_bound`   | `fail`, or `warn` with `held_by_warn_only` in the warn-only period | The pack passed its evaluation bound or its deadline, the rows passed the input it accepts, or it returned more than 32 results.                                      |
| `pack_result`  | `fail`, or `warn` with `held_by_warn_only` in the warn-only period | A result has another outcome, a field that is not a string, or an id outside the pattern.                                                                             |

The first two are faults the base branch alone can cause, so the rule is `unproven` and the check concludes `neutral`, or `failure` when another rule fails. The last two are faults the pull request's rows can cause, so they fail the check: a rows file built to stall the pack, or to run it past its deadline, cannot turn a failing run into a neutral one. A `customer_pack` result carries no amount.

## A reader of 0.11

What a reader of version 0.11 or 0.10 does with a version 0.12 object:

| Reader                                                       | What it does                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Any reader, on a report that holds no pack                   | Sees no 0.12 object. The report writes 0.11, 0.10 or 0.9, as before.                                                                                                                                                                                         |
| A validator of the 0.11 or 0.10 schema                       | Refuses the object whole at `schema`. It never reads half of one.                                                                                                                                                                                            |
| An earlier Costroid adding up a pull request's total         | Refuses the unknown schema. The check run counts in `lifetime.unread`, and joins no total and no baseline. A total that leaves a report out can only read low.                                                                                               |
| An earlier `costroid approve`                                | Refuses the object and posts nothing. The check stays `failure`.                                                                                                                                                                                             |
| A reader that ignores `schema` and reads the fields it knows | `conclusion` and `policy.conclusion` keep their three values and already hold the pack's effect. `policy.results` can hold a rule it does not know, `customer_pack`, with four reasons and a `line` it does not know. `pack` is a property it does not read. |

## The agent's own figure

`agent_stated` is a figure the agent stated about its own run, in the agent's own unit: `{"unit": "AIC", "quantity": "7.47", "source": "gh-aw"}`. It is null when the agent stated none, and in a copy that withholds amounts.

Three agents state one, each in one unit:

| `source`   | `unit`     | What the agent states                                                                                                                                                                                                                                                                           |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gh-aw`    | `AIC`      | Its AI credits: the last `ai_credits_total` of the agent job's token-usage records, added to the last of the threat detection job's. gh-aw prices its credits itself. When the threat detection job made requests and states no credits, the run's total is unknown and `agent_stated` is null. |
| `opencode` | `USD`      | Its own price for the run: the `part.cost` of each `step_finish` line it printed, added up. OpenCode prices each step from its own price list. When a step states no cost as a number, `agent_stated` is null.                                                                                  |
| `copilot`  | `nano-AIU` | The `totalNanoAiu` of its `session.shutdown` event, as it wrote it, `0` included. When the session file holds no `session.shutdown`, `agent_stated` is null.                                                                                                                                    |

Costroid never converts a stated figure, never adds it to an amount in `figures`, `cap` or `lifetime`, never compares it with one, and keeps every digit the agent wrote. OpenCode's figure is in USD and still is not Costroid's figure: a reader never adds it to an entry of `figures` in USD and never sets the two against each other.

Copilot CLI's recorded run on the user's own provider key stated `0`, and each of its requests stated an `aiCreditsStatus` of `unavailable`. Copilot's own types define that as "No AI-credit amount was reported for the observed calls. Numeric zero is not a zero-cost claim." (`dist/generated/session-events.d.ts` in `@github/copilot-sdk` 1.0.26, the release for Copilot CLI 1.0.103, read 2026-11-09).

`unit` and `source` are closed lists, and each source states one unit: `gh-aw` in `AIC`, `opencode` in `USD`, `copilot` in `nano-AIU`. `quantity` is a decimal string, never a JSON number.

## A recorded run

`recorded` names a run recorded earlier whose rows the figures are, in place of the pull request's own: `{"run_id": 42368537950, "date": "2026-11-07"}`. `run_id` is the CI run that wrote the rows, `GITHUB_RUN_ID` on GitHub Actions, and `date` the day it was recorded, as `YYYY-MM-DD`. `costroid report --recorded` writes it, and the check, the comment and the job summary then open with a line that says the figures are that run's, not the pull request's. It is null on every other report.

A recorded run spent nothing on the pull request, so a reader never adds its figures to the pull request's: `lifetime` is null beside it, and the pull request's total leaves such a report out. A copy that withholds amounts states `recorded` too, because it is no amount.

## Changes from 0.11

- `policy.pack` is new. It names the repository's own policy pack and holds the pack's results, at most 32, apart from `policy.results`.
- `policy.results` admits the rule `customer_pack` and four reasons, `pack_unread`, `pack_invalid`, `pack_bound` and `pack_result`, which appear under `customer_pack` alone, and `line` beside `pack_invalid`.
- A version 0.12 object holds `policy.pack`. A report with no pack writes 0.11, 0.10 or 0.9.
- No field of 0.11 changes its meaning.
