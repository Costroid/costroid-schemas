# Integration contract, version 0.5

How Costroid and Costroid Platform identify a tenant, authenticate, move FOCUS rows, merge facts and reconciliation results, and report quotas. The contract is [`openapi.json`](openapi.json), OpenAPI 3.1. Both products implement it, and there is no second contract.

Version 0.5 is [version 0.4](../v0.4/README.md) with two facts a sender adds beside its rows: that a pull request merged, and how a credential's day compared with the provider's report. [Changes from 0.4](#changes-from-04) lists every difference.

All names and figures in `examples/` are synthetic.

## Versions

The version is in the path: `/api/integration/v0.5`. A published version never changes in place. A later version is a new directory here and a new path there.

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

The remaining risks are stated. An owner whose default branch takes unreviewed pushes gives every writer a CI proof. `ref_protected` does not mean the default branch: a ruleset that matches every branch makes any writer's push protected, so the App still outranks that proof and displaces its holder. A private repository on a plan with no branch protection still needs `schedule` or the App. A repository administrator can install the App and hold the owner until an organization owner reinstalls it. A person who approves a change to a workflow file can be misled into naming a stranger's tenant. A holder of the integration token can restate a batch of `unverified` rows it did not send. A merge fact's `pull_request` and `merged_at` are the sender's reading of the host, and a `token_verified` grade does not prove them, under [What the run token proves](#what-the-run-token-proves). A reconciliation result is the sending tenant's statement about its own key, and the platform reads no provider report to check it, under [What it proves, and the scope](#what-it-proves-and-the-scope).

## Tokens

Every request carries an integration token as a bearer: `costroid_it_` followed by 43 URL-safe characters. A tenant administrator issues one on the platform, which shows the secret once and stores only its SHA-256.

A token belongs to one tenant, carries one or more scopes and expires.

| Scope                   | Allows                                              |
| ----------------------- | --------------------------------------------------- |
| `identity:read`         | `GET /identity`                                     |
| `installations:write`   | `PUT` and `DELETE /installations/{installation_id}` |
| `rows:write`            | `PUT` and `GET /exports/{batch_id}`                 |
| `merges:write`          | `PUT` and `GET /merges/{merge_id}`                  |
| `reconciliations:write` | `PUT` and `GET /reconciliations`                    |
| `quotas:read`           | `GET /quotas`                                       |

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

`PUT /exports/{batch_id}` sends one CSV of [FOCUS rows](../../focus-row/v0.5/README.md). The tenant comes from the token, never from the body. The rows carry the [tag set](../../tags/v0.4/README.md) in their `Tags` column, and it needs no mapping. [`examples/FocusRow.export-body.csv`](examples/FocusRow.export-body.csv) is a body, and `scripts/validate.mjs` checks each of its rows against `focus-row/v0.5`. Its rows carry the three tags a caller names and `costroid/repo_visibility`.

### Default rows only

The body holds rows in the row contract's [default profile](../../focus-row/v0.5/README.md#profiles), the profile its CSV form writes. A row that carries `x_CostroidMeasuredCost` is in the strict profile: its `EffectiveCost` is 0, and its figure is in that column. Such a row fails the batch `ROW_PROFILE_STRICT`. Send the default row, which keeps the figure in `EffectiveCost`.

### The batch id

From GitHub Actions the batch id is `<repository_id>-<run_id>-<run_attempt>`, for example `903114-16873409921-1`. A retry of one run's send restates its batch. A re-run attempt runs the agent again, so it adds a batch. Another sender chooses its own id, unique within the tenant.

The batch id decides what a request means.

| Request                              | Effect                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| A new `batch_id`                     | Adds rows                                                                                     |
| The same `batch_id`, the same bytes  | Answers 200 and changes nothing, so a retry is safe                                           |
| The same `batch_id`, different bytes | Replaces every row of the earlier bytes, in every month they named, once the new bytes ingest |

A restatement is month-wide. When the earlier bytes named October and November and the new bytes name November only, the batch's October rows are retired with the rest. A batch's rows never replace another batch's.

A batch whose active rows hold `token_verified` rows is bound to its run. Only a request whose run token names the same run and repository restates it; any other answers 409 `EXPORT_BATCH_RUN_BOUND` and stores nothing. A batch whose rows are all `unverified` restates as before. A restatement that fails ingest leaves the earlier rows active and the batch bound. A sender that meets `EXPORT_BATCH_RUN_BOUND` keeps the rows and warns, and does not retry under the same batch id.

### Tags outside the prefix

The platform drops every `Tags` key outside `costroid/` before storage, whatever its value, because a free-form key and value are where content would hide. `dropped_tag_keys` counts the dropped entries across the batch. No dropped name or value is kept.

### Refusals

A request is refused before anything is stored.

| Code                        | Status | Meaning                                                                                                            |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `AUTH_TOKEN_INVALID`        | 401    | The token is absent, unknown, expired or revoked                                                                   |
| `PLAN_WRITES_REFUSED`       | 402    | The tenant's plan does not allow writes at present                                                                 |
| `AUTH_TOKEN_SCOPE`          | 403    | The token lacks `rows:write`                                                                                       |
| `RUN_TOKEN_INVALID`         | 403    | The run token fails verification                                                                                   |
| `RUN_TOKEN_OWNER_MISMATCH`  | 403    | The run token names another owner than the installation                                                            |
| `INSTALLATION_NOT_BOUND`    | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                      |
| `EXPORT_BATCH_BUSY`         | 409    | Other bytes of this batch are ingesting                                                                            |
| `EXPORT_BATCH_RUN_BOUND`    | 409    | The batch's active rows hold `token_verified` rows, and the run token is absent or names another run or repository |
| `FILE_TOO_LARGE`            | 413    | The body exceeds `max_batch_bytes`                                                                                 |
| `HASH_MISMATCH`             | 422    | The body does not hash to `Costroid-Content-SHA256`                                                                |
| `QUOTA_` and a quota's name | 429    | The request would pass a quota, under [Quota signals](#quota-signals)                                              |

A sender that meets 402 keeps the rows and warns. It never fails a check on that answer, because nothing in the rows is wrong and they can be sent later. A 429 is treated the same way.

### Failed batches

A batch ingests whole or fails whole. A failed batch changes nothing, and `GET /exports/{batch_id}` carries its typed `failure`.

| Code                        | The batch                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `RUN_TOKEN_MISSING`         | Holds a `token_verified` row and came without a run token                                               |
| `ROW_IDENTITY_MISMATCH`     | Holds a `token_verified` row whose run or repository is not the run token's                             |
| `ROW_COST_INCONSISTENT`     | Holds a row whose `ListCost` or `ContractedCost` is not its unit price times `PricingQuantity`, exactly |
| `ROW_PROFILE_STRICT`        | Holds a row that carries `x_CostroidMeasuredCost`, the strict profile                                   |
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

## The merge fact

`PUT /merges/{merge_id}` sends one document per merged pull request. Rows say what a pull request's runs spent. A merge fact says when the pull request ended, so a reader can count merged pull requests and date what follows a merge.

### What it says

This pull request of this repository merged at this instant as this commit. The body is [`examples/MergeDocument.json`](examples/MergeDocument.json):

```json
{
  "repo": "github.com/example/widgets",
  "pull_request": 1482,
  "merged_at": "2026-11-21T10:07:52Z",
  "merge_commit_sha": "9f2c6e1ab47d03f58c1e7726d0b4a93e5f618c2d"
}
```

| Key                | Form                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| `repo`             | Host and path, no scheme, as [`costroid/repo`](../../tags/v0.4/README.md) writes it     |
| `pull_request`     | The number `costroid/pr` carries, as a JSON integer                                     |
| `merged_at`        | An instant in UTC, to the second                                                        |
| `merge_commit_sha` | The commit the merge put on the base branch: 40 or 64 lower-case hexadecimal characters |

A reader joins a merge fact to rows by the same strings: `repo` to the rows' `costroid/repo`, and `pull_request` to their `costroid/pr`.

No other key is read in this version, and a body with an unknown key answers `MERGE_FACT_INVALID`. The pull request's last head is not in this version, because no reader uses it yet. A later version may add a `references` array, for a pull request that names what it acts on. A reader of this version refuses an unknown key, so that addition is a new version.

### The id and idempotence

From GitHub Actions the merge id is `<repository_id>-<pull_request>`, for example `903114-1482`, in the form the batch id has. Another sender chooses an id unique within the tenant.

| Request                                                                            | Effect                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A new `merge_id`, for a `repo` and `pull_request` that hold no fact                | 201. Stores the fact                                                                                      |
| The same `merge_id`, a `token_verified` document over an `unverified` one          | 201. Replaces it, whether or not the two documents differ                                                 |
| The same `merge_id`, the same document, in any other case                          | 200. Changes nothing                                                                                      |
| The same `merge_id`, a different document of the same grade                        | 409 `MERGE_FACT_CONFLICT`, nothing stored. A pull request merges once                                     |
| The same `merge_id`, a different `unverified` document over a `token_verified` one | 409 `MERGE_FACT_CONFLICT`, nothing stored                                                                 |
| Another `merge_id` for a `repo` and `pull_request` that already hold a fact        | 409 `MERGE_FACT_CONFLICT`, nothing stored. A sender that chooses its own ids cannot count one merge twice |

"The same document" means equal values of the keys, not equal bytes: the platform compares parsed values. A verified fact replaces an unverified one even when they differ, so a holder of the integration token cannot send a wrong fact first and block the true one. The same document sent without a run token over a `token_verified` fact answers 200, and the fact keeps its grade.

The answer of a `PUT` that stores, of one that changes nothing, and of `GET` is the stored fact with its `run_identity`: `token_verified` or `unverified`.

### Who sends it, and what the run token proves

The recommended sender is a job on a push to the default branch, not a job on a pull request's `closed` event:

- GitHub runs a `pull_request` workflow "in the context of the merge commit", on the pull request's merge ref `refs/pull/<number>/merge` ([events reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-21). The workflow file it runs carries the pull request's changes, so the pull request's author decides what its job sends. A push to the default branch runs the default branch's file.
- On a push, `GITHUB_SHA` is the "Tip commit pushed to the ref" (the same page), and the run token's `sha` claim is that commit, so the platform can hold `merge_commit_sha` to it.

The sender reads the pushed commit, asks the host which merged pull requests that commit closed, and sends one fact per pull request. A commit that closed none sends nothing. In releases after 1.0.0-alpha.26, Costroid's sender is `costroid merged`, run by a recipe on a push to the default branch with `id-token: write`.

`Costroid-Installation-Id` and `Costroid-Run-Token` are sent as on an export, and the run token has the same rows audience. The platform verifies it under [The run token](#the-run-token) and reads three more claims on this path: `sha`, `ref` and `ref_type`.

| Check                                                                                   | Answer                                             |
| --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| The header is present and fails verification                                            | 403 `RUN_TOKEN_INVALID`, nothing stored            |
| `repository_owner_id` is not the owner of the installation                              | 403 `RUN_TOKEN_OWNER_MISMATCH`, nothing stored     |
| The header verifies, and `repo` is not `github.com/` and the token's `repository`       | 422 `MERGE_FACT_IDENTITY_MISMATCH`, nothing stored |
| The header verifies, and `sha` is not `merge_commit_sha`, or `ref_type` is not `branch` | Stored as `unverified`                             |
| The header verifies, `sha` is `merge_commit_sha` and `ref_type` is `branch`             | Stored as `token_verified`                         |
| No header                                                                               | Stored as `unverified`                             |

One push can carry more than one merged pull request, as a merge queue's group does. The run token's `sha` is the tip of the push, so only the fact whose `merge_commit_sha` is the tip reads `token_verified`, and the others read `unverified`. That is an honest cause of an `unverified` fact. [`examples/MergeFact.merge-queue-group.json`](examples/MergeFact.merge-queue-group.json) is one.

The claims on a push were read from a real token: a recorded GitHub Actions run 44894920019 (2026-11-21) printed `event_name` `push`, `ref` `refs/heads/main`, `ref_type` `branch`, and `sha` equal to the pushed commit and to `github.sha`. The claims of a `pull_request` `closed` run have not been read, and this contract does not rest on them: a fact sent from such a run reads `unverified` unless its token's `sha` is the merge commit.

A GitLab job sends no run token, so its fact reads `unverified`, as its rows do.

#### What the run token proves

A run token proves which repository and which run sent a fact, and that the run was on a branch at `merge_commit_sha`. It proves nothing about `pull_request` or `merged_at`. The sender reads both from the host, and the platform does not check them: a `token_verified` fact does not prove that the commit closed this pull request, or when.

### The scope

`merges:write` allows `PUT` and `GET /merges/{merge_id}`. `GET` answers the stored document with its `run_identity`, and an id this tenant does not hold answers 404 `MERGE_FACT_NOT_FOUND`.

### Refusals

A request is refused before anything is stored.

| Code                           | Status | Meaning                                                                                                                |
| ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| `AUTH_TOKEN_INVALID`           | 401    | The token is absent, unknown, expired or revoked                                                                       |
| `PLAN_WRITES_REFUSED`          | 402    | The tenant's plan does not allow writes at present                                                                     |
| `AUTH_TOKEN_SCOPE`             | 403    | The token lacks `merges:write`                                                                                         |
| `RUN_TOKEN_INVALID`            | 403    | The run token fails verification                                                                                       |
| `RUN_TOKEN_OWNER_MISMATCH`     | 403    | The run token names another owner than the installation                                                                |
| `INSTALLATION_NOT_BOUND`       | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                          |
| `MERGE_FACT_CONFLICT`          | 409    | The merge id, or the pull request, holds a different document, under [The id and idempotence](#the-id-and-idempotence) |
| `MERGE_FACT_IDENTITY_MISMATCH` | 422    | A verified run token names another repository than `repo`                                                              |
| `MERGE_FACT_INVALID`           | 422    | A key is missing, unknown or of the wrong form                                                                         |

A sender that meets 402 keeps its document and warns. It never fails a check on that answer, because nothing in the document is wrong and it can be sent later.

## The reconciliation result

`PUT /reconciliations` sends a sender's comparison of its rows with a provider's usage and cost reports, one row per source, credential and UTC day.

### What it says

Costroid's `costroid reconcile --out` already writes one such row per source, credential and day, and a rerun replaces it. This contract carries that row as it is, with one key added, `currency`. It defines no second, smaller shape that could disagree with the first. [`examples/ReconciliationRow.json`](examples/ReconciliationRow.json) is one row, and [`examples/ReconciliationRow.body.jsonl`](examples/ReconciliationRow.body.jsonl) is a body of eight.

The body is `application/x-ndjson`: one row per line, each line ended by a line feed.

| Key                 | What it holds                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source`            | The provider whose reports the row was compared with. Costroid writes `anthropic` or `openai`                                                                       |
| `credential`        | The rows' `SubAccountId`: the key, workspace, project or service account they spent on                                                                              |
| `day`               | A UTC day, `YYYY-MM-DD`                                                                                                                                             |
| `state`             | `matched`, `tokens_miss`, `price_miss` or `pending`: the verdict on tokens and prices                                                                               |
| `final`             | False while the provider can still restate the day, through the eighth day after the day's month ends                                                               |
| `data_refreshed_at` | The provider's freshness stamp on the reports that carried the day, the earliest when several did, in UTC. Null when the provider stamps none                       |
| `currency`          | The currency of every amount in the row, `prices` included, as an ISO 4217 code                                                                                     |
| `tokens`            | One check per token class: the rows' count, the provider's, the difference and whether it is within 1%                                                              |
| `prices`            | One check per model, tier, region and class on the row's own day: the unit price the cost report implies, per million tokens, against the catalog's                 |
| `dollars`           | List-price dollars against the cost report for the day, or for a span's days together on its first day: the verdict, the figures, the residual and its named causes |
| `span`              | The days a run crossed midnight UTC over, compared as one for tokens and dollars                                                                                    |
| `notes`             | Sentences for people                                                                                                                                                |

The key is `source`, `credential` and `day`.

`state` is the verdict on tokens and prices. The list is closed:

| State         | Meaning                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matched`     | Every class landed within 1%, and every price matched the catalog                                                                                                                                                     |
| `tokens_miss` | A class missed 1%. It is a defect                                                                                                                                                                                     |
| `price_miss`  | Every class matched, and a price missed the catalog. It is a defect                                                                                                                                                   |
| `pending`     | The provider has not finished reporting the day, or a run on the credential crossed midnight UTC into a day that cannot be compared yet. The row carries no figure: `tokens`, `prices`, `dollars` and `span` are null |

`dollars.verdict` is one of `within`, `outside` and `no_bill`, and the list is closed. `within` means the day's list-price dollars landed within 10% of the cost report. `no_bill` means every row was list-equivalent, so no bill exists to compare with. `dollars` is null when the row holds no dollar comparison: on a `pending` row, and on a later day of a span.

A run that crosses midnight UTC puts all its tokens on its first day in the rows, while the provider dates each request by when it was served. When a day misses on its own and the days the run spans match together, those days are compared as one, for dollars as for tokens. The row of the span's first day holds the joined token comparison and the joined dollar comparison: its `dollars` are over the span's days together. Each later day's row carries `span` and the span's `state`, with `tokens` and `dollars` null, so no later day reads `outside` on its own. Each day's row keeps its own `prices`, and the span's `state` is `price_miss` when a price misses on any of its days. [`examples/ReconciliationRow.span-first-day.json`](examples/ReconciliationRow.span-first-day.json) and [`examples/ReconciliationRow.span-later-day.json`](examples/ReconciliationRow.span-later-day.json) are the two days of one span.

The causes of a residual are closed too: `shared_key`, `tier`, `residency`, `contract_rate` and `run_spans_days`. `dollars.residual` is the provider's figure minus the rows', and it equals the sum of `causes` and `unattributed`. The token classes are the row contract's billed classes, plus `cache_write`, the writes of every lifetime compared as one figure where the rows cannot see a write's lifetime.

Every amount is a decimal string, never a JSON number: an optional leading minus, digits, and an optional point followed by 1 to 30 digits, at most 64 characters in all, with no exponent and no leading plus. A provider's figure is carried as the provider states it, and nothing is rounded. A derived figure, such as a delta or a residual, inherits its scale. The one exception is `implied_unit_price`, rounded to six places, which no verdict reads. A token count is a whole number written in digits only, at most 20 of them, and a difference of two counts may carry a leading minus.

`currency` is the currency of every amount in the row, `prices` included. Where `dollars.rounding` is present, its `currency` equals the row's. The schema's dialect cannot compare two values, so `openapi.json` does not check it, and a row that breaks it is not a row of this version. `currency` is new: the row `reconcile` wrote before this version has no such key, and Costroid adds it with this version.

[Compare a ledger with a provider's report](https://github.com/Costroid/costroid/blob/main/docs/reconcile.md) is how Costroid computes each key.

### Idempotence

A row replaces the stored row of the same key, with two exceptions. A `final` row is never replaced by one that is not final. A row whose `data_refreshed_at` is earlier than the stored row's is ignored; when either is null, this exception does not apply. A body that names one key on two lines is invalid.

The answer counts the rows `stored`, `unchanged` and `ignored`. A row is `unchanged` when the stored row of its key holds the same values.

The whole body is validated before the first write. One bad line refuses it with `RECONCILIATION_INVALID`, names the line in `error.line`, and stores nothing. A body is stored whole or not at all, for a storage failure as for a bad line. On a 5xx the sender sends the same body again, which the replace rule makes safe.

### What it proves, and the scope

The platform does not read the provider's report. A reconciliation result is the tenant's own job's statement about its own key, sent under the tenant's token. The platform shows it as stated, with who sent it and when, and never as its own measurement. It changes no row's grade or basis.

`reconciliations:write` allows `PUT /reconciliations` and `GET /reconciliations?source=&credential=&from=&to=`. `GET` answers the stored row of each day from `from` to `to`, both included, with when it arrived, the token that sent it and the run that sent it, if any. `from` to `to` spans at most 92 days.

The run token is optional. It proves only which run sent the body. A sender that sends it sends `Costroid-Installation-Id` beside it, and the platform checks both as on an export. The job that reconciles is a scheduled job where the provider's admin key lives, not a pull request's job.

In releases after 1.0.0-alpha.26, Costroid's sender is `costroid reconcile --export`. It sends what `--out` writes.

### How a reader joins it to a pull request

A pull request's rows fall in one or more credential-days: their `SubAccountId`, and the UTC day of their `ChargePeriodStart`. The pull request reads:

- `reconciled` when every one of its credential-days is `matched` and none has `dollars.verdict` `outside`;
- `not reconciled` when any is `tokens_miss`, `price_miss` or `outside`;
- `pending` otherwise, a missing result included.

A later day of a span reads by its first day's row, the row of `span.from`. When that row is not stored, because it was sent in another body or not sent, the later day reads `pending`. A reader never takes a later row's `state` alone as the verdict, because the dollar verdict lives only on the first row.

`no_bill` is compatible with reconciled: dollars are compared only where a bill exists. A reader that shows `final` uses four readings: "Reconciled", "Reconciled, provisional" (all matched, at least one day not final), "Not reconciled" and "Pending". Each is a stated value: the tenant's own job said it, and the reader shows who sent it and when.

A result is about a credential's whole day, not one pull request. On a key several runs share, `matched` says all their rows together match the provider. A `matched` row with `final` false can still move.

### Limits

`GET /quotas` states each limit, and the first four can only rise.

| Quota                           | Limit     | Bounds                                                                                           |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `max_reconciliation_lines`      | 500       | The lines of one body                                                                            |
| `max_reconciliation_bytes`      | 1,048,576 | One body, in bytes                                                                               |
| `max_reconciliation_line_bytes` | 16,384    | One line, in bytes                                                                               |
| `reconciliations_per_day`       | 48        | The bodies stored in a UTC day, two sends an hour from a scheduled job, beside `exports_per_day` |
| `max_reconciliation_range_days` | 92        | The days one `GET /reconciliations` spans                                                        |

A body past the first three answers 413 `RECONCILIATION_TOO_LARGE` and stores nothing.

### Refusals

A request is refused before anything is stored.

| Code                            | Status | Meaning                                                                                       |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `AUTH_TOKEN_INVALID`            | 401    | The token is absent, unknown, expired or revoked                                              |
| `PLAN_WRITES_REFUSED`           | 402    | The tenant's plan does not allow writes at present                                            |
| `AUTH_TOKEN_SCOPE`              | 403    | The token lacks `reconciliations:write`                                                       |
| `RUN_TOKEN_INVALID`             | 403    | The run token fails verification                                                              |
| `RUN_TOKEN_OWNER_MISMATCH`      | 403    | The run token names another owner than the installation                                       |
| `INSTALLATION_NOT_BOUND`        | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one |
| `RECONCILIATION_TOO_LARGE`      | 413    | The body is past a limit the platform states in `GET /quotas`                                 |
| `RECONCILIATION_INVALID`        | 422    | A line is not a row of this version. The answer names the line                                |
| `QUOTA_RECONCILIATIONS_PER_DAY` | 429    | The body would pass `reconciliations_per_day`, under [Quota signals](#quota-signals)          |

A sender that meets 402 keeps the rows and warns. It never fails a check on that answer, because nothing in the rows is wrong and they can be sent later.

## Quota signals

`GET /quotas` answers every limit that applies to the tenant. Each export answer also carries `Costroid-Quota-State`, the most urgent state across them: `ok`, `approaching` at 80% of a limit, or `exhausted`.

Three quotas bound exports. `exports_per_day` counts the batches accepted for ingest in a UTC day, restatements included, and a repeat of bytes already held is not counted. `export_bytes_per_day` sums their bodies in bytes. `max_batch_bytes` bounds one body in bytes.

Five bound reconciliations, under [Limits](#limits). There is no quota on merge facts, because the number of merges bounds them.

A refused export answers 429 with `Retry-After` and an error code named after the quota, such as `QUOTA_EXPORTS_PER_DAY`, and stores nothing. A refused reconciliation body does the same. A quota refusal never changes a check conclusion, and the sender keeps the rows and retries.

## Changes from 0.4

- `GET /identity` states version `0.5` in `contract`. Rows are still `focus-row/v0.5` and tags `tags/v0.4`.
- `PUT` and `GET /merges/{merge_id}` carry one fact per merged pull request, graded `token_verified` or `unverified`, under [The merge fact](#the-merge-fact).
- `PUT` and `GET /reconciliations` carry `costroid reconcile --out`'s row with `currency` added, under [The reconciliation result](#the-reconciliation-result).
- Two scopes, `merges:write` and `reconciliations:write`.
- `PLAN_WRITES_REFUSED` answers both `PUT`s, as on an export.
- Five refusals: `MERGE_FACT_CONFLICT`, `MERGE_FACT_IDENTITY_MISMATCH`, `MERGE_FACT_INVALID`, `RECONCILIATION_INVALID` and `RECONCILIATION_TOO_LARGE`. An unknown merge id answers 404 `MERGE_FACT_NOT_FOUND`.
- Five quotas in `GET /quotas`: `reconciliations_per_day`, `max_reconciliation_lines`, `max_reconciliation_bytes`, `max_reconciliation_line_bytes` and `max_reconciliation_range_days`.
- No answer of version 0.4 changes.
