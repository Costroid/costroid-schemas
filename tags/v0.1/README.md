# Per-PR tag convention, version 0.1

These tags join a FOCUS row to the pull request that caused it. They sit in the FOCUS `Tags` column. The schema is [`tags.schema.json`](tags.schema.json).

All names and figures in `examples/` are synthetic.

## The prefix

Every key starts with `costroid/`.

FOCUS 1.4 requires a provider-defined tag key to carry "a predetermined, provider-specified tag key prefix" and says that prefix should be publicly documented ([Tags, FOCUS 1.4](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.4/specification/datasets/cost_and_usage/columns/tags.md), retrieved 2026-11-01). This section is that documentation. The slash follows the example in the same document.

The prefix is reserved. A key under `costroid/` that this version does not define is rejected. A key without the prefix is a user-defined tag and passes through, with a string, number, boolean or null value. The hosted ingest path, `costroid serve`, is the exception. It drops every key outside the prefix before storage and counts it by name, because a free-form key and value are where content would hide.

A proposal to FOCUS for a neutral prefix would be a new version of this convention.

## The tags

Every value is a string. A tag with no value is omitted, never written as null or as a placeholder.

| Key                          | Required on                 | Value                                                   |
| ---------------------------- | --------------------------- | ------------------------------------------------------- |
| `costroid/repo`              | `exact` and `windowed` rows | Host and path, no scheme: `github.com/example/widgets`  |
| `costroid/pr`                | `exact` rows                | The pull request number                                 |
| `costroid/commit_sha`        | `exact` rows                | The full head commit, lower case                        |
| `costroid/workflow_run_id`   | `exact` rows                | The CI run                                              |
| `costroid/session_id`        | never                       | The agent session                                       |
| `costroid/agent`             | model request rows          | `claude-code`, `codex`, `copilot`, `cursor`, `opencode` |
| `costroid/agent_version`     | never                       | The agent's own version string                          |
| `costroid/model`             | model request rows          | The model that served the request                       |
| `costroid/cost_source`       | every row                   | What produced the figure                                |
| `costroid/cost_basis`        | every row                   | Closed, below                                           |
| `costroid/attribution_grade` | every row                   | Closed, below                                           |
| `costroid/enforcement_grade` | every row                   | Closed, below                                           |
| `costroid/run_identity`      | every row                   | Closed, below                                           |

`costroid/cost_source` is open, because the ledger does not know what kind of cost a row carries. This version defines `agent_stream` (the wrapper read the agent's own result stream), `agent_session_file` (the wrapper read the session or rollout file the agent wrote), `otlp` (the OTLP endpoint) and `provider_report` (the provider's usage or cost report). An adapter names itself.

## Closed vocabularies

### `costroid/cost_basis`

| Value             | Label           | The figure is                                                                                                                         |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `measured`        | Measured        | Agent-reported tokens times the pinned catalog at list                                                                                |
| `list_equivalent` | List-equivalent | Tokens of an agent billed by seat or credit, times the published API rate. No invoice exists, and the figure is never shown as billed |
| `estimate`        | Estimate        | A call-site inventory times assumptions, or an infrastructure estimator's output                                                      |
| `billed`          | Billed          | The provider's figure from its usage and cost report                                                                                  |
| `derived`         | Derived         | Tokens times a rate derived from GPU cost and measured throughput                                                                     |

### `costroid/attribution_grade`

A grade is a property of the join, not of the agent.

| Value          | The join                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `exact`        | A credential the wrapper controls ties the tokens to the pull request, and the provider's report can be filtered by it |
| `windowed`     | Actor, time window and repository are the only join                                                                    |
| `unattributed` | Anything else, including every row whose run identity was not token-verified                                           |

### `costroid/enforcement_grade`

A grade is never shown as stronger than it is. A gateway limit that fails open on store errors is recorded as `none` for that run.

| Value              | What held the run to its budget                                                       |
| ------------------ | ------------------------------------------------------------------------------------- |
| `gateway-precheck` | A per-job virtual key, checked before each request. The overshoot bound is on the row |
| `agent-flag`       | The agent's own budget flag, a client-side estimate that can pass the cap             |
| `wrapper-watchdog` | The wrapper priced the agent's event stream and stops the process at the cap          |
| `provider`         | Only the vendor's budget applies                                                      |
| `none`             | Nothing                                                                               |

### `costroid/run_identity`

| Value            | Meaning                                                  |
| ---------------- | -------------------------------------------------------- |
| `token_verified` | The run identity came from the CI system's OIDC ID token |
| `unverified`     | It did not                                               |

`unverified` forces `costroid/attribution_grade` to `unattributed`. The schema enforces this.

## Mapping to OpenTelemetry

Stability is as stated in the OpenTelemetry registries retrieved on 2026-11-01: [`vcs`](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/registry/attributes/vcs.md) and [`cicd`](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/docs/registry/attributes/cicd.md) at release v1.44.0, and [`gen_ai`](https://github.com/open-telemetry/semantic-conventions-genai/blob/244465e94b9d7167fa5ed5c31a4b2b49ab6ddee5/docs/registry/attributes/gen-ai.md) at commit `244465e`. The `gen_ai` namespace moved to its own repository, which has no tagged release yet. Release v1.44.0 of the main repository marks those attributes deprecated with a pointer to the move.

| Tag                        | OpenTelemetry attribute                              | Stability         | Conversion                 |
| -------------------------- | ---------------------------------------------------- | ----------------- | -------------------------- |
| `costroid/repo`            | `vcs.repository.url.full`                            | Release Candidate | The URL without its scheme |
| `costroid/pr`              | `vcs.change.id`                                      | Release Candidate | None                       |
| `costroid/commit_sha`      | `vcs.ref.head.revision`                              | Release Candidate | None                       |
| `costroid/workflow_run_id` | `cicd.pipeline.run.id`                               | Release Candidate | None                       |
| `costroid/session_id`      | `gen_ai.conversation.id`, then `session.id`          | Development       | None                       |
| `costroid/agent`           | `gen_ai.agent.name`                                  | Development       | Lower-case kebab           |
| `costroid/agent_version`   | `gen_ai.agent.version`                               | Development       | None                       |
| `costroid/model`           | `gen_ai.response.model`, then `gen_ai.request.model` | Development       | None                       |

The wrapper also sets `vcs.ref.base.revision` and `cicd.pipeline.task.run.id` on telemetry. They are join keys for telemetry and have no tag in this version.

`costroid/cost_source`, `costroid/cost_basis`, the two grades and `costroid/run_identity` have no OpenTelemetry attribute. They are facts about the ledger, not about the request.
