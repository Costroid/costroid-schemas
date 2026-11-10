# Costroid FOCUS row, version 0.5

Version 0.5 is [version 0.4](../v0.4/README.md) with the [tag set version 0.4](../../tags/v0.4/README.md), which adds `costroid/repo_visibility`: who can read the repository a run belongs to, as the CI system states it. The columns did not change.

A row of an earlier version stays readable. A 0.4 row has no `costroid/repo_visibility` tag, so its repository's visibility is unknown. A 0.3 row is a default row. A 0.2 row has no `costroid/assumed_ttl` tag, so its tags cannot tell a stated lifetime from an assumed one. A 0.1 row also reads as `global`, at the tier in its `SkuPriceId`.

One FOCUS Cost and Usage row per model request per token class. The schema is [`row.schema.json`](row.schema.json). `examples/request-rows.csv` is what Costroid exports. `examples/request-rows.jsonl` holds the same rows as JSON lines, and `examples/request-rows-strict.jsonl` holds them in the strict profile.

All names and figures in `examples/` are synthetic.

## The rows declare FOCUS 1.4

FOCUS 1.4 is the current ratified version: its tag is the newest on the [specification repository](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/releases/tag/v1.4), published 2026-06-04, retrieved 2026-11-01. A later ratified version gets a new directory here.

Costroid Platform reads FOCUS 1.0 through 1.4, so these rows land without mapping. It writes 1.2 from its own converters, and that does not bind a source it reads.

The header decides the version. FOCUS 1.4 removed `ProviderName` and `PublisherName`, which 1.0 through 1.3 make mandatory, and keeps `ServiceProviderName` and `HostProviderName` in their place. This header carries the 1.4 columns and neither removed column, and the export's `Costroid-Focus-Version` header states the same version.

## Columns

The row carries the 21 columns FOCUS 1.4 makes mandatory, the conditional columns that apply to a priced model request, and four custom columns. A strict row carries a fifth. A blank CSV cell is null. The columns FOCUS makes conditional and that do not apply here are absent, not blank.

