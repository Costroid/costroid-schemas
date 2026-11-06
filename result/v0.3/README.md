# Costroid result object, version 0.3

One object per Costroid report: the figures of one run per currency and basis, the token counts by class, the grades, the cap the run was given and what is left or over, and a reason when there are no figures. The schema is [`result.schema.json`](result.schema.json).

`costroid run --json` and `costroid report --json` print it. The check run named `costroid` carries the same object in its output text, inside one fenced `json` block, and the pull request comment carries a copy. The object's `schema` field reads `costroid.result/0.3`.

The figures in `claude-code-under-its-cap.json` and `codex-stopped-past-its-cap.json` are recorded runs. The other figures, and every commit, check run, credential and policy hash, are synthetic. `policy-failed-past-its-budget.json` is the Codex recording with a synthetic verdict.

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

When `state` is not `reported`, `figures` is empty, `rows` is `0` and `reason` is one of `no_rows_file`, `empty_rows_file`, `rows_path_not_a_file`, `rows_file_unread` or `invalid_row`. `reason_line` names the line of an `invalid_row`.

`run_reason` says why the run wrote no rows, when the run stated why: `no_usage` when the agent ended and reported no usage, `concurrent_run` when another run held the agent's state directory and this run never started its agent. It appears only when `state` is not `reported`. `costroid run` writes its object beside the rows file it wrote, and the report reads `run_reason` from that object. A report from an older release ignores a `run_reason` it does not know.

## The policy

`policy` is present when a policy ran, and `conclusion` names the check's conclusion. `policy.conclusion` is `success`, `neutral` or `failure`. `policy.trust` is `unverified` for rows a file in the agent's own job wrote, and `token_verified` for rows whose run identity was checked against the job's OIDC token. A budget rule never concludes `success` on `unverified` rows. `pack_sha256` and `config_sha256` name the rules and the `costroid.yml` the verdict came from, and `config_ref` the base commit that file was read at. `warn_only` says whether the warn-only period held a failure back.

## Changes from 0.2

- `budget` is renamed `cap`, so the run's cap and the policy's budget never share a name.
- The check run's own object carries `check_run_id`.
- `run_reason` is new.
