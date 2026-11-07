# Costroid result object, version 0.5

One object per Costroid report: the figures of one run per currency and basis, the token counts by class, the grades, the cap the run was given and what is left or over, and a reason when there are no figures. The schema is [`result.schema.json`](result.schema.json).

`costroid run --json` and `costroid report --json` print it. The check run named `costroid` carries the same object in its output text, inside one fenced `json` block, and the pull request comment carries a copy. The object's `schema` field reads `costroid.result/0.5`.

The figures in `claude-code-under-its-cap.json` and `codex-stopped-past-its-cap.json` are recorded runs. The other figures, and every commit, check run, credential and policy hash, are synthetic. `policy-failed-past-its-budget.json` is the Codex recording with a synthetic verdict, and `rate-limited-beside-figures.json` is the Claude Code recording with a synthetic agent error.

## Figures are never summed across a currency or a basis

Each entry of `figures` is one currency, one cost basis, one attribution grade and one enforcement grade. Amounts and token counts are decimal strings, never JSON numbers. A reader adds two entries only when their `currency` and `cost_basis` match.

`tokens` holds every class the figure's rows name, with the values of the `SkuMeter` column of [`focus-row/v0.3`](../../focus-row/v0.3/README.md). `reasoning_output` and `cached_input_reported` repeat tokens that `output` and `cache_read` count.

## Copies that withhold

`amounts` reads `shown` in the check run's object and in what both commands print. The comment's copy reads `withheld` on a public repository whose `costroid.yml` sets `comment.show_cost: false`, or when that setting cannot be read. A withheld copy carries no `list_cost`, no `tokens` and a null `cap`.

## The cap

`cap` is the cap the run was given, as the report was told it. It is stated in USD, never in turns. It is compared with one figure: the figures in USD, when they share one basis. `remainder` is the amount minus the cost and `overshoot` the cost minus the amount, and one of them is `0`. `overshoot_tokens` counts the billed tokens of the request that took the cost past the amount and of every request that ended after it. `enforcement_grade` is the weakest grade of the figures, so a cap is never shown as held more firmly than it was.

The cap is not the policy's budget. The policy reads its budget from `costroid.yml`, and `policy.results` states it as `limit_usd` beside the rule `run_budget`. Either can be present without the other.

## The check run id

The report creates the check run, then writes the check run's id into the check run's own object as `check_run_id`. The comment's copy names it as well. When that second write fails, the check run's object has no `check_run_id` and the comment's copy still names it.

## Reasons

When `state` is not `reported`, `figures` is empty, `rows` is `0` and `reason` is one of `no_rows_file`, `empty_rows_file`, `rows_path_not_a_file`, `rows_file_unread`, `invalid_row`, `fork_no_rows` or `agent_skipped`. `fork_no_rows` is a fork's pull request whose workflow run left no rows file, as the follow-up that posts its check finds it. `agent_skipped` is a pull request whose agent job the CI system skipped, as the report was told. `reason_line` names the line of an `invalid_row`.

`run_reason` says why the run wrote no rows, when the run stated why: `no_usage` when the agent ended and reported no usage, `concurrent_run` when another run held the agent's state directory and this run never started its agent, `reader_refused` when the reader refused the agent's stream or its execution file, `agent_error` when the agent ended with an error and wrote no rows. It appears only when `state` is not `reported`. `costroid run` and `costroid ingest-run` write their object beside the rows file they created, and the report reads `run_reason` from that object. A report from an older release ignores a `run_reason` it does not know.

`reader_error` is the reader's first error line, beside `reader_refused` and nowhere else. The error can quote the agent's stream, so every character outside letters, digits, the space and `.,:;()'=_/+-` is replaced by `?`, and the line is cut at 160 bytes. The comment shows it inside a code span.

## The agent's end

`agent_error` is null, or the class of error the agent ended with: `authentication_failed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error` or `unknown`. The class is read from the agent's own result fields, never from its text, so the object carries no word the agent wrote. An agent can fail after some requests, so `agent_error` can sit beside figures. When the rows file holds no rows, `agent_error` comes with the run reason `agent_error`, and the run reason `agent_error` always comes with a class.

`agent_skipped` is null when the report was not told the agent job's result, `false` when it was told the job ran, and `true` when the CI system skipped the job. `true` comes only with the reason `agent_skipped`, and no run reason, because no run took place.

## The CI run

`ci_run` is the CI run that wrote the object, as `GITHUB_RUN_ID` and `GITHUB_RUN_ATTEMPT` state it: `{"id": 19203384756, "attempt": 1}`. It is a claim the environment makes, and nothing verifies it. It is null when the environment names no run, and on every CI system other than GitHub Actions in this version.

## The policy

`policy` is present when a policy ran, and `conclusion` names the check's conclusion. `policy.conclusion` is `success`, `neutral` or `failure`. `policy.trust` is `unverified` for rows a file in the agent's own job wrote, and `token_verified` for rows whose run identity was checked against the job's OIDC token. A budget rule never concludes `success` on `unverified` rows. `pack_sha256` and `config_sha256` name the rules and the `costroid.yml` the verdict came from, and `config_ref` the commit that file was read at: the head of the pull request's base branch when the report ran, or the event's base commit when that head could not be read. `warn_only` says whether the warn-only period held a failure back.

## Changes from 0.4

- `agent_error`, `agent_skipped` and `ci_run` are new. Each is present in every object, and null when nothing stated it.
- `reason` adds `agent_skipped`.
- `run_reason` adds `agent_error`.
