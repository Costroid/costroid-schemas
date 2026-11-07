# Integration contract, version 0.2

How Costroid and Costroid Platform identify a tenant, authenticate, move FOCUS rows and report quotas. The contract is [`openapi.json`](openapi.json), OpenAPI 3.1. Both products implement it, and there is no second contract.

Version 0.2 is [version 0.1](../v0.1/README.md) with rows of [`focus-row/v0.3`](../../focus-row/v0.3/README.md) and tags of [`tags/v0.2`](../../tags/v0.2/README.md), a run token that names the run behind a batch, and the refusals that follow from it. [Changes from 0.1](#changes-from-01) lists every difference.

All names and figures in `examples/` are synthetic.

## Versions

The version is in the path: `/api/integration/v0.2`. A published version never changes in place. A later version is a new directory here and a new path there.

## Identity

Costroid Platform owns identity. An organization is one tenant, shared by both products. Its region is fixed at sign-up.

`GET /identity` answers the tenant, the account that issued the token, the token and the installations bound to the tenant, active and ended. An account appears by id and role, and no address leaves through this contract.

A person's sign-in is not part of this version. It stays on the platform's own pages.

Neither product implements the binding rules below yet. They are fixed here first, so both sides build one thing.

### Installation ids

An installation ties one SCM owner to a tenant. Its id is a kind, a colon and the SCM's own number. A comment link carries it.

| Id                         | Who binds it                                            | The number                | Proof           |
| -------------------------- | ------------------------------------------------------- | ------------------------- | --------------- |
| `github:58120394`          | An account with the GitHub App installed                | The App installation's id | App attestation |
| `github-owner:7204411`     | A GitHub account whose repositories run only the Action | `repository_owner_id`     | CI proof        |
| `gitlab-namespace:4410287` | A GitLab.com namespace                                  | `namespace_id`            | CI proof        |

A repository that runs only the Action has no App installation id, so its tenant binds the owner.

Only numbers bind. GitHub states that its ids "do not change between renames of entities" ([OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc), retrieved 2026-11-01). A name can be given up and taken by a stranger, so `repository_owner`, `repository`, `actor`, `namespace_path` and `project_path` prove nothing. `sub` proves nothing either: on GitHub its format depends on when the repository was created (same page).

GitLab's `namespace_id` is the "Namespace ID of the project running the job" ([ID token reference](https://docs.gitlab.com/ci/secrets/id_token_authentication/), retrieved 2026-11-01). A tenant binds each namespace its projects run in.

Azure DevOps has no id in this version, because no proof exists for one.

One owner belongs to one tenant at a time, across every kind of id. A tenant may hold both kinds for one GitHub owner, because the App and the Action can run side by side.

### Proofs

`PUT /installations/{installation_id}` carries one proof, a compact JWS signed with RS256. Its claims must name the tenant behind the bearer and the installation in the path.

A proof is a signed statement. It opens nothing at the SCM. No SCM credential, user token or App private key crosses this contract. The platform never stores or logs a proof. It keeps the owner's id, the repository or project id for its audit log, the kind of proof and the issue time, and it drops every other claim.

The audience is the tenant: `https://app.costroid.com/tenants/<tenant_id>`, one string. Nothing else in either product uses this audience, so a token minted to send rows fails here.

#### CI proof

A job asks its CI system for an ID token with that audience: `core.getIDToken(audience)` under `id-token: write` on GitHub, [`id_tokens`](https://docs.gitlab.com/ci/yaml/#id_tokens) with `aud` on GitLab (retrieved 2026-11-01). The CI system signs it, and the platform verifies it against the issuer's published keys.

| Requirement | GitHub Actions                                                      | GitLab.com                                                                    |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `iss`       | `https://token.actions.githubusercontent.com`                       | `https://gitlab.com`                                                          |
| Owner       | `repository_owner_id`                                               | `namespace_id`                                                                |
| Repository  | `repository_id`                                                     | `project_id`                                                                  |
| Run         | `event_name` is `schedule`, or `push` with `ref_protected` `"true"` | `ref_protected` is `"true"`, `pipeline_source` is `push`, `web` or `schedule` |

The run requirement exists because a job chooses its own audience, and a file a job can write proves nothing. The tenant must come from a file that passed the owner's branch rules.

On GitHub, "Scheduled workflows will only run on the default branch" ([events reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-01). A `push` can be to any branch, so it counts only with `ref_protected` `"true"`. An absent or `"false"` value answers `INSTALLATION_PROOF_UNPROTECTED_RUN`.

GitHub's [OpenID configuration](https://token.actions.githubusercontent.com/.well-known/openid-configuration) lists `ref_protected` in `claims_supported` (retrieved 2026-11-01). The claim reference does not describe it. No real token has been read, so its value type is assumed to be a string, like every other GitHub claim.

Every other event is refused, whatever its `ref_protected`. A `workflow_dispatch` can name any branch. A `pull_request_target` run sits on the default branch, but a pull request starts it. A `pull_request` is refused the same way, from a fork or not.

On GitLab, `ref_protected` is a claim. In a merge request pipeline `namespace_id` names the source project's namespace, so a fork proves only itself.

#### App attestation

A GitHub webhook is signed with HMAC-SHA256 under a shared secret ([Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), retrieved 2026-11-01), so only a holder of that secret can check it. The platform has no such secret and needs none. Costroid's hosted service checks the webhook and signs a short statement with an RS256 key held in a KMS. The platform holds only the public keys, which rotate with an overlap.

A webhook names no tenant, and GitHub warns that the setup URL's `installation_id` can be spoofed ([About the setup URL](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), retrieved 2026-11-01). So the service signs only when all of these hold:

1. A signed delivery no older than 600 seconds, either `installation` with action `created` or `unsuspend`, or `installation_repositories`, names the installation. These are acts of installing or configuring it ([webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads), retrieved 2026-11-01).
2. A person completes GitHub's user authorization on the service, and that user's id equals the delivery's `sender.id`. A delivery from the `ghost` account signs nothing.
3. The audience comes from `GET /identity` under the token of the tenant that person acts for.

The user token stays on the service and ends with the check.

#### The window

A proof is accepted for at most 600 seconds after `iat`, never past `exp`, with 60 seconds of clock skew either way. GitHub's example token lives 300 seconds ([OpenID Connect concepts](https://docs.github.com/en/actions/concepts/security/openid-connect), retrieved 2026-11-01). A GitLab token lives as long as the job's timeout, and the example in its ID token reference lives 3,600 seconds, so `exp` alone is not enough.

A proof issued before an installation's last change is expired. A proof from before an uninstall cannot restore it.

#### Self-hosted Costroid

A self-hosted Costroid shares no key with Costroid's hosted service, and it needs none. A CI proof is signed by the SCM, so it verifies the same from any sender. A self-hosted Costroid on github.com or GitLab.com binds `github-owner` or `gitlab-namespace`.

`github:` ids are hosted only. A self-hosted service's own App attestation answers `INSTALLATION_PROOF_ISSUER_UNTRUSTED`, because a service any tenant can run can say anything. GitHub Enterprise Server and self-managed GitLab answer the same in this version: their ids are not unique across instances, and an issuer a tenant could name would prove that tenant's own claims.

### Who holds an owner

The first valid proof binds. After that, one table decides. A binding by CI proof is current for 7 days after `proven_at`. A job renews it by sending a newer proof, and a daily schedule is enough. A stale binding keeps working: staleness only stops it defending the owner. A binding by App attestation does not go stale. It ends.

| The owner is held by                                   | The proof                 | Answer                                                         |
| ------------------------------------------------------ | ------------------------- | -------------------------------------------------------------- |
| This tenant, under this id                             | Any                       | 200. A valid newer proof moves `proven_at`, nothing else moves |
| This tenant, under the other kind of id                | Valid                     | 200, bound                                                     |
| Nobody, or a binding that ended                        | Valid, newer than the end | 200, bound                                                     |
| Another tenant, CI proof, current                      | CI proof                  | 409 `INSTALLATION_BOUND_ELSEWHERE`                             |
| Another tenant, CI proof, stale                        | CI proof                  | 200, the holder is displaced                                   |
| Another tenant, CI proof, any age                      | App attestation           | 200, the holder is displaced                                   |
| Another tenant, App attestation                        | CI proof                  | 409 `INSTALLATION_BOUND_ELSEWHERE`                             |
| Another tenant, App attestation, the same installation | App attestation           | 409 `INSTALLATION_BOUND_ELSEWHERE`                             |
| Another tenant, App attestation, another installation  | App attestation, newer    | 200, the holder is displaced                                   |

An App outranks a CI proof because installing it is an act of an owner or repository administrator ([Installing a third-party App](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party), retrieved 2026-11-01), while a CI proof shows only that a scheduled or protected run happened.

The real owner always has a way through. On GitHub, installing the App beats a CI binding at once, and an uninstall followed by a reinstall clears an App binding held by anyone. On GitLab, the owner removes the access that produced the rival proof, and that binding stops being renewed and goes stale in 7 days.

A displacement ends every binding the holder has for that owner. The displaced tenant keeps its rows. It sees `displaced` in `GET /identity`, and its next export under that id answers `INSTALLATION_NOT_BOUND`.

### Uninstalls and transfers

An uninstall or a suspension ends the binding. The hosted service reads GitHub's signed `installation` delivery and calls `DELETE /installations/{installation_id}` with the tenant's token. The binding becomes `revoked`, exports under it answer `INSTALLATION_NOT_BOUND`, and the tenant keeps its rows. A `github-owner` binding of the same tenant is untouched. If the delivery never arrives, the binding stays listed and a new installation displaces it.

A reinstall needs a new attestation, whatever id GitHub gives it, and a proof from before the uninstall is refused.

A repository transfer changes `repository_owner_id`. A project transfer changes `namespace_id`. The new owner is a new binding, for whichever tenant proves it. The old binding stays with its tenant.

A sale of an organization changes no id. The holder stays until a rule above moves it, and on GitHub a reinstall does.

A binding never moves rows between tenants. It decides which tenant may send rows under an id from now on. Rows already stored stay where they are, under the id they carry. A tenant that gives up an owner to another tenant keeps its history, and the other tenant starts empty.

### What a binding proves

A binding proves one thing. At `proven_at`, a trusted issuer signed that an installer of the App, or a scheduled or protected run under this owner, named this tenant.

It does not prove:

- That the prover administers the whole owner today. A CI proof shows a run, and a repository administrator can install the App.
- That the tenant owns every repository under the owner.
- That any row is true. A row's grades carry that claim, and an exported row is judged on its own.
- Who a person is. Binding carries no person's identity across this contract.
- Anything at the SCM. A binding grants no access to it.

A comment link's installation id is a label for measurement. It is never a proof.

### Refusals

Every refusal is typed, and `openapi.json` carries an example of each. The platform checks the proof before it reads who holds the owner, so a refusal tells a caller with no valid proof nothing about the holder.

| Code                                   | Status | Meaning                                                                      |
| -------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `INSTALLATION_PROOF_MISSING`           | 400    | The body holds no proof, or no compact JWS                                   |
| `INSTALLATION_PROOF_ISSUER_UNTRUSTED`  | 403    | The issuer is not GitHub Actions, GitLab.com or Costroid's hosted service    |
| `INSTALLATION_PROOF_SIGNATURE_INVALID` | 403    | Not RS256, an unknown key id, or a failed signature                          |
| `INSTALLATION_PROOF_AUDIENCE_MISMATCH` | 403    | The audience is not this tenant's                                            |
| `INSTALLATION_PROOF_EXPIRED`           | 403    | Outside the window, or issued before the installation's last change          |
| `INSTALLATION_PROOF_CLAIMS_INVALID`    | 403    | A stable id is absent or is not a number                                     |
| `INSTALLATION_PROOF_UNPROTECTED_RUN`   | 403    | The run could start without the owner's branch rules                         |
| `INSTALLATION_PROOF_SUBJECT_MISMATCH`  | 403    | The proof names another installation than the path                           |
| `INSTALLATION_BOUND_ELSEWHERE`         | 409    | The proof is valid, and another tenant holds the owner under the table above |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE`  | 503    | The issuer's keys cannot be read. Retry the same proof inside its window     |

`examples/BindingCase.*.json` and `examples/rejected/BindingCase.*.json` are test vectors for these rules. Each states what one request sees and what it must answer, and `scripts/validate.mjs` runs them. An implementation runs the same files.

### Threats

| Threat       | What the attacker does                                                            | The rule that answers it                                                                                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Squat        | A stranger names `github:58120394` first                                          | No binding without a proof, and only the SCM or the hosted service signs one. The stranger gets `INSTALLATION_PROOF_MISSING` or `INSTALLATION_PROOF_SUBJECT_MISMATCH`, and no binding exists to block anyone                                                                                                |
| Inside squat | A writer on one repository, with a tenant of their own, binds the owner           | GitHub needs a schedule from the default branch or a push to a protected ref, GitLab a protected ref. If the writer can still get there, for example under a ruleset that matches every branch, the App displaces them at once. On GitLab the owner removes the access and the binding goes stale in 7 days |
| Replay       | A captured proof is sent again                                                    | The audience fixes the tenant, the path must match the proof, and the window is 600 seconds. A replay by the tenant it names changes nothing. A proof older than the installation's last change is refused                                                                                                  |
| Stolen proof | A proof leaks from a job log or a request                                         | It names one tenant, so it is useless without that tenant's bearer with `installations:write`. With both, it can only bind the owner to the tenant it already names. It opens nothing at the SCM                                                                                                            |
| Uninstall    | The App is removed, and an old binding or proof lingers                           | The binding ends `revoked` on the signed delivery, and the tenant keeps its rows. Exports under it answer `INSTALLATION_NOT_BOUND`. If the delivery is lost, a new installation displaces it. An older proof is `INSTALLATION_PROOF_EXPIRED`                                                                |
| Transfer     | A repository, a project or an organization changes hands                          | A new owner id is a new binding. A sale keeps the id, and a reinstall clears the old holder. Rows never move                                                                                                                                                                                                |
| Forged rows  | A workflow that can read the integration token sends rows for a run it never made | A `token_verified` row must name the run and the repository of the run token beside it, or the batch fails. A row without a run token stays `unverified`. No row an agent's job wrote is budget evidence, under [What a row proves](#what-a-row-proves)                                                     |

The remaining risks are stated. An owner whose default branch takes unreviewed pushes gives every writer a CI proof. `ref_protected` does not mean the default branch: a ruleset that matches every branch makes any writer's push protected, so the App still outranks that proof and displaces its holder. A private repository on a plan with no branch protection still needs `schedule` or the App. A repository administrator can install the App and hold the owner until an organization owner reinstalls it. A person who approves a change to a workflow file can be misled into naming a stranger's tenant. A holder of the integration token can restate a batch it did not send, under that batch's id: the new rows are judged on their own, so `unverified` rows can replace `token_verified` ones.

## Tokens

Every request carries an integration token as a bearer: `costroid_it_` followed by 43 URL-safe characters. A tenant administrator issues one on the platform, which shows the secret once and stores only its SHA-256.

A token belongs to one tenant, carries one or more scopes and expires.

| Scope                 | Allows                                              |
| --------------------- | --------------------------------------------------- |
| `identity:read`       | `GET /identity`                                     |
| `installations:write` | `PUT` and `DELETE /installations/{installation_id}` |
| `rows:write`          | `PUT` and `GET /exports/{batch_id}`                 |
| `quotas:read`         | `GET /quotas`                                       |

`/tokens/current` reads and revokes the token in use, and `POST /tokens/current/rotate` replaces it. The old token works until `previous_token_expires_at`, so a client can switch without a gap.

An absent, unknown, expired or revoked token answers one `AUTH_TOKEN_INVALID`. The answer does not say which.

This token authenticates one product to the other. It says which tenant sends, never which run. A CI proof is a separate token with a separate audience, under Identity, and so is the run token below.

## The run token

A CI job that sends rows also sends its own ID token in `Costroid-Run-Token`. The integration token says which tenant the rows are for. The run token says which run sent them.

The job asks GitHub Actions for an ID token with the audience `https://app.costroid.com/tenants/<tenant_id>/rows`, under `id-token: write` ([OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc), retrieved 2026-11-01). The audience ends in `/rows`, so a run token never passes as a CI proof, and a CI proof never passes as a run token.

The platform verifies the token as it verifies a CI proof: RS256 against GitHub's published keys, the issuer `https://token.actions.githubusercontent.com`, this tenant's rows audience, and the same window of 600 seconds after `iat`, never past `exp`, with 60 seconds of clock skew. It reads five claims, all strings: `repository`, `repository_id`, `repository_owner_id`, `run_id` and `run_attempt`. It never stores or logs the token.

| Check                                                                                    | Answer                                         |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The header is present and fails verification                                             | 403 `RUN_TOKEN_INVALID`, nothing stored        |
| `repository_owner_id` is not the owner of the installation in `Costroid-Installation-Id` | 403 `RUN_TOKEN_OWNER_MISMATCH`, nothing stored |
| A `token_verified` row names a `costroid/workflow_run_id` other than `run_id`            | The batch fails `ROW_IDENTITY_MISMATCH`        |
| A `token_verified` row names a `costroid/repo` other than `github.com/` and `repository` | The batch fails `ROW_IDENTITY_MISMATCH`        |
| A batch without the header holds a `token_verified` row                                  | The batch fails `RUN_TOKEN_MISSING`            |
| A batch without the header holds only `unverified` rows                                  | Ingests. Its rows stay `unverified`            |

The owner of a `github-owner:` installation is its number. The owner of a `github:` installation is the account the App is installed on, the `owner_id` its binding stored. The two synchronous checks run before the body is stored. The row checks run on ingest, so their codes arrive in `GET /exports/{batch_id}`, and a batch that fails them stores no row.

`costroid/commit_sha` is not checked. On a `pull_request` run, `GITHUB_SHA` is the merge commit ([events reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-01), and no source shows that the token's `sha` names the pull request's head.

This version defines the run token for GitHub Actions only. A GitLab job sends no run token, so its rows stay `unverified`.

## What a row proves

A run token proves which repository and which run sent a batch. It proves nothing about the counts in it. The rows file is written by the agent's own job, and an agent that can run commands can rewrite it.

So a row is budget evidence only when its spend was measured outside the agent's job: by a gateway's own count of spend on the run's key, or by the provider's own report reconciled with the rows (`costroid/cost_source` `provider_report`, `costroid/cost_basis` `billed`). This version carries no gateway count in a row, so on this contract only the provider's report applies.

Every other row, `token_verified` or not, is attributed and shown in its own basis. It may raise a budget alert. It never shows that a budget held.

## The export endpoint

`PUT /exports/{batch_id}` sends one CSV of [FOCUS rows](../../focus-row/v0.3/README.md). The tenant comes from the token, never from the body. The rows carry the [tag set](../../tags/v0.2/README.md) in their `Tags` column, and it needs no mapping. [`examples/FocusRow.export-body.csv`](examples/FocusRow.export-body.csv) is a body, and `scripts/validate.mjs` checks each of its rows against `focus-row/v0.3`.

### The batch id

From GitHub Actions the batch id is `<repository_id>-<run_id>-<run_attempt>`, for example `903114-16873409921-1`. A retry of one run's send restates its batch. A re-run attempt runs the agent again, so it adds a batch. Another sender chooses its own id, unique within the tenant.

The batch id decides what a request means.

| Request                              | Effect                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| A new `batch_id`                     | Adds rows                                                                                     |
| The same `batch_id`, the same bytes  | Answers 200 and changes nothing, so a retry is safe                                           |
| The same `batch_id`, different bytes | Replaces every row of the earlier bytes, in every month they named, once the new bytes ingest |

A restatement is month-wide. When the earlier bytes named October and November and the new bytes name November only, the batch's October rows are retired with the rest. A batch's rows never replace another batch's.

### Tags outside the prefix

The platform drops every `Tags` key outside `costroid/` before storage, whatever its value, because a free-form key and value are where content would hide. `dropped_tag_keys` counts the dropped entries across the batch. No dropped name or value is kept.

### Refusals

A request is refused before anything is stored.

| Code                        | Status | Meaning                                                                                       |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `AUTH_TOKEN_INVALID`        | 401    | The token is absent, unknown, expired or revoked                                              |
| `PLAN_WRITES_REFUSED`       | 402    | The tenant's plan does not allow writes at present                                            |
| `AUTH_TOKEN_SCOPE`          | 403    | The token lacks `rows:write`                                                                  |
| `RUN_TOKEN_INVALID`         | 403    | The run token fails verification                                                              |
| `RUN_TOKEN_OWNER_MISMATCH`  | 403    | The run token names another owner than the installation                                       |
| `INSTALLATION_NOT_BOUND`    | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one |
| `EXPORT_BATCH_BUSY`         | 409    | Other bytes of this batch are ingesting                                                       |
| `FILE_TOO_LARGE`            | 413    | The body exceeds `max_batch_bytes`                                                            |
| `HASH_MISMATCH`             | 422    | The body does not hash to `Costroid-Content-SHA256`                                           |
| `QUOTA_` and a quota's name | 429    | The request would pass a quota, under [Quota signals](#quota-signals)                         |

A sender that meets 402 keeps the rows and warns. It never fails a check on that answer, because nothing in the rows is wrong and they can be sent later. A 429 is treated the same way.

### Failed batches

A batch ingests whole or fails whole. A failed batch changes nothing, and `GET /exports/{batch_id}` carries its typed `failure`.

| Code                        | The batch                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `RUN_TOKEN_MISSING`         | Holds a `token_verified` row and came without a run token                                               |
| `ROW_IDENTITY_MISMATCH`     | Holds a `token_verified` row whose run or repository is not the run token's                             |
| `ROW_COST_INCONSISTENT`     | Holds a row whose `ListCost` or `ContractedCost` is not its unit price times `PricingQuantity`, exactly |
| `UNPARSEABLE_FILE`          | Cannot be read as CSV                                                                                   |
| `MISSING_MANDATORY_COLUMNS` | Lacks a column FOCUS 1.4 requires                                                                       |
| `INVALID_TIMESTAMP`         | Holds a timestamp that is not one                                                                       |
| `NON_NUMERIC_COST`          | Holds a cost that is not a number                                                                       |
| `EXCESS_NUMERIC_PRECISION`  | Holds a value past 12 fractional digits                                                                 |
| `UNKNOWN_FOCUS_VERSION`     | Does not read as FOCUS 1.4                                                                              |
| `EMPTY_FILE`                | Holds no rows                                                                                           |
| `HASH_MISMATCH`             | Did not hash to `Costroid-Content-SHA256` when the platform read it back                                |
| `FILE_TOO_LARGE`            | Is larger than the platform ingests                                                                     |
| `INGEST_RETRY_EXHAUSTED`    | Could not be ingested after the platform's retries                                                      |

A client treats a code it does not know as a failed batch.

## Quota signals

`GET /quotas` answers every limit that applies to the tenant. Each export answer also carries `Costroid-Quota-State`, the most urgent state across them: `ok`, `approaching` at 80% of a limit, or `exhausted`.

Three quotas bound exports. `exports_per_day` counts the batches accepted for ingest in a UTC day, restatements included, and a repeat of bytes already held is not counted. `export_bytes_per_day` sums their bodies in bytes. `max_batch_bytes` bounds one body in bytes.

A refused export answers 429 with `Retry-After` and an error code named after the quota, such as `QUOTA_EXPORTS_PER_DAY`, and stores nothing. A quota refusal never changes a check conclusion, and the sender keeps the rows and retries.

## Changes from 0.1

- Rows are `focus-row/v0.3` and tags are `tags/v0.2`. `GET /identity` names both in `contract`.
- The run token is new: the `Costroid-Run-Token` header, its rows audience and the codes `RUN_TOKEN_INVALID`, `RUN_TOKEN_OWNER_MISMATCH`, `RUN_TOKEN_MISSING` and `ROW_IDENTITY_MISMATCH`.
- `ROW_COST_INCONSISTENT` fails a batch whose costs are not their own products.
- `PUT /exports/{batch_id}` lists 402 `PLAN_WRITES_REFUSED`, and every export refusal is one closed list with an example.
- A restatement retires the earlier bytes' rows in every month, not only in the months the new bytes name.
- The batch id from GitHub Actions is `<repository_id>-<run_id>-<run_attempt>`.
- Tags outside `costroid/` are dropped on ingest, and `ExportBatch` counts them in `dropped_tag_keys`.
- The quotas are `exports_per_day`, `export_bytes_per_day` and `max_batch_bytes`. `rows_per_month`, `history_days` and `members` are gone, because no platform counter holds them.
- What a row proves is stated: a run token never makes a row budget evidence.
