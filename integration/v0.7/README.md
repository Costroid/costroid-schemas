# Integration contract, version 0.7

How Costroid and Costroid Platform identify a tenant, authenticate, move FOCUS rows, merge facts, reconciliation results and attested gateway keys, and report quotas. The contract is [`openapi.json`](openapi.json), OpenAPI 3.1. Both products implement it, and there is no second contract.

Version 0.7 is [version 0.6](../v0.6/README.md) with one new pair of paths and three changes to the export path. A run of a protected default branch can attest which run a gateway key is for, another can state that key's spend, and a ledger grades a row `exact` only on such a key. A row's pull request comes from the run token where the token names one. A batch belongs to one attempt. A row from a developer's machine is refused. [Changes from 0.6](#changes-from-06) lists each change and its reason.

All names and figures in `examples/` are synthetic.

## The runs of one key

Three runs take part in one gateway key, and this contract names each one the same way throughout.

- **The run a key is for**: the pull request's own run, whose agent spends on the key. Its run id and attempt name it in the audience and the body of both credential writes, and its rows carry the key in `SubAccountId`.
- **The attesting run**: a protected run that `workflow_run` starts when the run a key is for is requested. It mints the key, and its token signs the attestation.
- **The closing run**: a protected run that `workflow_run` starts when the run a key is for has completed. It reads the gateway's settled figure, and its token signs the spend.

The attesting run and the closing run are two runs, each with a run id of its own.

## Versions

The version is in the path: `/api/integration/v0.7`. A published version never changes in place. A later version is a new directory here and a new path there.

The rows of this version are [`focus-row/v0.6`](../../focus-row/v0.6/README.md) with the tag set [`tags/v0.5`](../../tags/v0.5/README.md). They declare FOCUS 1.4, as the rows of version 0.6 do. No column changed.

### A path the platform does not mount

A platform gives one answer for a path it does not mount: 404, with the body `{"error":{"code":"NOT_FOUND","message":"No such route."}}`, [`examples/Error.not-mounted.json`](examples/Error.not-mounted.json). It answers so on every path under `/api/integration/` whose version it does not speak, and on every path under that root while its integration paths are shut, for every method, with or without a token. Inside a version it speaks, with its paths open, a route that version does not define answers as that version says.

A sender that meets this answer warns and goes on, and never fails a check on it. A platform that does not speak this version and a platform whose paths are shut answer alike, and nothing in the sender's work is wrong.

### Between the two sides

A sender asks `GET /identity` and sends by the newest version both sides speak.

| Sender | Platform | What happens                                                                                                                                                                                                                                                    |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.7    | 0.6      | `GET /identity` of version 0.7 answers 404 `NOT_FOUND`, so the rows go by a version both speak and read as they read there: a `run_identity`, and no grade. A credential statement reaches a path the platform does not mount, answers 404, and its run goes on |
| 0.6    | 0.7      | The rows ingest under version 0.6 as before. No key is attested and no row's pull request comes from its token, so no row reads `exact`                                                                                                                         |
| 0.7    | 0.7      | Every rule below applies                                                                                                                                                                                                                                        |

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

GitHub's [OpenID configuration](https://token.actions.githubusercontent.com/.well-known/openid-configuration) lists `ref_protected` in `claims_supported` (retrieved 2026-11-01). The claim reference does not describe it. Real tokens carry it as a string. A recorded GitHub Actions run 44907953360 (2026-11-21), a push to a branch that is not protected, printed the string `"false"`. Recorded runs 45109326900 and 45109345722 (2026-11-23), on a default branch a ruleset protects, printed the string `"true"`.

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

| Code                                   | Status | Meaning                                                                                     |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `INSTALLATION_PROOF_MISSING`           | 400    | The body holds no proof, or no compact JWS                                                  |
| `INSTALLATION_PROOF_ISSUER_UNTRUSTED`  | 403    | The issuer is not GitHub Actions, GitLab.com or Costroid's hosted service                   |
| `INSTALLATION_PROOF_SIGNATURE_INVALID` | 403    | Not RS256, an unknown key id, or a failed signature                                         |
| `INSTALLATION_PROOF_AUDIENCE_MISMATCH` | 403    | The audience is not this tenant's                                                           |
| `INSTALLATION_PROOF_EXPIRED`           | 403    | Outside the window, or issued before the installation's last change                         |
| `INSTALLATION_PROOF_CLAIMS_INVALID`    | 403    | A stable id is absent or is not a number                                                    |
| `INSTALLATION_PROOF_UNPROTECTED_RUN`   | 403    | The run could start without the owner's branch rules                                        |
| `INSTALLATION_PROOF_SUBJECT_MISMATCH`  | 403    | The proof names another installation than the path                                          |
| `INSTALLATION_BOUND_ELSEWHERE`         | 409    | The proof is valid, and another tenant holds the owner under a rule the proof does not beat |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE`  | 503    | The issuer's keys cannot be read. Retry the same proof inside its window                    |

`examples/BindingCase.*.json` and `examples/rejected/BindingCase.*.json` are test vectors for these rules. Each states what one request sees and what it must answer, and `scripts/validate.mjs` runs them. An implementation runs the same files.

### Threats

| Threat       | What the attacker does                                                            | The rule that answers it                                                                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Squat        | A stranger names `github:58120394` first                                          | No binding without a proof, and only the SCM or the hosted service signs one. The stranger gets `INSTALLATION_PROOF_MISSING` or `INSTALLATION_PROOF_SUBJECT_MISMATCH`, and no binding exists to block anyone                                                                                                                                                     |
| Inside squat | A writer on one repository, with a tenant of their own, binds the owner           | GitHub needs a schedule from the default branch or a push to a protected ref, GitLab a protected ref. If the writer can still get there, for example under a ruleset that matches every branch, the App displaces them at once. On GitLab the owner removes the access and the binding goes stale in 7 days                                                      |
| Replay       | A captured proof is sent again                                                    | The audience fixes the tenant, the path must match the proof, and the window is 600 seconds. A replay by the tenant it names changes nothing. A proof older than the installation's last change is refused                                                                                                                                                       |
| Stolen proof | A proof leaks from a job log or a request                                         | It names one tenant, so it is useless without that tenant's bearer with `installations:write`. With both, it can only bind the owner to the tenant it already names. It opens nothing at the SCM                                                                                                                                                                 |
| Uninstall    | The App is removed, and an old binding or proof lingers                           | The binding ends `revoked` on the signed delivery, and the tenant keeps its rows. Exports under it answer `INSTALLATION_NOT_BOUND`. If the delivery is lost, a new installation displaces it. An older proof is `INSTALLATION_PROOF_EXPIRED`                                                                                                                     |
| Transfer     | A repository, a project or an organization changes hands                          | A new owner id is a new binding. A sale keeps the id, and a reinstall clears the old holder. Rows never move                                                                                                                                                                                                                                                     |
| Forged rows  | A workflow that can read the integration token sends rows for a run it never made | A `token_verified` row must name the run and the repository of the run token beside it, and under a `pull_request` run token its pull request, or the batch fails. A row without a run token stays `unverified`. No row an agent's job wrote is budget evidence, under [What a row proves](#what-a-row-proves), and no row reads `exact` without an attested key |

The remaining risks are stated. An owner whose default branch takes unreviewed pushes gives every writer a CI proof. `ref_protected` does not mean the default branch: a ruleset that matches every branch makes any writer's push protected, so the App still outranks that proof and displaces its holder. A private repository on a plan with no branch protection still needs `schedule` or the App. A repository administrator can install the App and hold the owner until an organization owner reinstalls it. A person who approves a change to a workflow file can be misled into naming a stranger's tenant. A holder of the integration token can restate a batch of `unverified` rows it did not send. A merge fact's `pull_request` and `merged_at` are the sender's reading of the host, and a `token_verified` grade does not prove them, under [What the run token proves](#what-the-run-token-proves). A protected branch that is not the default branch also grades a merge fact `token_verified`, so the fact carries its branch, under [What the grade costs](#what-the-grade-costs). A reconciliation result is the sending tenant's statement about its own key, and the platform reads no provider report to check it, under [What it proves, and the scope](#what-it-proves-and-the-scope). An attestation's own threats are under [Threats to an attestation](#threats-to-an-attestation), and what no rule here proves is under [What stays impossible](#what-stays-impossible).

## Tokens

Every request carries an integration token as a bearer: `costroid_it_` followed by 43 URL-safe characters. A tenant administrator issues one on the platform, which shows the secret once and stores only its SHA-256.

A token belongs to one tenant, carries one or more scopes and expires.

| Scope                   | Allows                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `identity:read`         | `GET /identity`                                                   |
| `installations:write`   | `PUT` and `DELETE /installations/{installation_id}`               |
| `rows:write`            | `PUT` and `GET /exports/{batch_id}`                               |
| `merges:write`          | `PUT` and `GET /merges/{merge_id}`                                |
| `credentials:write`     | `PUT /credentials/{key_id}` and `PUT /credentials/{key_id}/spend` |
| `reconciliations:write` | `PUT` and `GET /reconciliations`                                  |
| `quotas:read`           | `GET /quotas`                                                     |

`/tokens/current` reads and revokes the token in use, and `POST /tokens/current/rotate` replaces it. The old token works until `previous_token_expires_at`, so a client can switch without a gap.

An absent, unknown, expired or revoked token answers one `AUTH_TOKEN_INVALID`. The answer does not say which.

This token authenticates one product to the other. It says which tenant sends, never which run. A CI proof is a separate token with a separate audience, under Identity, and so is the run token below.

## The run token

A CI job that sends rows also sends its own ID token in `Costroid-Run-Token`. The integration token says which tenant the rows are for. The run token says which run sent them, and on a `pull_request` run which pull request.

The job asks GitHub Actions for an ID token with the audience `https://app.costroid.com/tenants/<tenant_id>/rows`, under `id-token: write` ([OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc), retrieved 2026-11-01). The audience ends in `/rows`, so a run token never passes as a CI proof, and a CI proof never passes as a run token.