| Column                                   | Value                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `ChargeCategory`                         | `Usage`                                                                               |
| `ChargeClass`                            | Null                                                                                  |
| `ChargeFrequency`                        | `Usage-Based`                                                                         |
| `ChargePeriodStart`, `ChargePeriodEnd`   | The request, in whole UTC seconds. The end is exclusive and after the start           |
| `BillingPeriodStart`, `BillingPeriodEnd` | The UTC month of the charge                                                           |
| `ServiceCategory`                        | `AI and Machine Learning`                                                             |
| `ServiceSubcategory`                     | `Generative AI`                                                                       |
| `ServiceProviderName`                    | Who served the request                                                                |
| `HostProviderName`                       | The host, when exposed. Otherwise the service provider                                |
| `InvoiceIssuerName`                      | Who invoices for it                                                                   |
| `BillingAccountId`, `SubAccountId`       | The provider's account, and the narrowest scope the credential maps to                |
| `SkuId`, `SkuMeter`                      | The model and token class, and the token class alone                                  |
| `SkuPriceId`                             | The price catalog entry                                                               |
| `PricingCategory`                        | `Standard`                                                                            |
| `RegionId`, `RegionName`                 | The region the request was held to, in both. Null on default routing                  |
| `PricingQuantity`, `PricingUnit`         | Tokens divided by 1000000, and `1000000 Tokens`                                       |
| `ConsumedQuantity`, `ConsumedUnit`       | The token count and `Tokens`, or the vendor's credit count and `Credits`              |
| `Tags`                                   | The [tag set](../../tags/v0.4/README.md), serialized as JSON in CSV                   |
| `x_CostroidRowId`                        | SHA-256 of `<request id>:<token class>`. See [Row ids](#row-ids)                      |
| `x_CostroidServiceTier`                  | The service tier, as the catalog names it. Null when the source states none           |
| `x_CostroidCatalogVersion`               | The catalog version that priced the row. Required on `measured` and `list_equivalent` |
| `x_CostroidOvershootBound`               | Concurrency times `max_tokens` times price. Required on `gateway-precheck`            |
| `x_CostroidMeasuredCost`                 | On a strict row alone: the default row's `EffectiveCost`. See [Profiles](#profiles)   |

## Regions

FOCUS makes `RegionId` conditional: it "MUST NOT be null when a resource or service is operated in or managed from a distinct region", and it "MAY be null" otherwise. `RegionName` "MUST be null when RegionId is null" and "MUST NOT be null when RegionId is not null" ([RegionId, FOCUS 1.3](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.3/specification/datasets/cost_and_usage/columns/regionid.md), [RegionName, FOCUS 1.4](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.4/specification/datasets/cost_and_usage/columns/regionname.md), both retrieved 2026-11-01).

Default routing is no distinct region, so `global` never appears: the column is null. A provider states a region by a short code, and the row repeats it in `RegionName`, because no provider states a display name in its usage data.

## Token classes

`SkuMeter` holds the class. The billed classes are disjoint, so their tokens add up.

| Class                   | Priced | Meaning                                                     |
| ----------------------- | ------ | ----------------------------------------------------------- |
| `input_uncached`        | Yes    | Input tokens read at the full rate                          |
| `cache_read`            | Yes    | Input tokens read from cache                                |
| `cache_write_5m`        | Yes    | Tokens written to a five-minute cache                       |
| `cache_write_1h`        | Yes    | Tokens written to a one-hour cache                          |
| `cache_write_30m`       | Yes    | Tokens written to a 30-minute cache                         |
| `cache_write_12h`       | Yes    | Tokens written to a 12-hour cache                           |
| `output`                | Yes    | Output tokens, reasoning included                           |
| `reasoning_output`      | No     | The reasoning share of `output`, as the provider reports it |
| `cached_input_reported` | No     | The cached input count, as the provider reports it          |

The two informational classes repeat tokens that a billed class already counts. Their costs and unit prices are 0, and their `PricingUnit` and `ConsumedUnit` are `Informational Tokens`, so a sum of `Tokens` never counts them twice.

OpenAI bills cache writes from GPT-5.6 on, at 30 minutes, the default, and at 12 hours ([prompt caching, OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching), retrieved 2026-11-01). Neither fits a five-minute or a one-hour class, so each has its own. A token sits in one class, and a class prices at its own catalog entry. No class stands in for another.

## Assumed lifetimes

A source can report a cache write without its lifetime. The row still needs one class, so the adapter assigns the class by its documented rule and writes `costroid/assumed_ttl` on the row. The value is the lifetime of the row's own class: `5m`, `1h`, `30m` or `12h`. `examples/request-row-assumed-five-minutes.json` is one such row.

A row without the tag states a lifetime its source reported. The schema rejects the tag on any class that has no lifetime, and on a value that disagrees with `SkuMeter`.

The tag changes no figure. The tokens stay in the assigned class, at that class's price. A row that holds stated and assumed writes in one class carries the tag, because one request has one row per class and a reader cannot separate the two.

| Source      | What it reports                          | The rule                                                                                                                                | Read from                                                                                                                                                                                                                    |
| ----------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | One total, `cache_write_input_tokens`    | `cache_write_30m`. 30 minutes is OpenAI's default, and a 12-hour share cannot be seen                                                   | [OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching), [Codex](https://github.com/openai/codex/blob/67f0994b532b8740f14b5b738af7b7b2a915b1d6/codex-rs/codex-api/src/sse/responses.rs), retrieved 2026-11-01 |
| Claude Code | Two lifetime counts, both 0 at times     | Five minutes on an API key or cloud provider unless `ENABLE_PROMPT_CACHING_1H` is set. One hour on a subscription within included usage | [Monitoring](https://code.claude.com/docs/en/monitoring-usage), [cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking), retrieved 2026-11-01                                                               |
| Cursor      | One total, `tokenUsage.cacheWriteTokens` | By model provider                                                                                                                       | [Admin API](https://cursor.com/docs/account/teams/admin-api), retrieved 2026-11-01                                                                                                                                           |
| OpenCode    | One total, `tokens.cache.write`          | Five minutes on Anthropic-routed models. `cache_write_30m` on OpenAI GPT-5.6 or later                                                   | [OpenCode](https://github.com/anomalyco/opencode/blob/69269e4ebe309a08919b3c9be7948b9fd699c3a4/packages/core/src/session/usage.ts), retrieved 2026-11-01                                                                     |

The lifetime behind the Cursor and OpenCode rules is unverified. Neither source has a lifetime field.

## Which cost column holds what

`ListCost` always equals `ListUnitPrice` times `PricingQuantity`. `ContractedCost` always equals `ContractedUnitPrice` times `PricingQuantity`, and `ContractedUnitPrice` is `ListUnitPrice` until a contracted rate applies. `validate.mjs` checks both products exactly. The priced figure of a `measured` row is its `ContractedCost`.

| `costroid/cost_basis` | `BilledCost` | `EffectiveCost`       | `ListCost`         |
| --------------------- | ------------ | --------------------- | ------------------ |
| `measured`            | 0            | The priced figure     | The figure at list |
| `list_equivalent`     | 0            | 0                     | The figure at list |
| `estimate`            | 0            | 0                     | The estimate       |
| `billed`              | 0            | The provider's figure | The figure at list |
| `derived`             | 0            | The derived figure    | The derived figure |

This version's examples are request rows. `estimate` and `billed` rows use the same columns, and a reconciliation row's own shape comes in a later version.

`BilledCost` is 0 on every row, because Costroid issues no invoice. FOCUS 1.4 requires it: BilledCost "MUST reflect amounts as invoiced", and it "MUST be 0 for charges generated by entities that are not responsible or authorized for invoicing, to avoid double-counting when merging multiple dataset instances" ([BilledCost, FOCUS 1.4](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.4/specification/datasets/cost_and_usage/columns/billedcost.md), retrieved 2026-11-01).

## Two departures from FOCUS 1.4

A default `measured`, `billed` or `derived` row departs from two FOCUS 1.4 requirements on `EffectiveCost`. Both are in the [EffectiveCost column](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.4/specification/datasets/cost_and_usage/columns/effectivecost.md) of FOCUS 1.4, retrieved 2026-11-08.

The first: EffectiveCost "MUST equal BilledCost when ChargeCategory is "Usage" and the charge is not covered by other eligible charges". The row's `BilledCost` is 0 and its `EffectiveCost` is not.

The second: EffectiveCost "MUST be 0 for charges generated by entities that do not originate the cost and usage data, to avoid double-counting when merging multiple dataset instances". Costroid does not originate the provider's cost and usage data. It reads the agent's token counts and prices them, and the provider's own data holds the same requests.

The default row keeps the figure in `EffectiveCost` because the only column FOCUS keeps for an incurred cost that is not an invoice line is `EffectiveCost`, and Costroid Platform reads it there. A reader merging default rows with the provider's own FOCUS data must not add the two `EffectiveCost` sums. `costroid/cost_source` tells the rows apart. A strict row meets both requirements.

## Profiles

| Profile   | `BilledCost` | `EffectiveCost`                                     | `x_CostroidMeasuredCost`          | For                                                              |
| --------- | ------------ | --------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `default` | 0            | As [the table above](#which-cost-column-holds-what) | Absent                            | Costroid Platform, and every reader of version 0.3               |
| `strict`  | 0            | 0                                                   | The default row's `EffectiveCost` | A reader that merges the rows with the provider's own FOCUS data |

A strict row is the default row with two changes: `EffectiveCost` reads `"0"`, and `x_CostroidMeasuredCost` holds the default row's `EffectiveCost`, byte for byte. Every other column is the same. The schema rejects a row that carries `x_CostroidMeasuredCost` beside an `EffectiveCost` other than 0, and a `list_equivalent`, `estimate` or informational row whose `x_CostroidMeasuredCost` is not 0.

`ListCost` is the same in both profiles, so a reader of `ListCost` reads the same figure from either. `costroid run --focus-profile strict` and `costroid ingest-run --focus-profile strict` write strict rows as JSON lines. The CSV export reads default rows alone, so its header is version 0.3's.

## An exact row names its credential

`costroid/attribution_grade` is `exact` only when the provider's report can be filtered by a credential the wrapper controls. `SubAccountId` holds that credential, so the schema rejects an `exact` row whose `SubAccountId` is null.

## Row ids

`x_CostroidRowId` is the lower-case hexadecimal SHA-256 of the UTF-8 text `<request id>:<token class>`, joined by one colon. The token class is the row's `SkuMeter`. The request id is the provider's. An agent that reports none gets a stand-in from its adapter, which the adapter documents.

`examples-request-ids.json` names the synthetic request id behind each example row, by its `costroid/cost_source`. `validate.mjs` recomputes `x_CostroidRowId` from it on every row that passes the schema. The first row of `examples/request-rows.csv` hashes the text `req_example_0001:input_uncached`. `examples/rejected/row-id-without-the-colon.json` is the same row hashed without the colon.

## Numbers

Every amount and quantity is a decimal string with at most 12 fractional digits, never a JSON number and never scientific notation. A row states the digits it computed, without padding.

## Proof

Every example passes `scripts/validate.mjs`. This version's CSV header is version 0.2's, byte for byte. It has not been run through Costroid Platform's FOCUS version resolver: version 0.1's header was, on 2026-11-01. `RegionId` and `RegionName` are FOCUS columns, and `x_CostroidServiceTier` and `x_CostroidMeasuredCost` carry the prefix FOCUS reserves for custom columns. `examples/request-rows-strict.jsonl` is `examples/request-rows.jsonl` as Costroid's strict profile writes it, byte for byte, and Costroid's own tests hold its writer to that file.
