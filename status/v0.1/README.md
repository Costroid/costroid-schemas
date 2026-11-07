# Costroid status file, version 0.1

What one `costroid run` has spent so far, its cap, what is left and what holds it, written while the agent works. The agent, or a later step of the job, reads it to learn what the run costs before the run ends. The schema is [`status.schema.json`](status.schema.json), and every file's `schema` field reads `costroid.status/0.1`.

The file is a view of a run in progress. The run's result object, [`result/v0.6`](../../result/v0.6/README.md), states what the run came to once it has ended.

## Where the file is

`costroid run` writes the file at `$COSTROID_STATUS_FILE`. When that is unset, it writes `$RUNNER_TEMP/costroid-status.json`. GitHub Actions empties `RUNNER_TEMP` at the beginning and end of each job ([variables reference](https://docs.github.com/en/actions/reference/workflows-and-actions/variables), retrieved 2026-11-07). When neither is set, no file is written.

## When it is written

The run writes the file when it reads the agent's first line, after each request it sees settle while it watches the agent, and when the agent ends. Each write replaces the whole file: the run writes a new file in the same directory and renames it over the old one, so a reader finds the last whole status or none.

No file means no run has started an agent in this job. A file that reads `running`, with an empty `spend` and `requests` at `0`, is a run that has priced nothing yet. A file that reads `ended` the same way is a run that spent nothing.

## What it holds

| Field               | Value                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `state`             | `running` while the agent works, `ended` once it has exited and its usage has been read                                           |
| `agent`             | `claude-code` or `codex`                                                                                                          |
| `updates`           | `each_request` when the spend is priced after each request settles, `agent_end` when the agent states its usage only when it ends |
| `started_at`        | When the run started, in UTC                                                                                                      |
| `updated_at`        | When the file was last written, in UTC                                                                                            |
| `spend`             | One entry per currency and basis, at the catalog's list prices, or null when the spend is not known                               |
| `requests`          | The model requests priced so far, or null when spend is null or the agent states some usage as a turn's or a run's total          |
| `cap`               | The cap the run was given, in USD, with `remainder` and `overshoot` beside the spend in USD                                       |
| `enforcement_grade` | What holds the run to its cap: `gateway-precheck`, `agent-flag`, `wrapper-watchdog` or `none`                                     |

`spend` is null while the agent works under `agent_end`, because the agent has not stated its usage. It is also null when the run's reader refused the agent's usage. Entries are never added across a currency or a basis. Amounts are decimal strings, never JSON numbers.

`cost_basis` is `measured` for an API key's usage, and `list_equivalent` for a subscription's usage at list price, which nobody billed. It is null while Codex works, because its reader states the basis when Codex ends.

`remainder` is the cap minus the spend in USD, and `overshoot` the spend minus the cap; one of them is `0`. A run with no spend in USD has spent `0`. Both are null when the spend is not known, and when the spend in USD holds two entries, because no one figure then compares with the cap. The cap is not the policy's budget.

`enforcement_grade` is the grade the run started at while the agent works, then the one the agent's reader stated when the agent ended. The run's last write states the grade the run earned once its rows were checked, which its result object states too. A gateway whose store failed, or a run past its overshoot bound, reads `none` there.

## What it never holds

The file holds amounts, counts, times and words from closed lists. It never holds a prompt, a path, a model name or the model's answer, and the schema refuses any field it does not name.

## Examples

The figures in `codex-before-its-first-request.json`, `codex-after-its-first-request.json`, `codex-ended-under-its-cap.json` and `codex-stopped-past-its-cap.json` are a recorded Codex run, priced at catalog 0.1.0. The figure in `claude-code-ended.json` is a recorded Claude Code run with a subagent, priced the same way. Every time, and every figure in `two-bases-in-usd.json`, is synthetic.