The platform verifies the token as it verifies a CI proof: RS256 against GitHub's published keys, the issuer `https://token.actions.githubusercontent.com`, this tenant's rows audience, and the same window of 600 seconds after `iat`, never past `exp`, with 60 seconds of clock skew. It reads five claims, all strings: `repository`, `repository_id`, `repository_owner_id`, `run_id` and `run_attempt`. It never stores or logs the token.

Each path reads more claims, and each claim a path reads is a string. A claim of another type fails verification, `RUN_TOKEN_INVALID`. The credential paths are the exception for the three claims that make a run protected: any value but their own, of any type, answers `CREDENTIAL_RUN_UNPROTECTED`, under [The order of checks](#the-order-of-checks).

| Path                                      | Claims read beyond the five                                                     | Under                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `PUT /exports/{batch_id}`                 | `event_name` and `ref`, both required                                           | [The pull request](#the-pull-request)                         |
| `PUT /merges/{merge_id}`                  | `sha`, `ref`, `ref_type` and `ref_protected`                                    | [The merge fact](#who-sends-it-and-what-the-run-token-proves) |
| `PUT /credentials/{key_id}` and its spend | `event_name`, `ref` and `ref_protected`, all required, under their own audience | [The order of checks](#the-order-of-checks)                   |
| `PUT /reconciliations`                    | None                                                                            | [The reconciliation result](#what-it-proves-and-the-scope)    |

Recorded GitHub Actions runs 45108986156, 45109004242 and 45109345722 (2026-11-23) printed each of these claims as a string.

| Check                                                                                                                                   | Answer                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The header is present and fails verification                                                                                            | 403 `RUN_TOKEN_INVALID`, nothing stored        |
| `repository_owner_id` is not the owner of the installation in `Costroid-Installation-Id`                                                | 403 `RUN_TOKEN_OWNER_MISMATCH`, nothing stored |
| A `token_verified` row names a `costroid/workflow_run_id` other than `run_id`                                                           | The batch fails `ROW_IDENTITY_MISMATCH`        |
| A `token_verified` row names a `costroid/repo` other than `github.com/` and `repository`, lower-cased under [Letter case](#letter-case) | The batch fails `ROW_IDENTITY_MISMATCH`        |
| The token names pull request `n`, and a `token_verified` row names a `costroid/pr` other than `n`                                       | The batch fails `ROW_IDENTITY_MISMATCH`        |
| The token names no pull request                                                                                                         | Each row's `costroid/pr` is stored as sent     |
| A batch without the header holds a `token_verified` row                                                                                 | The batch fails `RUN_TOKEN_MISSING`            |
| A batch without the header holds only `unverified` rows                                                                                 | Ingests. Its rows stay `unverified`            |

The owner of a `github-owner:` installation is its number. The owner of a `github:` installation is the account the App is installed on, the `owner_id` its binding stored. The two synchronous checks run before the body is stored. The row checks run on ingest, so their codes arrive in `GET /exports/{batch_id}`, and a batch that fails them stores no row.

This version defines the run token for GitHub Actions only. A GitLab job sends no run token, so its rows stay `unverified`.

### The pull request

A token names pull request `n` only when its `event_name` is `pull_request` and its `ref` is `refs/pull/<n>/merge`. [`examples/ExportRunTokenClaims.json`](examples/ExportRunTokenClaims.json) names pull request 1423. Under such a token, a `token_verified` row whose `costroid/pr` is not `n` fails its batch `ROW_IDENTITY_MISMATCH`, with the sentence `"2 token_verified row(s) name another pull request than the run token."`, [`examples/ExportBatch.failed-row-pull-request-mismatch.json`](examples/ExportBatch.failed-row-pull-request-mismatch.json). A batch whose rows also name another run or repository gets the same sentence, because it is the one a reader can act on without this contract open. A batch that also holds a row stating `costroid/origin` fails `ROW_ORIGIN_REFUSED` instead, under [Failed batches](#failed-batches).

Under any other token the batch is not refused for its pull request. Each row's `costroid/pr` is stored as the sender's statement, and no such row reads `exact`. [`examples/ExportRunTokenClaims.pull-request-target.json`](examples/ExportRunTokenClaims.pull-request-target.json) is such a token.

| Event                                                                                          | The token's `ref`            | Where it was read                                                                                           | The pull request |
| ---------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| `pull_request`                                                                                 | `refs/pull/<n>/merge`        | A recorded GitHub Actions run 45108986156 (2026-11-23), and the events page                                 | From the token   |
| `pull_request`, closed and merged                                                              | The base branch              | The events page, which gives a merged close the base branch's ref. No token read                            | Stated           |
| `pull_request_review`, `pull_request_review_comment`                                           | `refs/pull/<n>/merge`        | The events page. No token read                                                                              | Stated           |
| `pull_request_target`                                                                          | The default branch           | The events page: it runs "in the context of the default branch of the base repository"                      | Stated           |
| `merge_group`                                                                                  | The merge group's ref        | The events page, which gives no form. No token read                                                         | Stated           |
| `push`                                                                                         | The pushed branch            | A recorded run 44894920019 (2026-11-21)                                                                     | Stated           |
| `workflow_dispatch`                                                                            | The branch or tag dispatched | A recorded run 45109326900 (2026-11-23)                                                                     | Stated           |
| `workflow_run`, `schedule`, `issue_comment`, `check_run`, `check_suite`, `repository_dispatch` | The default branch           | Recorded runs 45109004242 and 45109345722 (2026-11-23) for `workflow_run`, and the events page for the rest | Stated           |

The events page is [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-23. A `pull_request_review` run's `ref` is a pull request's merge ref, and its pull request is still stated: the rule reads `event_name` and `ref` together.

GitHub's `workflow_run` event lists a run's pull requests, and a head that belongs to two pull requests names both. A `pull_request` run names one, in its `ref`. Rows are filed under the pull request their own run's token names, never under both, so no figure is counted twice.

### The head commit

The export path never takes a head from a run token. On a `pull_request` run the token's `sha` is the merge commit, not the pull request's head: run 45108986156 printed it so. `costroid/commit_sha` is the sender's statement on this path. A row reads `exact` only when its stated head equals the head a protected run attested, under [What a ledger grades](#what-a-ledger-grades), and that head is GitHub's event's, not the sender's.

## Letter case

A repository's name is compared in lower case. GitHub can name a repository `Example/Widgets` in the run token's `repository`. A sender writes `costroid/repo` and a merge document's `repo` in lower case, the whole string with its host: `github.com/example/widgets`.

The platform lower-cases the whole string it builds from the token, `github.com/` followed by `repository`, host included, before it compares. The comparison is made in five places:

- The row check: a `token_verified` row's `costroid/repo` against the run token, under [The run token](#the-run-token). A row that differs fails its batch `ROW_IDENTITY_MISMATCH`.
- The merge check: a merge document's `repo` against the run token, under [Who sends it, and what the run token proves](#who-sends-it-and-what-the-run-token-proves). A document that differs answers `MERGE_FACT_IDENTITY_MISMATCH`.
- The join of a merge fact to rows: the rows' `costroid/repo`, lower-cased whole, against the fact's `repo`, under [What it says](#what-it-says).
- The join of an attested key to rows: the attestation's `repo`, built from the attesting run's token, against the repository of the rows' run token, under [What a ledger grades](#what-a-ledger-grades).
- The restatement: the repository of the run token that sent a batch's active rows against the repository of the run token that restates it, under [A batch belongs to one attempt](#a-batch-belongs-to-one-attempt).

What a sender wrote is not lower-cased for it. A `token_verified` row whose `costroid/repo` holds an upper-case letter never equals the lower-cased token, so its batch fails `ROW_IDENTITY_MISMATCH`. A merge document whose `repo` holds an upper-case letter answers `MERGE_FACT_INVALID`, because the form of `repo` admits none. Both are refused for one reason: two spellings of one repository would read as two repositories.

So a run token for `Example/Widgets` admits rows of `github.com/example/widgets`. [`examples/RunTokenClaims.upper-case-repository.json`](examples/RunTokenClaims.upper-case-repository.json) is such a token. A merge document with `github.com/Example/widgets`, [`examples/rejected/MergeDocument.MERGE_FACT_INVALID.upper-case-repo.json`](examples/rejected/MergeDocument.MERGE_FACT_INVALID.upper-case-repo.json), is refused.

[`tags/v0.5`](../../tags/v0.5/README.md) writes `costroid/repo` in lower case, and its schema refuses an upper-case letter. The platform's checks on a batch are the ones above: an `unverified` row is not refused for its case, and the join reads it lower-cased.

## What a row proves

A run token proves which repository and which run sent a batch, and on a `pull_request` run which pull request. It proves nothing about the counts in it. The rows file is written by the agent's own job, and an agent that can run commands can rewrite it.

So a row is budget evidence only when its spend was measured outside the agent's job: by a gateway's own count of spend on the run's key, or by the provider's own report reconciled with the rows (`costroid/cost_source` `provider_report`, `costroid/cost_basis` `billed`).

This version carries the gateway's count beside the rows, never in them, under [The spend](#the-spend). An attested gateway count is the gateway's figure on the run's key, written once by a protected run, in the gateway's own prices. A reader shows it beside the rows, never as their figure and never added to it.

Every other row, `token_verified` or not, is attributed and shown in its own basis. It may raise a budget alert. It never shows that a budget held.

## What a ledger grades

The grade is the ledger's, read from the evidence it holds when it reads. It is never taken from a row's `costroid/attribution_grade`, which stays stored as sent. A row and its key's attestation can arrive in either order, and the grade is the same.

A row reaches its run and its attempt through its batch, whose run token names both. Its key is its `SubAccountId`.

| Evidence                                                                                                                                                            | `run_identity`   | Grade              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ |
| No run token                                                                                                                                                        | `unverified`     | `unattributed`     |
| A run token that names no pull request. The row's pull request is stated                                                                                            | `token_verified` | `windowed`         |
| A `pull_request` run token for `n`. The row's key is not attested, is attested for another repository, run or attempt, or is the row's `costroid/session_id`        | `token_verified` | `windowed`         |
| A `pull_request` run token for `n`, and the row's key is attested for the token's repository, run and attempt. The row's stated head differs from the attested head | `token_verified` | `windowed`         |
| A `pull_request` run token for `n`, and the row's key is attested for the token's repository, run and attempt. The row's stated head equals the attested head       | `token_verified` | `exact`            |
| Any of the above, and the row states `windowed`                                                                                                                     | As above         | At most `windowed` |
| A row received on version 0.6 or earlier                                                                                                                            | As stored        | At most `windowed` |

An attested key is one that `PUT /credentials/{key_id}` stored. That path takes a statement from a run of a protected branch alone, so a ledger holds no attestation from any other run.

A sender may lower a row and never raise it. A row that states `windowed` reads `windowed` at most. A stated `exact` or `unattributed` changes nothing, because the grade is the ledger's.

A row that claims more than its evidence is stored and shown at the ledger's grade, beside its basis, and is never refused for it. A row whose stated run, repository or pull request is not its `pull_request` run token's fails its batch `ROW_IDENTITY_MISMATCH`, because that is a false join, not a weak one.

### What `exact` proves

A row that reads `exact` proves three things. A run of a protected branch, started by `workflow_run`, attested that the row's key is for this run and attempt. The row was sent under this run's own token, which names its pull request. The row's head is the head GitHub's event named to the attesting run.

It proves nothing about the row's counts, which the agent's job wrote, and nothing about spend on any other credential. It is never reached where the default branch cannot be protected. [What stays impossible](#what-stays-impossible) lists the rest.

## The export endpoint

`PUT /exports/{batch_id}` sends one CSV of [FOCUS rows](../../focus-row/v0.6/README.md). The tenant comes from the token, never from the body. The rows carry the [tag set](../../tags/v0.5/README.md) in their `Tags` column, and it needs no mapping. [`examples/FocusRow.export-body.csv`](examples/FocusRow.export-body.csv) is a body, and `scripts/validate.mjs` checks each of its rows against `focus-row/v0.6` and the rule of [A run's rows alone](#a-runs-rows-alone). Its rows carry the three tags a caller names and `costroid/repo_visibility`. Each states the head that [`examples/CredentialAttestation.json`](examples/CredentialAttestation.json) attests, and eight of them spend on its key.

### Default rows only

The body holds rows in the row contract's [default profile](../../focus-row/v0.6/README.md#profiles), the profile its CSV form writes. A row that carries `x_CostroidMeasuredCost` is in the strict profile: its `EffectiveCost` is 0, and its figure is in that column. Such a row fails the batch `ROW_PROFILE_STRICT`. Send the default row, which keeps the figure in `EffectiveCost`.

### A run's rows alone

A row that states `costroid/origin` fails its batch `ROW_ORIGIN_REFUSED`, and the batch stores nothing. Such a row counts a developer's own session on their machine. It is not a run's row, and this path takes a run's rows alone. [`examples/rejected/FocusRow.ROW_ORIGIN_REFUSED.developer-machine.json`](examples/rejected/FocusRow.ROW_ORIGIN_REFUSED.developer-machine.json) is one, and [`examples/ExportBatch.failed-row-origin.json`](examples/ExportBatch.failed-row-origin.json) is the batch it fails.

### The batch id

From GitHub Actions the batch id is `<repository_id>-<run_id>-<run_attempt>`, for example `903114-16873409921-1`. A retry of one run's send restates its batch. A re-run attempt runs the agent again, so it adds a batch. Another sender chooses its own id, unique within the tenant.

The batch id decides what a request means.

| Request                              | Effect                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| A new `batch_id`                     | Adds rows                                                                                     |
| The same `batch_id`, the same bytes  | Answers 200 and changes nothing, so a retry is safe                                           |
| The same `batch_id`, different bytes | Replaces every row of the earlier bytes, in every month they named, once the new bytes ingest |

A restatement is month-wide. When the earlier bytes named October and November and the new bytes name November only, the batch's October rows are retired with the rest. A batch's rows never replace another batch's.

### A batch belongs to one attempt

A batch whose active rows hold `token_verified` rows belongs to its run and its attempt. Only a request whose run token names the same run, repository and attempt restates it, the repository compared in lower case. Any other request answers 409 `EXPORT_BATCH_RUN_BOUND` and stores nothing.

A later attempt of a run never restates a batch an earlier attempt sent. It sends a batch of its own, and both stand. Each attempt ran the agent and spent, so each attempt's rows belong in the total, and a grade reads the attempt. A restatement within one attempt is as above.

A batch whose rows are all `unverified` restates as before. A restatement that fails ingest leaves the earlier rows active and the batch bound. A sender that meets `EXPORT_BATCH_RUN_BOUND` keeps the rows and warns, and does not retry under the same batch id.

The sentence `EXPORT_BATCH_RUN_BOUND` answers in this version is the one sentence the platform words when it builds this rule, and it states that a batch belongs to one attempt. Until then, the message of [`examples/ExportRefusal.EXPORT_BATCH_RUN_BOUND.json`](examples/ExportRefusal.EXPORT_BATCH_RUN_BOUND.json) stands in for it. Version 0.6's sentence for this code names the run alone, and it is not this version's.

`examples/RestatementCase.*.json` and `examples/rejected/RestatementCase.*.json` are test vectors for this rule. Each states one restatement the platform sees and what it must answer, and `scripts/validate.mjs` runs them. [`examples/rejected/RestatementCase.EXPORT_BATCH_RUN_BOUND.a-later-attempt.json`](examples/rejected/RestatementCase.EXPORT_BATCH_RUN_BOUND.a-later-attempt.json) is a later attempt that restates an earlier attempt's batch.

### Tags outside the prefix

The platform drops every `Tags` key outside `costroid/` before storage, whatever its value, because a free-form key and value are where content would hide. `dropped_tag_keys` counts the dropped entries across the batch. No dropped name or value is kept.

### Refusals

A request is refused before anything is stored.

| Code                                  | Status | Meaning                                                                                                                     |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `TOOL_INPUT_INVALID`                  | 400    | The batch id in the path is malformed, or a header is missing or malformed                                                  |
| `AUTH_TOKEN_INVALID`                  | 401    | The token is absent, unknown, expired or revoked                                                                            |
| `AUTH_TOKEN_SCOPE`                    | 403    | The token lacks `rows:write`                                                                                                |
| `RUN_TOKEN_INVALID`                   | 403    | The run token fails verification, or its `event_name` or `ref` is absent or not a string                                    |
| `RUN_TOKEN_OWNER_MISMATCH`            | 403    | The run token names another owner than the installation                                                                     |
| `NOT_FOUND`                           | 404    | The platform does not mount this version                                                                                    |
| `INSTALLATION_NOT_BOUND`              | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                               |
| `EXPORT_BATCH_BUSY`                   | 409    | Other bytes of this batch are ingesting                                                                                     |
| `EXPORT_BATCH_RUN_BOUND`              | 409    | The batch's active rows hold `token_verified` rows, and the run token is absent or names another run, repository or attempt |
| `FILE_TOO_LARGE`                      | 413    | The body exceeds `max_batch_bytes`                                                                                          |
| `HASH_MISMATCH`                       | 422    | The body does not hash to `Costroid-Content-SHA256`                                                                         |
| `QUOTA_` and a quota's name           | 429    | The request would pass a quota, under [Quota signals](#quota-signals)                                                       |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE` | 503    | GitHub's key set cannot be read. Retry inside the run token's window                                                        |

`TOOL_INPUT_INVALID` and `AUTH_TOKEN_SCOPE` are answered as follows:

- `TOOL_INPUT_INVALID`, 400, answers a malformed batch id in the path, or a header that is missing or malformed. Its message names each fault the platform found, such as `Not an installation id.`. `GET /exports/{batch_id}` answers it for a malformed batch id.
- `AUTH_TOKEN_SCOPE` answers `"The integration token does not carry the scope this request needs."`, [`examples/ExportRefusal.AUTH_TOKEN_SCOPE.json`](examples/ExportRefusal.AUTH_TOKEN_SCOPE.json).

A sender that meets 429 keeps the rows and warns. It never fails a check on that answer, because nothing in the rows is wrong and they can be sent later.

### Failed batches

A batch ingests whole or fails whole. A failed batch changes nothing, and `GET /exports/{batch_id}` carries its typed `failure`.

| Code                        | The batch                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `RUN_TOKEN_MISSING`         | Holds a `token_verified` row and came without a run token                                               |
| `ROW_IDENTITY_MISMATCH`     | Holds a `token_verified` row whose run, repository or pull request is not the run token's               |
| `ROW_ORIGIN_REFUSED`        | Holds a row that states `costroid/origin`                                                               |
| `ROW_COST_INCONSISTENT`     | Holds a row whose `ListCost` or `ContractedCost` is not its unit price times `PricingQuantity`, exactly |
| `ROW_PROFILE_STRICT`        | Holds a row that carries `x_CostroidMeasuredCost`, the strict profile                                   |
| `UNPARSEABLE_FILE`          | Cannot be read as CSV, or holds a `Tags` cell that names one `costroid/` key twice                      |
| `MISSING_MANDATORY_COLUMNS` | Lacks a column FOCUS 1.4 requires                                                                       |
| `INVALID_TIMESTAMP`         | Holds a timestamp that is not one                                                                       |
| `NON_NUMERIC_COST`          | Holds a cost that is not a number                                                                       |
| `EXCESS_NUMERIC_PRECISION`  | Holds a value past 12 fractional digits                                                                 |
| `UNKNOWN_FOCUS_VERSION`     | Does not read as FOCUS 1.4                                                                              |
| `EMPTY_FILE`                | Holds no rows                                                                                           |
| `HASH_MISMATCH`             | Did not hash to `Costroid-Content-SHA256` when the platform read it back                                |
| `FILE_TOO_LARGE`            | Is larger than the platform ingests                                                                     |
| `INGEST_RETRY_EXHAUSTED`    | Could not be ingested after the platform's retries                                                      |

Two failures answer the platform's own sentences, and `openapi.json` holds each: `ROW_COST_INCONSISTENT` answers `"1 row(s) carry a ListCost or ContractedCost that is not its unit price times PricingQuantity."`, with the count of such rows, [`examples/ExportBatch.failed-row-cost-inconsistent.json`](examples/ExportBatch.failed-row-cost-inconsistent.json). `EXCESS_NUMERIC_PRECISION` on a CSV body answers `"FOCUS numeric columns are stored as DECIMAL(38,12), which holds 12 fractional digits exactly. These cells need more, and storing them would mean keeping a different number from the one this file states. Round them to 12 fractional digits yourself and upload again, so the rounding is yours rather than ours."`, [`examples/ExportBatch.failed.json`](examples/ExportBatch.failed.json).

`ROW_ORIGIN_REFUSED` answers `"1 row(s) state costroid/origin. A row from a developer's machine is not a run's row, and this path takes a run's rows alone."`, with the count of such rows.

The row checks run in one order, and the first failure answers:

1. A row that states `costroid/origin`: `ROW_ORIGIN_REFUSED`.
2. A `Tags` cell that names one `costroid/` key twice: `UNPARSEABLE_FILE`, with the sentence `"1 Tags cell(s) name one costroid/ key twice."` and the count of such cells. Such a cell does not say which of two stated facts is true, so nothing can be judged about that row's identity until it is refused.
3. A `token_verified` row in a batch that came without a run token: `RUN_TOKEN_MISSING`.
4. A `token_verified` row that names another run or repository than the run token, or another pull request than its `pull_request` run token: `ROW_IDENTITY_MISMATCH`, with the pull request's sentence where a batch has both mismatches.
5. Then the cost check, `ROW_COST_INCONSISTENT`, and the profile check, `ROW_PROFILE_STRICT`, as in version 0.6.

So a batch that holds a row stating `costroid/origin` and a row naming another pull request fails `ROW_ORIGIN_REFUSED`, and nothing of it is stored: [`examples/rejected/IngestCase.ROW_ORIGIN_REFUSED.origin-and-another-pull-request.json`](examples/rejected/IngestCase.ROW_ORIGIN_REFUSED.origin-and-another-pull-request.json). So does a batch that holds a row stating `costroid/origin` and a cell that names a key twice: [`examples/rejected/IngestCase.ROW_ORIGIN_REFUSED.origin-and-a-key-named-twice.json`](examples/rejected/IngestCase.ROW_ORIGIN_REFUSED.origin-and-a-key-named-twice.json). A batch that came without a run token and holds a cell that names a key twice fails `UNPARSEABLE_FILE`: [`examples/rejected/IngestCase.UNPARSEABLE_FILE.a-key-named-twice-without-a-run-token.json`](examples/rejected/IngestCase.UNPARSEABLE_FILE.a-key-named-twice-without-a-run-token.json). `examples/IngestCase.*.json` and `examples/rejected/IngestCase.*.json` are test vectors for this order, which `scripts/validate.mjs` runs.

A client treats a code it does not know as a failed batch.

## The credential attestation

A ledger can grade a row `exact` truthfully only on evidence the CI system signs, because GitHub is the one signer both sides already trust. A row carries its gateway key's id in `SubAccountId`. These two paths let protected runs state, each under its own ID token, which run a key is for and what the gateway counted on it. A ledger grades `exact` only on a key an attesting run attested, under [The runs of one key](#the-runs-of-one-key).

A pull request's own job cannot produce that evidence. It writes its own workflow file, holds the repository's secrets and the integration token, writes its own rows, and can start other runs. Every token it can ask for states its own event and branch, and these paths refuse each of them.

### Who sends it

The attesting run and the closing run run workflows of the default branch that `workflow_run` starts: the attesting run when the run a key is for is requested, the closing run when it has completed. GitHub runs such a workflow from the default branch's file ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-23), so a pull request cannot change what it runs. Recorded GitHub Actions runs 45109004242 and 45109345722 (2026-11-23), each started by `workflow_run`, hold `event_name` `workflow_run`, `ref` `refs/heads/main` and a `workflow_ref` at `refs/heads/main`.

The `workflow_run` event names the run it follows: its `id`, `run_attempt`, `event`, `head_sha`, `head_repository` and `pull_requests`, as run 45109004242 read them. The attesting run takes the run a key is for, its attempt and its head from it. A sender mints nothing for a run whose head repository is not its own, so a fork's code never holds a key.

### The audience

Each write has its own audience.

| Write                             | Audience                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `PUT /credentials/{key_id}`       | `https://app.costroid.com/tenants/<tenant_id>/credentials/<key_id>/<run_id>/<run_attempt>`       |
| `PUT /credentials/{key_id}/spend` | `https://app.costroid.com/tenants/<tenant_id>/credentials/<key_id>/<run_id>/<run_attempt>/spend` |

`run_id` and `run_attempt` are the body's: the run a key is for. The platform builds the audience from the bearer's tenant, the path and the body, and compares it whole, never by prefix. A token minted for one key, run, attempt or write fits no other, and no token of another path fits here.

The example's audience is 142 characters for the attestation and 148 for the spend. GitHub held an audience of 128 characters whole on run 45109004242. A longer one has not been compared with its claim. A token whose audience GitHub cut fails verification, so a cut audience is refused, never matched.

### The order of checks

Both paths check a request in one order, and the first failure answers:

1. The bearer token: 401 `AUTH_TOKEN_INVALID`.
2. A token that holds no scope of this version at all: 403 `AUTH_TOKEN_SCOPE`, at the door.
3. The input: 400 `TOOL_INPUT_INVALID`. The input is the key id in the path, the headers and the body. Both paths carry `Costroid-Installation-Id`, as the export path does, and `Costroid-Run-Token`, and each is required: an absent or malformed one is this 400. So is a body that is not UTF-8, not a JSON object, over 16384 bytes, the merge document's bound, or that holds an unknown key or a value of the wrong form.
4. The scope the path needs, `credentials:write`: 403 `AUTH_TOKEN_SCOPE`.
5. The installation's binding: the installation the request names must be bound to this tenant, or the answer is 409 `INSTALLATION_NOT_BOUND`, a revoked or displaced binding included. It is judged before the run token is looked at.
6. The run token, in this order:
   1. No issuer of it is trusted: 403 `RUN_TOKEN_INVALID`.
   2. The installation is not a GitHub one: 403 `RUN_TOKEN_OWNER_MISMATCH`, by the installation's kind alone, with no token read.
   3. GitHub's key set cannot be read: 503 `INSTALLATION_PROOF_KEYS_UNAVAILABLE`, with a `Retry-After` of 60 seconds, as the export, merge and reconciliation paths answer it. The same token can be sent again inside its window.
   4. The token's form and its signature: 403 `RUN_TOKEN_INVALID`.
   5. Its claims' form, its issuer and its audience, which names the key, the run and the attempt: 403 `RUN_TOKEN_INVALID`.
   6. Its window: 403 `RUN_TOKEN_INVALID`.
   7. Its `repository_owner_id` against the bound installation's owner: 403 `RUN_TOKEN_OWNER_MISMATCH`.
   8. The credential paths' own claims: an `event_name` other than `workflow_run`, a `ref` outside `refs/heads/`, or a `ref_protected` that is absent or anything but the string `"true"`: 403 `CREDENTIAL_RUN_UNPROTECTED`.
7. The store, which decides in one statement, so that two racing sends cannot both pass, and whose statement holds the binding once more. Its answers are under [The attestation](#the-attestation) and [The spend](#the-spend).

Steps 5 and 6 keep a run token to a repository whose owner the tenant's installation binds. Without them, a protected run of any repository could attest a key into a tenant. The owner claim is compared after the signature, the window and the audience, because a check ahead of them would let an unsigned token learn which owner an installation is bound to.

The event is judged apart from the `ref` and its protection, because a `pull_request_target` run sits on the default branch and states it protected, though a pull request starts it. A `pull_request_target`, `push`, `workflow_dispatch` or `schedule` run on a protected default branch passes the `ref` and the protection and is refused by its event alone, for an attestation as for a spend: `examples/rejected/CredentialCase.CREDENTIAL_RUN_UNPROTECTED.*-on-a-protected-branch-*.json`. A `merge_group` run's token `ref` is unread, so no vector holds one; its `event_name` is refused all the same.

`CREDENTIAL_RUN_UNPROTECTED` is a code of its own because a sender can act on it: its run is not a protected `workflow_run` run, so no statement of it is ever taken. `RUN_TOKEN_INVALID` is checked first.

The window is the run token's, 600 seconds after `iat` and never past `exp`, with 60 seconds of clock skew. GitHub's token lives 300 seconds: `exp` less `iat` on run 45109004242. The repository is the token's: `github.com/` and its `repository`, lower-cased whole. The token's `run_id` and `run_attempt` name the attesting run or the closing run, never the run a key is for.

`ref_protected` reads the string `"true"` on a default branch a ruleset protects: recorded runs 45109326900 and 45109345722 (2026-11-23). It reads `"false"` where no branch can be protected: runs 45108986156 and 45109004242, on a private repository on a plan with no branch protection. [`examples/rejected/CredentialRunTokenClaims.CREDENTIAL_RUN_UNPROTECTED.workflow-run-on-an-unprotected-branch.json`](examples/rejected/CredentialRunTokenClaims.CREDENTIAL_RUN_UNPROTECTED.workflow-run-on-an-unprotected-branch.json) holds what run 45109004242 read, `workflow_run` on `refs/heads/main` with `"false"`, and is refused.

The `ref` of a run that `workflow_run` started is the default branch. The platform reads that the branch is protected, and infers no default branch.

The run token is judged before anything the ledger holds is read, so a refusal tells a caller without a protected run's token nothing about what is held.

### The attestation

`PUT /credentials/{key_id}` binds the key to the run it is for: a repository, a run id and an attempt, at one head. The body is [`examples/CredentialAttestationBody.json`](examples/CredentialAttestationBody.json):

```json
{
  "run_id": "16873409921",
  "run_attempt": "1",
  "head_sha": "4b1e0c9d27f35a86e01c7d4f98b2a6e3c5d70f12"
}
```

| Key                   | Form                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `key_id`, in the path | 64 lower-case hexadecimal characters, the value the key's rows carry in `SubAccountId`           |
| `run_id`              | The run a key is for, as a digit string: the event's `workflow_run.id`                           |
| `run_attempt`         | Its attempt, as a digit string: the event's `workflow_run.run_attempt`                           |
| `head_sha`            | Its head commit, 40 or 64 lower-case hexadecimal characters: the event's `workflow_run.head_sha` |

No other key is read, and an unknown key answers 400 `TOOL_INPUT_INVALID`, under [The order of checks](#the-order-of-checks). The body names no pull request: a row is filed under the pull request its own run token names. The repository is the attesting run's, so the run a key is for is a run of that repository.

At the store:

| Request                                                                                                                               | Answer                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A key no attesting run holds, from an attesting repository, run and attempt that holds no key                                         | 201. Stores it                                            |
| The same attestation again: the same key id, run, attempt and head from the same attesting repository, run and attempt, byte for byte | Answered as the first was. Nothing changes                |
| The attesting repository, run and attempt holds another key, or this key with another run, attempt or head                            | 409 `CREDENTIAL_ATTESTING_RUN_USED`                       |
| The key is held by another attesting run                                                                                              | 409 `CREDENTIAL_ATTESTED_ELSEWHERE`. The first one stands |

Where both 409s apply, `CREDENTIAL_ATTESTING_RUN_USED` answers, because it is about who is speaking. Both rules hold within one tenant: an attestation another tenant holds is never read.

The answer of a `PUT` that stores, and of one that repeats it, is the stored attestation, [`examples/CredentialAttestation.json`](examples/CredentialAttestation.json), with `attested_by` read from the token: the attesting run, its attempt and its branch.

### The spend

`PUT /credentials/{key_id}/spend` states the gateway's own count of spend on the key, once, from a closing run. The body is [`examples/CredentialSpendBody.json`](examples/CredentialSpendBody.json):

```json
{
  "run_id": "16873409921",
  "run_attempt": "1",
  "currency": "USD",
  "spend": "0.412"
}
```

`run_id` and `run_attempt` name the run a key is for. No other key is read, and an unknown key answers 400 `TOOL_INPUT_INVALID`. `currency` is `USD`, the gateway's one currency in this version. `spend` is a decimal string of zero or more: digits with no leading zero, and an optional point followed by 1 to 12 digits, at most 64 characters, never a JSON number.

A spend is taken from any run that passes the checks above, a protected `workflow_run` run of the repository, when the key holds an attestation for the same repository, run and attempt the spend names. The closing run is a run of its own, not the attesting run.

At the store, `CREDENTIAL_NOT_ATTESTED` is decided before `CREDENTIAL_SPEND_HELD`:

| Request                                                                                       | Answer                                                                                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The key holds no attestation for the repository, run and attempt the spend names              | 409 `CREDENTIAL_NOT_ATTESTED`: `"The key holds no attestation for this run and attempt, so no figure is taken."` |
| The key holds no spend                                                                        | 201. Stores it                                                                                                   |
| The key holds this decimal string for the same run and attempt, whichever closing run sent it | Answered as the first was. Nothing changes                                                                       |
| The key holds another decimal string, whichever closing run sent it                           | 409 `CREDENTIAL_SPEND_HELD`                                                                                      |

A repeat is the same key, the same run and attempt the key is for, and the same decimal string, whichever closing run sends it. So a closing job run again after a failure reads the same settled figure and is answered, not refused.

A spend never creates an attestation. A key holds one spend. A second figure is never added to the first, and never taken as the larger of two. `"0.412"` and `"0.4120"` are two figures. The cost of this rule is that a figure written before it settled stands, so the closing run sends only a figure that has settled, or none. Both rules hold within one tenant.

The answer is the stored spend, [`examples/CredentialSpend.json`](examples/CredentialSpend.json), with `attested_by` read from the closing run's token. A reader shows it beside the rows of the run a key is for, as the gateway's count in the gateway's own prices, never as the rows' figure.

Each write is bound twice. Its audience names the key, the run, the attempt and the write. The store takes one attestation from an attesting run and attempt, one attestation of a key, and one spend of a key. A captured token expires 300 seconds after its `iat`, and a second use of it is refused or changes nothing. No daily quota bounds these writes: a key holds one attestation and one spend.

### Refusals of a statement

A request is refused before anything is stored. The codes are in the order of checks.

| Code                                  | Status | Meaning                                                                                                                        |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_TOKEN_INVALID`                  | 401    | The token is absent, unknown, expired or revoked                                                                               |
| `AUTH_TOKEN_SCOPE`                    | 403    | The token holds no scope of this version, judged before the input                                                              |
| `TOOL_INPUT_INVALID`                  | 400    | The key id in the path is malformed, a header is missing or malformed, or the body is not of this version's form               |
| `AUTH_TOKEN_SCOPE`                    | 403    | The token lacks `credentials:write`, judged after the input                                                                    |
| `INSTALLATION_NOT_BOUND`              | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                                  |
| `RUN_TOKEN_INVALID`                   | 403    | No issuer of the run token is trusted                                                                                          |
| `RUN_TOKEN_OWNER_MISMATCH`            | 403    | The installation is not a GitHub one, judged by its kind before any token is read                                              |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE` | 503    | GitHub's key set cannot be read. Retry inside the run token's window                                                           |
| `RUN_TOKEN_INVALID`                   | 403    | The run token's form or signature fails, its claims' form, issuer or audience is not this write's, or it is outside its window |
| `RUN_TOKEN_OWNER_MISMATCH`            | 403    | The run token names another owner than the installation                                                                        |
| `CREDENTIAL_RUN_UNPROTECTED`          | 403    | The run token is well signed and is not a protected `workflow_run` run's                                                       |
| `CREDENTIAL_ATTESTING_RUN_USED`       | 409    | This attesting repository, run and attempt holds another key, or this key with another run, attempt or head                    |
| `CREDENTIAL_ATTESTED_ELSEWHERE`       | 409    | The key is held by another attesting run. The first one stands                                                                 |
| `CREDENTIAL_NOT_ATTESTED`             | 409    | A spend for a key that holds no attestation for the run and attempt the spend names                                            |
| `CREDENTIAL_SPEND_HELD`               | 409    | The key holds another decimal string                                                                                           |
| `NOT_FOUND`                           | 404    | The platform does not mount this version                                                                                       |

The platform answers these sentences, each with an example in `examples/`:

| Code                      | Path        | Sentence                                                                                                                    |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `TOOL_INPUT_INVALID`      | Attestation | `The key id in the path is malformed, a header is missing or malformed, or the body is not an attestation of this version.` |
| `TOOL_INPUT_INVALID`      | Spend       | `The key id in the path is malformed, a header is missing or malformed, or the body is not a spend of this version.`        |
| `RUN_TOKEN_INVALID`       | Attestation | `The run token is not valid for this attestation's audience.`                                                               |
| `RUN_TOKEN_INVALID`       | Spend       | `The run token is not valid for this spend's audience.`                                                                     |
| `CREDENTIAL_NOT_ATTESTED` | Spend       | `The key holds no attestation for this run and attempt, so no figure is taken.`                                             |

`openapi.json` carries an example of each code.

An attesting run or a closing run that meets 404 `NOT_FOUND` warns and goes on, under [A path the platform does not mount](#a-path-the-platform-does-not-mount). A refused statement stores nothing, and the rows on its key read `windowed` at most.

`examples/CredentialCase.*.json` and `examples/rejected/CredentialCase.*.json` are test vectors for these rules. Each states what one statement sees once its bearer token is valid and its run token's signature verifies: the token's scopes, the installation it names, what the ledger holds, and what the platform must answer. A vector that fails two checks expects the earlier one's code: [`examples/rejected/CredentialCase.TOOL_INPUT_INVALID.a-pull-request-token-with-a-spend-as-a-number.json`](examples/rejected/CredentialCase.TOOL_INPUT_INVALID.a-pull-request-token-with-a-spend-as-a-number.json) is refused for its input before its token, [`examples/rejected/CredentialCase.INSTALLATION_NOT_BOUND.a-revoked-installation-and-an-expired-token.json`](examples/rejected/CredentialCase.INSTALLATION_NOT_BOUND.a-revoked-installation-and-an-expired-token.json) for its binding before its token, and [`examples/rejected/CredentialCase.RUN_TOKEN_INVALID.expired-for-a-key-held-elsewhere.json`](examples/rejected/CredentialCase.RUN_TOKEN_INVALID.expired-for-a-key-held-elsewhere.json) for its token before the store. `scripts/validate.mjs` runs them, and an implementation runs the same files.

### Threats to an attestation

| Threat                        | What the attacker does                                                                                        | The rule that answers it                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forge from a pull request     | A pull request's job asks for an ID token with a credential audience and attests a key, a shared one included | Its token states `event_name` `pull_request` and `ref` `refs/pull/<n>/merge`, so it answers `CREDENTIAL_RUN_UNPROTECTED`. Changing the attesting workflow needs a push to the protected default branch |
| Forge from a branch           | A writer starts a run of a branch's own workflow file by `push`, `workflow_dispatch` or `pull_request_target` | Only `workflow_run` passes, and its file is the default branch's. Every other event answers `CREDENTIAL_RUN_UNPROTECTED`, protected or not                                                             |
| Forge from another repository | A protected run of a repository the tenant's installation does not bind attests a key into the tenant         | Its token's owner is not the installation's, so it answers `RUN_TOKEN_OWNER_MISMATCH`, or the installation is not bound, `INSTALLATION_NOT_BOUND`                                                      |
| Unprotected default branch    | Anyone who can push to the default branch changes the attesting workflow                                      | Its token states `ref_protected` `"false"`, so it answers `CREDENTIAL_RUN_UNPROTECTED`, and no row of the repository reads `exact`                                                                     |
| Replay                        | A captured token is sent again, for another key, run, attempt or write                                        | The audience names all four, and the token expires 300 seconds after `iat`. A repeat of the same statement changes nothing, and any other is refused                                                   |
| Raise the figure              | A closing run, or a captured spend token, sends a larger figure                                               | A key holds one spend. A second figure answers `CREDENTIAL_SPEND_HELD`, whichever closing run sends it, and no ledger keeps the larger                                                                 |
| A spend for another run       | A closing run states a key's spend for a run or attempt the key is not for                                    | The key holds no attestation for that run and attempt, so it answers `CREDENTIAL_NOT_ATTESTED`. A spend never creates an attestation                                                                   |
| The gateway's admin key       | A holder of the gateway's admin key registers a key, or raises its budget                                     | The admin key gives no protected run's token, so it attests nothing here                                                                                                                               |
| Re-run                        | A later attempt's rows spend on an earlier attempt's key                                                      | The attestation names its attempt, and a row reaches its attempt through its batch. Such rows read `windowed`                                                                                          |

## What stays impossible

No rule of this contract proves these, and a reader never states them.

- That a row's token counts are true. The agent's job writes them, and only the gateway's count or a provider's report stands behind spend, under [What a row proves](#what-a-row-proves).
- That all of a run's spend is on its rows, or on its key. Spend on a credential that bypassed the gateway is in no count.
- That a key's spend is the run's alone. The run holds its key, and anyone it hands the key to can spend on it until close or expiry. The count can read high, never low.
- That the gateway's prices are the catalog's.
- `exact` on a private repository on a plan with no branch protection. Its default branch cannot be protected, so `ref_protected` reads `"false"`, as runs 45108986156 and 45109004242 read it, and no attestation from it is taken. That is the true reading: anyone who can push to that branch can change the attesting workflow. Its rows read `windowed`. A private repository on a plan where a branch can be protected earns the grade.
- The pull request of a run whose token names none: `pull_request_target`, `merge_group`, a merged close, `push`, `workflow_dispatch` and the rest of [the events table](#the-pull-request). It stays the sender's statement.
- The head commit of a row that is not `exact`. A `pull_request` token names the merge commit, as run 45108986156 read it, so the head stays the sender's statement.
- That an environment's protection rules hold. GitHub's token does not state them ([OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc), retrieved 2026-11-23).
- That a protected branch's code is honest. A writer who can push to it, or bypass its rules, can attest anything, as for merge facts.
- Any grade above `unattributed` for GitLab. This contract defines no GitLab run token, though GitLab's token states `environment_protected` and `ref_protected` ([ID token reference](https://docs.gitlab.com/ci/secrets/id_token_authentication/), retrieved 2026-11-23).
- What another ledger's `exact` means here. A service the tenant runs states the tenant's own reading, as a self-hosted App attestation does.

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

| Key                | Form                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `repo`             | Host and path, no scheme, as [`costroid/repo`](../../tags/v0.5/README.md) writes it, in lower case under [Letter case](#letter-case) |
| `pull_request`     | The number `costroid/pr` carries, as a JSON integer                                                                                  |
| `merged_at`        | An instant in UTC, to the second                                                                                                     |
| `merge_commit_sha` | The commit the merge put on the base branch: 40 or 64 lower-case hexadecimal characters                                              |

A reader joins a merge fact to rows by the same strings: `repo` to the rows' `costroid/repo`, lower-cased under [Letter case](#letter-case), and `pull_request` to their `costroid/pr`.

No other key is read in this version, and a body with an unknown key answers `MERGE_FACT_INVALID`. `ref` is one such key: the stored fact's branch comes from the run token, never from the document, so [`examples/rejected/MergeDocument.MERGE_FACT_INVALID.ref-key.json`](examples/rejected/MergeDocument.MERGE_FACT_INVALID.ref-key.json) is refused. The pull request's last head is not in this version, because no reader uses it yet. A later version may add a `references` array, for a pull request that names what it acts on. A reader of this version refuses an unknown key, so that addition is a new version.

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

"The same document" means equal values of the keys, not equal bytes: the platform compares parsed values. A verified fact replaces an unverified one even when they differ, so a holder of the integration token cannot send a wrong fact first and block the true one. The same document sent without a run token over a `token_verified` fact answers 200, and the fact keeps its grade and its `ref`. `ref` is not a key of the document, so it takes no part in the comparison: a second `token_verified` send of the held document answers 200 and keeps the first `ref`.

The answer of a `PUT` that stores, of one that changes nothing, and of `GET` is the stored fact with its `run_identity`, `token_verified` or `unverified`, and its `ref`: the branch the run token named on a `token_verified` fact, and null on an `unverified` one.

### Who sends it, and what the run token proves

The recommended sender is a job on a push to the default branch, not a job on a pull request's `closed` event:

- GitHub runs a `pull_request` workflow "in the context of the merge commit", on the pull request's merge ref `refs/pull/<number>/merge` ([events reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), retrieved 2026-11-21). The workflow file it runs carries the pull request's changes, so the pull request's author decides what its job sends. A push to the default branch runs the default branch's file.
- On a push, `GITHUB_SHA` is the "Tip commit pushed to the ref" (the same page), and the run token's `sha` claim is that commit, so the platform can hold `merge_commit_sha` to it.

The sender reads the pushed commit, asks the host which merged pull requests that commit closed, and sends one fact per pull request. A commit that closed none sends nothing. In releases after 1.0.0-alpha.26, Costroid's sender is `costroid merged`, run by a recipe on a push to the default branch with `id-token: write`.

`Costroid-Installation-Id` and `Costroid-Run-Token` are sent as on an export, and the run token has the same rows audience. The platform verifies it under [The run token](#the-run-token) and reads four more claims on this path, each a string: `sha`, `ref`, `ref_type` and `ref_protected`. `ref_protected` is `"true"` or `"false"`, the form the installation proofs read for a push, under [CI proof](#ci-proof). A claim of another type fails verification: [`examples/rejected/MergeRunTokenClaims.RUN_TOKEN_INVALID.ref-protected-as-a-boolean.json`](examples/rejected/MergeRunTokenClaims.RUN_TOKEN_INVALID.ref-protected-as-a-boolean.json) answers `RUN_TOKEN_INVALID`.

| Check                                                                                                                                                        | Answer                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| The header is present and fails verification                                                                                                                 | 403 `RUN_TOKEN_INVALID`, nothing stored            |
| `repository_owner_id` is not the owner of the installation                                                                                                   | 403 `RUN_TOKEN_OWNER_MISMATCH`, nothing stored     |
| The header verifies, and `repo` is not `github.com/` and the token's `repository`, lower-cased under [Letter case](#letter-case)                             | 422 `MERGE_FACT_IDENTITY_MISMATCH`, nothing stored |
| The header verifies, and `sha` is not `merge_commit_sha`, `ref_type` is not `branch`, `ref` does not begin `refs/heads/`, or `ref_protected` is not `"true"` | Stored as `unverified`, `ref` null                 |
| The header verifies, `sha` is `merge_commit_sha`, `ref_type` is `branch`, `ref` begins `refs/heads/` and `ref_protected` is `"true"`                         | Stored as `token_verified`, with the token's `ref` |
| No header                                                                                                                                                    | Stored as `unverified`, `ref` null                 |

One push can carry more than one merged pull request, as a merge queue's group does. The run token's `sha` is the tip of the push, so only the fact whose `merge_commit_sha` is the tip reads `token_verified`, and the others read `unverified`. That is an honest cause of an `unverified` fact. [`examples/MergeFact.merge-queue-group.json`](examples/MergeFact.merge-queue-group.json) is one.

A default branch that is not protected is another honest cause, beside the merge queue's. A run on it holds a token whose `ref_protected` is `"false"`, so every fact the repository sends reads `unverified`. [`examples/MergeRunTokenClaims.unprotected-branch.json`](examples/MergeRunTokenClaims.unprotected-branch.json) is such a token, and [`examples/MergeFact.unprotected-branch.json`](examples/MergeFact.unprotected-branch.json) is the fact it stores.

An `unverified` fact does not block the true one. When the same `merge_id` arrives under a token from a protected branch, [`examples/MergeRunTokenClaims.json`](examples/MergeRunTokenClaims.json), the `token_verified` fact replaces the `unverified` one by the rule that a verified fact replaces an unverified one. The answer is 201 with [`examples/MergeFact.protected-branch.json`](examples/MergeFact.protected-branch.json), whose `ref` is `refs/heads/main`.

The claims on a push were read from a real token: a recorded GitHub Actions run 44894920019 (2026-11-21) printed `event_name` `push`, `ref` `refs/heads/main`, `ref_type` `branch`, and `sha` equal to the pushed commit and to `github.sha`. A second recorded run, 44907953360 (2026-11-21), printed `ref_protected` as the string `"false"` on a branch that is not protected, and runs 45109326900 and 45109345722 (2026-11-23) printed the string `"true"` on a protected default branch. The claims of a `pull_request` `closed` run have not been read, and this contract does not rest on them: a fact sent from such a run reads `unverified` unless its token's `sha` is the merge commit and its `ref` a protected branch.

A GitLab job sends no run token, so its fact reads `unverified`, as its rows do.

#### What the run token proves

A `token_verified` fact proves that a run of this repository, on a protected branch, at this commit, sent it. It proves nothing about `pull_request` or `merged_at`. The sender reads both from the host, and the platform does not check them: a `token_verified` fact does not prove that the commit closed this pull request, or when.

#### What the grade costs

The grade needs a protected branch because a branch other than the default runs its own copy of the workflow file. Without that claim, anyone who can push a branch could send a fact that reads `token_verified`. The rule has two costs.

- A repository whose default branch is not protected gets only `unverified` merge facts.
- A protected branch that is not the default still passes. `ref_protected` says that the branch is protected, not that it is the default.

That is why the fact stores its branch in `ref`, and a reader shows it.

### How a reader counts merged pull requests

A count of merged pull requests counts every stored fact whose `merged_at` falls in the period, of either grade. It states how many of them are `token_verified`, and into which branch, from `ref`. The platform infers no default branch: it never takes a `ref` to be one.

### The scope

`merges:write` allows `PUT` and `GET /merges/{merge_id}`. `GET` answers the stored document with its `run_identity` and `ref`, and an id this tenant does not hold answers 404 `MERGE_FACT_NOT_FOUND`, `"This tenant holds no such merge_id."`, [`examples/MergeRefusal.MERGE_FACT_NOT_FOUND.json`](examples/MergeRefusal.MERGE_FACT_NOT_FOUND.json).

### Refusals

A request is refused before anything is stored.

| Code                                  | Status | Meaning                                                                                                                                                                                        |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_TOKEN_INVALID`                  | 401    | The token is absent, unknown, expired or revoked                                                                                                                                               |
| `AUTH_TOKEN_SCOPE`                    | 403    | The token lacks `merges:write`                                                                                                                                                                 |
| `RUN_TOKEN_INVALID`                   | 403    | The run token fails verification, or a claim this path reads is not a string                                                                                                                   |
| `RUN_TOKEN_OWNER_MISMATCH`            | 403    | The run token names another owner than the installation                                                                                                                                        |
| `MERGE_FACT_NOT_FOUND`                | 404    | This tenant holds no such `merge_id`, on `GET`                                                                                                                                                 |
| `NOT_FOUND`                           | 404    | The platform does not mount this version                                                                                                                                                       |
| `INSTALLATION_NOT_BOUND`              | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                                                                                                  |
| `MERGE_FACT_CONFLICT`                 | 409    | The merge id, or the pull request, holds a different document                                                                                                                                  |
| `MERGE_FACT_IDENTITY_MISMATCH`        | 422    | A verified run token names another repository than `repo`, compared in lower case                                                                                                              |
| `MERGE_FACT_INVALID`                  | 422    | A key is missing, unknown or of the wrong form, or the body is too large, not UTF-8 or not a JSON object. `ref` is an unknown key, and a `repo` with an upper-case letter is of the wrong form |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE` | 503    | GitHub's key set cannot be read. Retry inside the run token's window                                                                                                                           |

`MERGE_FACT_INVALID` answers `"A key is missing, unknown or of the wrong form."`, [`examples/MergeRefusal.MERGE_FACT_INVALID.wrong-form.json`](examples/MergeRefusal.MERGE_FACT_INVALID.wrong-form.json), for every one of its causes, a body that is too large, not UTF-8 or not a JSON object included.

Each merge path answers one 400, `TOOL_INPUT_INVALID`, with one sentence. `PUT` answers `"The merge id in the path is malformed, or Costroid-Installation-Id is missing or malformed, including when a Costroid-Run-Token is sent without it."`, [`examples/Error.merge-write-input.json`](examples/Error.merge-write-input.json). `GET` answers `"The merge id in the path is malformed."`, [`examples/Error.merge-read-input.json`](examples/Error.merge-read-input.json).

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

`currency` is the currency of every amount in the row, `prices` included. Where `dollars.rounding` is present, its `currency` equals the row's. The schema's dialect cannot compare two values, so `openapi.json` does not check it, and a row that breaks it is not a row of this version. `currency` is new in version 0.5: the row `reconcile` wrote before that version has no such key, and Costroid adds it with that version.

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

| Code                                  | Status | Meaning                                                                                                                       |
| ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `TOOL_INPUT_INVALID`                  | 400    | A header is missing or malformed, including a Costroid-Run-Token sent without Costroid-Installation-Id                        |
| `TOOL_INPUT_INVALID`                  | 400    | A query parameter is missing or malformed, to is before from, or the range spans more than max_reconciliation_range_days days |
| `AUTH_TOKEN_INVALID`                  | 401    | The token is absent, unknown, expired or revoked                                                                              |
| `AUTH_TOKEN_SCOPE`                    | 403    | The token lacks `reconciliations:write`                                                                                       |
| `RUN_TOKEN_INVALID`                   | 403    | The run token fails verification                                                                                              |
| `RUN_TOKEN_OWNER_MISMATCH`            | 403    | The run token names another owner than the installation                                                                       |
| `NOT_FOUND`                           | 404    | The platform does not mount this version                                                                                      |
| `INSTALLATION_NOT_BOUND`              | 409    | This tenant holds no active binding of the installation, including a revoked or displaced one                                 |
| `RECONCILIATION_TOO_LARGE`            | 413    | The body is past a limit the platform states in `GET /quotas`                                                                 |
| `RECONCILIATION_INVALID`              | 422    | A line is not a row of this version, or repeats the key of an earlier line. The answer names the line                         |
| `QUOTA_RECONCILIATIONS_PER_DAY`       | 429    | The body would pass `reconciliations_per_day`                                                                                 |
| `INSTALLATION_PROOF_KEYS_UNAVAILABLE` | 503    | GitHub's key set cannot be read. Retry inside the run token's window                                                          |

The platform answers these sentences, and `examples/` holds each:

| Code                            | Sentence                                                                                                                         | Example                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `TOOL_INPUT_INVALID`, `PUT`     | `A header is missing or malformed, including a Costroid-Run-Token sent without Costroid-Installation-Id.`, this path's alone     | [`Error.reconciliation-headers.json`](examples/Error.reconciliation-headers.json)                                                           |
| `TOOL_INPUT_INVALID`, `GET`     | `A query parameter is missing or malformed, to is before from, or the range spans more than max_reconciliation_range_days days.` | [`Error.reconciliation-query.json`](examples/Error.reconciliation-query.json)                                                               |
| `RECONCILIATION_TOO_LARGE`      | `The body is past a limit the platform states in GET /quotas.`                                                                   | [`ReconciliationRefusal.RECONCILIATION_TOO_LARGE.bytes.json`](examples/ReconciliationRefusal.RECONCILIATION_TOO_LARGE.bytes.json)           |
| `RECONCILIATION_INVALID`        | `Line 3 is not a row of this version.`, with `line` 3                                                                            | [`ReconciliationRefusal.RECONCILIATION_INVALID.not-a-row.json`](examples/ReconciliationRefusal.RECONCILIATION_INVALID.not-a-row.json)       |
| `RECONCILIATION_INVALID`        | `Line 5 repeats the key of an earlier line.`, with `line` 5                                                                      | [`ReconciliationRefusal.RECONCILIATION_INVALID.repeated-key.json`](examples/ReconciliationRefusal.RECONCILIATION_INVALID.repeated-key.json) |
| `QUOTA_RECONCILIATIONS_PER_DAY` | `This body would pass the tenant's reconciliations_per_day limit.`                                                               | [`ReconciliationRefusal.QUOTA_RECONCILIATIONS_PER_DAY.json`](examples/ReconciliationRefusal.QUOTA_RECONCILIATIONS_PER_DAY.json)             |

A sender that meets 429 keeps the rows and warns. It never fails a check on that answer, because nothing in the rows is wrong and they can be sent later.

## Quota signals

`GET /quotas` answers every limit that applies to the tenant. Each export answer also carries `Costroid-Quota-State`, the most urgent state across every quota, `reconciliations_per_day` included: `ok`, `approaching` at 80% of a limit, or `exhausted`.

Three quotas bound exports. `exports_per_day` counts the batches accepted for ingest in a UTC day, restatements included, and a repeat of bytes already held is not counted. `export_bytes_per_day` sums their bodies in bytes. `max_batch_bytes` bounds one body in bytes.

Five bound reconciliations, under [Limits](#limits). There is no quota on merge facts, because the number of merges bounds them, and none on credential statements, because a key holds one attestation and one spend.

A refused export answers 429 with `Retry-After` and an error code named after the quota, such as `QUOTA_EXPORTS_PER_DAY`, and stores nothing. A refused reconciliation body does the same. A quota refusal never changes a check conclusion, and the sender keeps the rows and retries.

## Changes from 0.6

- `GET /identity` states version `0.7` in `contract`. Rows are `focus-row/v0.6` with tags `tags/v0.5`, still FOCUS 1.4. A path the platform does not mount answers one 404 `NOT_FOUND`, and a sender warns and goes on, under [Versions](#versions).
- New: `PUT /credentials/{key_id}` and `PUT /credentials/{key_id}/spend`, the scope `credentials:write`, one order of checks in seven steps, the 503 `INSTALLATION_PROOF_KEYS_UNAVAILABLE` when GitHub's key set cannot be read, and the refusal codes `CREDENTIAL_RUN_UNPROTECTED`, `CREDENTIAL_ATTESTING_RUN_USED`, `CREDENTIAL_ATTESTED_ELSEWHERE`, `CREDENTIAL_NOT_ATTESTED` and `CREDENTIAL_SPEND_HELD`, under [The credential attestation](#the-credential-attestation). Before this version, a key's attestation rested on an environment's protection rules, which GitHub's token does not state and no ledger can see, so no ledger could tell a reviewed environment from an open one.
- New: [What a ledger grades](#what-a-ledger-grades). A row reads `exact` only under a `pull_request` run token, on a key a run of a protected branch, started by `workflow_run`, attested for the row's run and attempt, at the attested head.
- The export path reads `event_name` and `ref`. A `pull_request` run token names its pull request, and a `token_verified` row that names another fails `ROW_IDENTITY_MISMATCH` with its own sentence. Version 0.6 held a row to its run and repository alone, so a holder of the integration token and of one run's token could file verified rows under any pull request of that repository. Under a token that names no pull request, the row's pull request is stored as stated, and the batch is not refused.
- A batch belongs to one attempt. A later attempt's run token answers `EXPORT_BATCH_RUN_BOUND` on an earlier attempt's batch, because a grade reads the attempt. Costroid's batch id already names the attempt.
- A restatement compares the repository of the two run tokens in lower case, the fifth place under [Letter case](#letter-case). Version 0.6 named no case for it.
- A row that states `costroid/origin` fails its batch `ROW_ORIGIN_REFUSED`, ahead of `RUN_TOKEN_MISSING` and every identity check. Such a row is a developer's own session, not a run's row.
- Every claim a path reads beyond the five is a string, or the token is `RUN_TOKEN_INVALID`, under [The run token](#the-run-token). A `token_verified` merge fact also needs a `ref` that begins `refs/heads/`. The value `"true"` of `ref_protected` is now read from real tokens, recorded runs 45109326900 and 45109345722.
- `PLAN_WRITES_REFUSED` and the 402 answers are not in this version, because the platform never answers them.
- The export, merge and reconciliation writes state the 503 `INSTALLATION_PROOF_KEYS_UNAVAILABLE`, with a `Retry-After` of 60 seconds, for a run token sent while GitHub's key set cannot be read. It is not new: a platform on version 0.6 answered it as well, where the text did not state it.
- The refusals that had no example in the platform's words now have one: `MERGE_FACT_INVALID`, `MERGE_FACT_NOT_FOUND`, `RECONCILIATION_TOO_LARGE`, two of `RECONCILIATION_INVALID`, `QUOTA_RECONCILIATIONS_PER_DAY`, and the two `TOOL_INPUT_INVALID` answers of the reconciliation paths. `MERGE_FACT_NOT_FOUND` and `QUOTA_RECONCILIATIONS_PER_DAY` join their paths' lists of refusal codes. Every 400 of the merge, reconciliation and credential paths is `TOOL_INPUT_INVALID`, with one sentence for each path. The export path's 400 is described whole, and `GET /exports/{batch_id}` lists it. The export examples of `AUTH_TOKEN_SCOPE`, `ROW_COST_INCONSISTENT` and `EXCESS_NUMERIC_PRECISION` carry the platform's sentences, and `openapi.json` holds each.
- `Costroid-Quota-State` is the most urgent state across every quota, `reconciliations_per_day` included, as version 0.6's platform answers it.
- `examples/CredentialCase.*.json`, `examples/RestatementCase.*.json` and `examples/IngestCase.*.json` are new test vectors, which `scripts/validate.mjs` runs.
- Nothing else changes. The binding rules, the merge fact's document and idempotence, the reconciliation row and every limit are as version 0.6 has them.
