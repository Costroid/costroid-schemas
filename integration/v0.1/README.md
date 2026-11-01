# Integration contract, version 0.1

How Costroid and Costroid Platform identify a tenant, authenticate, move FOCUS rows and report quotas. The contract is [`openapi.json`](openapi.json), OpenAPI 3.1. Both products implement it, and there is no second contract.

All names and figures in `examples/` are synthetic.

## Versions

The version is in the path: `/api/integration/v0.1`. A published version never changes in place. A later version is a new directory here and a new path there.

## Identity

Costroid Platform owns identity. An organization is one tenant, shared by both products. Its region is fixed at sign-up.

`GET /identity` answers the tenant, the account that issued the token, the token and the installations bound to the tenant. An account appears by id and role, and no address leaves through this contract.

An installation is one SCM installation, named `<scm>:<id>`, for example `github:58120394`. `PUT /installations/{installation_id}` binds it to the tenant. Each installation belongs to one tenant, and a comment link carries its id.

A person's sign-in is not part of this version. It stays on the platform's own pages.

## Tokens

Every request carries an integration token as a bearer: `costroid_it_` followed by 43 URL-safe characters. A tenant administrator issues one on the platform, which shows the secret once and stores only its SHA-256.

A token belongs to one tenant, carries one or more scopes and expires.

| Scope                 | Allows                                 |
| --------------------- | -------------------------------------- |
| `identity:read`       | `GET /identity`                        |
| `installations:write` | `PUT /installations/{installation_id}` |
| `rows:write`          | `PUT` and `GET /exports/{batch_id}`    |
| `quotas:read`         | `GET /quotas`                          |

`/tokens/current` reads and revokes the token in use, and `POST /tokens/current/rotate` replaces it. The old token works until `previous_token_expires_at`, so a client can switch without a gap.

An absent, unknown, expired or revoked token answers one `AUTH_TOKEN_INVALID`. The answer does not say which.

This token authenticates one product to the other. A CI job authenticates to Costroid with its own OIDC ID token, which this contract does not cover.

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
