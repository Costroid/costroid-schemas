# Costroid result object, version 0.14

One object per Costroid report: the figures of one run per currency and basis, the token counts by class, the grades, the cap the run was given and what is left or over, the digests of the rows, the pull request's total, the agent's own figure in its own unit, the recorded run a report shows in place of the pull request's own, the infrastructure estimates a workflow added beside the agent's rows, the P95 limit, the repository's own policy pack and its results, the developer-machine sessions the pull request's author stated in a receipt, a rule demoted by its override rate, and a reason when there are no figures. The schema is [`result.schema.json`](result.schema.json).

`costroid run --json` and `costroid report --json` print it. The check run named `costroid` carries the same object in its output text, inside one fenced `json` block, and the pull request comment carries a copy. The object's `schema` field reads `costroid.result/0.14`.

A report writes version 0.14 only when its object holds something version 0.13 cannot: a result with `demoted`, which only a verdict read from a ledger holds. A report with no demoted rule writes [`result/v0.13`](../v0.13/README.md) when it holds a receipt, [`result/v0.12`](../v0.12/README.md) when it holds a pack, [`result/v0.11`](../v0.11/README.md) when it holds a `run_p95` result, and otherwise [`result/v0.10`](../v0.10/README.md) when it states an estimate and [`result/v0.9`](../v0.9/README.md) when it does not, as before. So a reader of any of those reads every report without a demoted rule as it did. A version 0.14 object holds a receipt, a pack, a `run_p95` result or an estimate only when the report does, and holds `estimates` and `estimates_omitted` together or not at all.

The examples are the objects the check run carries for the Claude Code recording in [`infrastructure-beside-the-agent.json`](../v0.10/examples/infrastructure-beside-the-agent.json), priced at catalog 0.4.1, in synthetic reports that state no digest, each beside a synthetic policy: `rule-demoted.json` for a run budget demoted by its override rate, `demoted-beside-a-failing-rule.json` for a demoted P95 limit beside a run budget that fails, `demoted-in-the-warn-only-period.json` for a demoted run budget beside a P95 limit the warn-only period held back, and `demoted-in-a-withheld-copy.json` as the comment's copy of the first, which withholds amounts. Every commit, time, count and policy figure is synthetic.

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

`amounts` reads `shown` in the check run's object and in what both commands print. The comment's copy reads `withheld` on a public repository whose `costroid.yml` sets `comment.show_cost: false`, or when that setting cannot be read. A withheld copy carries no `list_cost`, no `tokens`, a null `cap`, a null `lifetime` and a null `agent_stated`. A receipt's figures in a withheld copy carry no `list_cost`. A demoted result keeps `demoted` in a withheld copy, because it holds counts and an instant, not an amount.

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

## Receipts

`receipts` holds the receipt the pull request's author posted as a comment, under [`receipt/v0.1`](../../receipt/v0.1/README.md), apart from `figures` and `estimates`. This is the entry of `receipt-beside-the-run.json`:

```json
{
  "comment": {
    "id": 2471000001,
    "created_at": "2026-11-20T16:42:07Z",
    "sha256": "09a3ca8ff98a5921fc951e52265e8de2ef3739115f1603dfc09c44171906df13"
  },
  "sessions": 2,
  "first_day": "2026-11-18",
  "last_day": "2026-11-20",
  "figures": [
    {
      "currency": "USD",
      "cost_basis": "list_equivalent",
      "list_cost": "11.4619213",
      "rows": 12
    }
  ]
}
```

