# Integration contract, version 0.1

How Costroid and Costroid Platform identify a tenant, authenticate, move FOCUS rows and report quotas. The contract is [`openapi.json`](openapi.json), OpenAPI 3.1. Both products implement it, and there is no second contract.

All names and figures in `examples/` are synthetic.

## Versions

The version is in the path: `/api/integration/v0.1`. A published version never changes in place. A later version is a new directory here and a new path there.

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

| Threat       | What the attacker does                                                  | The rule that answers it                                                                                                                                                                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Squat        | A stranger names `github:58120394` first                                | No binding without a proof, and only the SCM or the hosted service signs one. The stranger gets `INSTALLATION_PROOF_MISSING` or `INSTALLATION_PROOF_SUBJECT_MISMATCH`, and no binding exists to block anyone                                                                                                |
| Inside squat | A writer on one repository, with a tenant of their own, binds the owner | GitHub needs a schedule from the default branch or a push to a protected ref, GitLab a protected ref. If the writer can still get there, for example under a ruleset that matches every branch, the App displaces them at once. On GitLab the owner removes the access and the binding goes stale in 7 days |
| Replay       | A captured proof is sent again                                          | The audience fixes the tenant, the path must match the proof, and the window is 600 seconds. A replay by the tenant it names changes nothing. A proof older than the installation's last change is refused                                                                                                  |
| Stolen proof | A proof leaks from a job log or a request                               | It names one tenant, so it is useless without that tenant's bearer with `installations:write`. With both, it can only bind the owner to the tenant it already names. It opens nothing at the SCM                                                                                                            |
| Uninstall    | The App is removed, and an old binding or proof lingers                 | The binding ends `revoked` on the signed delivery, and the tenant keeps its rows. Exports under it answer `INSTALLATION_NOT_BOUND`. If the delivery is lost, a new installation displaces it. An older proof is `INSTALLATION_PROOF_EXPIRED`                                                                |
| Transfer     | A repository, a project or an organization changes hands                | A new owner id is a new binding. A sale keeps the id, and a reinstall clears the old holder. Rows never move                                                                                                                                                                                                |

The remaining risks are stated. An owner whose default branch takes unreviewed pushes gives every writer a CI proof. `ref_protected` does not mean the default branch: a ruleset that matches every branch makes any writer's push protected, so the App still outranks that proof and displaces its holder. A private repository on a plan with no branch protection still needs `schedule` or the App. A repository administrator can install the App and hold the owner until an organization owner reinstalls it. A person who approves a change to a workflow file can be misled into naming a stranger's tenant.

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

This token authenticates one product to the other. A CI job sends rows to Costroid under its own OIDC ID token, which this contract does not cover. A CI proof is a separate token with a separate audience, under Identity.

## The export endpoint

`PUT /exports/{batch_id}` sends one CSV of [FOCUS rows](../../focus-row/v0.1/README.md). The tenant comes from the token, never from the body. The rows carry the [tag set](../../tags/v0.1/README.md) in their `Tags` column, and it needs no mapping.

The batch id decides what a request means.

| Request                              | Effect                                               |
| ------------------------------------ | ---------------------------------------------------- |
| A new `batch_id`                     | Adds rows                                            |
| The same `batch_id`, the same bytes  | Answers 200 and changes nothing, so a retry is safe  |
| The same `batch_id`, different bytes | Replaces that batch's rows once the new bytes ingest |

A batch ingests whole or fails whole. A failed batch changes nothing, and `GET /exports/{batch_id}` carries its typed `failure`. The codes are `UNPARSEABLE_FILE`, `MISSING_MANDATORY_COLUMNS`, `INVALID_TIMESTAMP`, `NON_NUMERIC_COST`, `EXCESS_NUMERIC_PRECISION`, `UNKNOWN_FOCUS_VERSION`, `HASH_MISMATCH`, `FILE_TOO_LARGE`, `EMPTY_FILE` and `INGEST_RETRY_EXHAUSTED`. A client treats a code it does not know as a failed batch.

## Quota signals

`GET /quotas` answers every limit that applies to the tenant. Each export answer also carries `Costroid-Quota-State`, the most urgent state across them: `ok`, `approaching` at 80% of a limit, or `exhausted`.

A refused export answers 429 with `Retry-After` and an error code named after the quota, such as `QUOTA_ROWS_PER_MONTH`, and stores nothing. A quota refusal never changes a check conclusion, and the sender keeps the rows and retries.
