# Costroid result object, version 0.9

One object per Costroid report: the figures of one run per currency and basis, the token counts by class, the grades, the cap the run was given and what is left or over, the digests of the rows, the pull request's total, the agent's own figure in its own unit, the recorded run a report shows in place of the pull request's own, and a reason when there are no figures. The schema is [`result.schema.json`](result.schema.json).

`costroid run --json` and `costroid report --json` print it. The check run named `costroid` carries the same object in its output text, inside one fenced `json` block, and the pull request comment carries a copy. The object's `schema` field reads `costroid.result/0.9`.

The figures in `claude-code-under-its-cap.json` and `codex-stopped-past-its-cap.json` are recorded runs, and their `rows_sha256` and `rows_file_sha256` are those of the recorded rows files. The other figures, and every commit, check run, credential and policy hash, are synthetic. `policy-failed-past-its-budget.json` is the Codex recording with a synthetic verdict, and `rate-limited-beside-figures.json` is the Claude Code recording with a synthetic agent error. `pull-request-over-its-budget.json` and `lifetime-that-may-repeat.json` set the recordings beside synthetic earlier reports. `gh-aw-with-its-own-credits.json` is the object `costroid ingest-run` writes for a gh-aw usage artifact written by hand. `recorded-run-on-a-fork.json` is the object `costroid report --recorded` writes for the rows of workflow run 42368537950, recorded on 2026-11-07, on a synthetic fork's pull request. `opencode-with-its-own-price.json` and `copilot-with-its-own-credits.json` are the objects `costroid run --json` writes when it replays the recorded runs of OpenCode 1.19.4, workflow run 42629412567, and Copilot CLI 1.0.103, workflow run 42629874786, both of 2026-11-09, through a stand-in that prints each recording. Their digests are those of the rows files the replays wrote.

## Figures are never summed across a currency or a basis

Each entry of `figures` is one currency, one cost basis, one attribution grade and one enforcement grade. Amounts and token counts are decimal strings, never JSON numbers. A reader adds two entries only when their `currency` and `cost_basis` match.

`tokens` holds every class the figure's rows name, with the values of the `SkuMeter` column of [`focus-row/v0.3`](../../focus-row/v0.3/README.md). `reasoning_output` and `cached_input_reported` repeat tokens that `output` and `cache_read` count.

## The rows

`rows_sha256` names the rows the figures were built from: the SHA-256 of each row's `x_CostroidRowId`, sorted by byte, each followed by a line feed, as lower-case hex. Two objects with the same `rows_sha256` report the same rows, whatever order or line endings their files gave them. It is null when there are no figures, and when a row names no `x_CostroidRowId` of 64 lower-case hex digits.

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

## The policy

`policy` is present when a policy ran, and `conclusion` names the check's conclusion. `policy.conclusion` is `success`, `neutral` or `failure`. Each entry of `policy.results` names a rule from a closed list: `run_budget`, `run_cost_threshold`, `run_increase`, `run_increase_percent`, `pr_budget`, `monthly_budget`, `model_allowlist` and `attribution`. `limit_usd`, `cost_usd` and `baseline_usd` are amounts in USD. Under `pr_budget`, `cost_usd` is the pull request's total in USD, this run included. `limit_percent` is the increase over the baseline in percent, and `models` names at most 10 models outside `policy.models`. `policy.trust` is `unverified` for rows a file in the agent's own job wrote, and `token_verified` for rows whose run identity was checked against the job's OIDC token. A budget rule never concludes `success` on `unverified` rows. `pack_sha256` and `config_sha256` name the rules and the `costroid.yml` the verdict came from, and `config_ref` the commit that file was read at: the head of the pull request's base branch when the report ran, or the event's base commit when that head could not be read. `warn_only` says whether the warn-only period held a failure back.

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

## Changes from 0.8

- `agent_stated` takes two more sources: `opencode`, in `USD`, and `copilot`, in `nano-AIU`. Each source states one unit.
- No field is new. An object of 0.8 holds to 0.9 once its `schema` reads `costroid.result/0.9`.