A receipt states token counts and no price. The report prices the counts at the catalog its own binary loads, and builds rows from them that carry `costroid/origin` `developer_machine` under [`tags/v0.5`](../../tags/v0.5/README.md#costroidorigin). Each entry of `figures` is the exact sum of `ListCost` over those rows in one currency, and `rows` counts them. `cost_basis` is always `list_equivalent`, because a session file does not state how the session was billed. `sessions` counts the sessions the receipt states, and `first_day` and `last_day` are the first and last UTC day of its entries.

`comment` pins the comment the figures came from: its `id`, its `created_at` as the host states it, and `sha256`, the SHA-256 of its body, byte for byte, as the host returned it, in lower-case hex. A receipt posted, edited or deleted after a report leaves that report's object as it was. The next report reads the comments again. The object names no login.

The report reads the newest receipt the pull request's author posted, and no other account's. `receipts` holds at most one entry in this version.

A receipt the report refused is one entry with the comment and a reason from a closed list, and carries no amount and no sessions. This is the entry of `receipt-edited.json`:

```json
{
  "comment": {
    "id": 2471000001,
    "created_at": "2026-11-20T16:42:07Z",
    "sha256": "09a3ca8ff98a5921fc951e52265e8de2ef3739115f1603dfc09c44171906df13"
  },
  "reason": "receipt_edited"
}
```

| `reason`               | The report read none of the receipt's sessions, because                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `receipt_edited`       | The comment was edited after it was posted. A new count is a new comment                     |
| `receipt_other_branch` | The receipt names another branch than the pull request's                                     |
| `receipt_invalid`      | The comment is not a valid receipt under `receipt/v0.1`                                      |
| `receipts_off`         | `costroid.yml` on the base branch turns receipts off, so the report did not read the receipt |

`rows`, `figures`, `cap`, `lifetime`, `estimates` and `policy` read none of a receipt's rows, and neither `rows_sha256` nor `rows_file_sha256` names one, because the report writes those rows to no file. Costroid never adds a receipt's figure to a figure, a cap, a pull request's total or a budget, never compares the two, and never adds one currency to another. Nothing checked a receipt's counts, and a receipt is never evidence that a pull request was cheap: sessions it leaves out cannot be seen.

A copy that withholds amounts states each receipt's comment, sessions and days, and each figure's currency, basis and rows, without `list_cost`.

## A demoted rule

`demoted` marks a rule that warns where it would fail, because reviewers approved more than one in five of the pull requests it failed. This is the result of `rule-demoted.json`:

```json
{
  "rule": "run_budget",
  "outcome": "warn",
  "reason": "over_limit",
  "limit_usd": "0.001",
  "cost_usd": "0.001619725",
  "demoted": {
    "reason": "override_rate",
    "approved": 7,
    "failing": 20,
    "until": "2026-12-21T09:00:00Z"
  }
}
```

Demotion is the one step that lowers an outcome of Costroid's, and it lowers one only from `fail` to `warn`. A demoted result's `outcome` is `warn`. Its `reason` stays the rule's own, `over_limit` or `over_baseline`, so the result still says the run is over its limit. It never carries `held_by_warn_only`: demotion already made it a warning, so the warn-only period has nothing to hold back. `demoted-in-the-warn-only-period.json` shows the two side by side.

Only a rule that holds a cost to a limit can be demoted: `run_budget`, `run_cost_threshold`, `run_increase`, `run_increase_percent`, `run_p95` and `pr_budget`. `model_allowlist`, `customer_pack` and a pack's own results never are. Each rule is demoted on its own record, so a demoted rule can stand beside one that fails, as in `demoted-beside-a-failing-rule.json`.

`failing` counts the pull requests into one base branch on which the rule failed under its present limit: the latest 20 within 90 days since the rule was last re-armed. The record is kept per base branch, whose `costroid.yml` sets the limit, so a failure on a pull request into another branch neither counts nor re-arms the rule. `approved` counts those of them on which an approval was recorded for a head commit the rule failed on. A pull request counts once, however many pushes and approvals it had, and the pull request being judged never counts. The rule is demoted when `approved` times 5 is more than `failing`, with `failing` at least 10: 3 of 10 demotes, 2 of 10 does not, and 4 of 20 does not. The schema holds that rule for each value of `failing`, and holds `approved` at most `failing`. The approvals also come from at least 2 accounts, a count the object does not state. It names no approver.

`until` is when the demotion ends, in UTC: 30 days after the verdict that first crossed the threshold. The rule is re-armed then, or sooner when its limit changes on the base branch, because the record is of that limit. After a re-arm the window starts empty. `until` is after `policy.evaluated_at`: a demotion whose end has passed is no demotion, and the rule fails as written. JSON Schema cannot compare two instants, so [`validate.mjs`](../../scripts/validate.mjs) holds this for every version from 0.14 on. `reason` is a closed list of one, `override_rate`.

A demoted rule warns, and a warning never concludes `success`. Beside a demoted result, `conclusion` and `policy.conclusion` are `neutral` or `failure`, and `conclusion` is never null, because a demoted rule reaches only a check that has concluded.

Demotion is read from a ledger's own record of failing verdicts and approvals, and from nothing else. The record counts the pull requests on which the rule failed the check, never one on which the warn-only period held the failure to a warning: nothing failed there, so there was nothing to approve. Demotion is never read from check runs, because any job of the repository can post a check run named `costroid`, and a record a branch can write must never relax a rule. So an object written without a ledger never carries `demoted`, and no rule is demoted on a report that uses no account.

## A reader of 0.13

What a reader of version 0.13 or earlier does with a version 0.14 object:

| Reader                                                       | What it does                                                                                                                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any reader, on a report that holds no demoted rule           | Sees no 0.14 object. The report writes 0.13, 0.12, 0.11, 0.10 or 0.9, as before.                                                                                                                                            |
| A validator of the 0.13 schema or an earlier one             | Refuses the object whole at `schema`. It never reads half of one.                                                                                                                                                           |
| An earlier Costroid adding up a pull request's total         | Refuses the unknown schema. The check run counts in `lifetime.unread`, and joins no total and no baseline. A total that leaves a report out can only read low.                                                              |
| An earlier `costroid approve`                                | Refuses the object and posts nothing. A check that concluded `failure` stays `failure`.                                                                                                                                     |
| A reader that ignores `schema` and reads the fields it knows | `conclusion` and `policy.conclusion` keep their three values and already hold the demotion's effect. A demoted result reads as a `warn` with the rule's own reason, never a pass. `demoted` is a property it does not read. |

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

## Changes from 0.13

- An entry of `policy.results` admits `demoted`, with `reason` `override_rate`, `approved`, `failing` and `until`. It stands only on the `warn` of one of the six rules that hold a cost to a limit, with the rule's own reason, and never with `held_by_warn_only`.
- Beside a demoted result, `conclusion` and `policy.conclusion` are `neutral` or `failure`.
- A version 0.14 object holds a demoted result. A report with none writes 0.13, 0.12, 0.11, 0.10 or 0.9.
- A version 0.14 object holds `receipts` only when the report read a receipt.
- No field of 0.13 changes its meaning.
