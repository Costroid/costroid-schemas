# Costroid FOCUS row, version 0.2

Version 0.2 is [version 0.1](../v0.1/README.md) plus three columns: `RegionId`, `RegionName` and `x_CostroidServiceTier`. Version 0.1 had no column for a region, so a row's data-residency premium lived in free text, and a reader that priced the row again had to assume `global`. A row in either version stays readable: a 0.1 row reads as `global`, at the tier in its `SkuPriceId`.

One FOCUS Cost and Usage row per model request per token class. The schema is [`row.schema.json`](row.schema.json). `examples/request-rows.csv` is what Costroid exports. `examples/request-rows.jsonl` holds the same rows as JSON lines.

All names and figures in `examples/` are synthetic.

## The rows declare FOCUS 1.4

FOCUS 1.4 is the current ratified version: its tag is the newest on the [specification repository](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/releases/tag/v1.4), published 2026-06-04, retrieved 2026-11-01. A later ratified version gets a new directory here.

Costroid Platform reads FOCUS 1.0 through 1.4, so these rows land without mapping. It writes 1.2 from its own converters, and that does not bind a source it reads.

The header decides the version. FOCUS 1.4 removed `ProviderName` and `PublisherName`, which 1.0 through 1.3 make mandatory, and keeps `ServiceProviderName` and `HostProviderName` in their place. This header carries the 1.4 columns and neither removed column, and the export's `Costroid-Focus-Version` header states the same version.

## Columns

The row carries the 21 columns FOCUS 1.4 makes mandatory, the conditional columns that apply to a priced model request, and four custom columns. A blank CSV cell is null. The columns FOCUS makes conditional and that do not apply here are absent, not blank.

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
| `Tags`                                   | The [tag set](../../tags/v0.1/README.md), serialized as JSON in CSV                   |
| `x_CostroidRowId`                        | SHA-256 of `<request id>:<token class>`. See [Row ids](#row-ids)                      |
| `x_CostroidServiceTier`                  | The service tier, as the catalog names it. Null when the source states none           |
| `x_CostroidCatalogVersion`               | The catalog version that priced the row. Required on `measured` and `list_equivalent` |
| `x_CostroidOvershootBound`               | Concurrency times `max_tokens` times price. Required on `gateway-precheck`            |

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
| `output`                | Yes    | Output tokens, reasoning included                           |
| `reasoning_output`      | No     | The reasoning share of `output`, as the provider reports it |
| `cached_input_reported` | No     | The cached input count, as the provider reports it          |

The two informational classes repeat tokens that a billed class already counts. Their costs and unit prices are 0, and their `PricingUnit` and `ConsumedUnit` are `Informational Tokens`, so a sum of `Tokens` never counts them twice.

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

## One departure from FOCUS 1.4

FOCUS 1.4 says EffectiveCost "MUST equal BilledCost when ChargeCategory is "Usage" and the charge is not covered by other eligible charges" ([EffectiveCost, FOCUS 1.4](https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec/blob/v1.4/specification/datasets/cost_and_usage/columns/effectivecost.md), retrieved 2026-11-01).

A `measured`, `billed` or `derived` row breaks that sentence. Its `BilledCost` is 0 and its `EffectiveCost` is not. The row states a cost the ledger measured, and the only column FOCUS keeps for an incurred cost that is not an invoice line is `EffectiveCost`.

A reader merging these rows with the provider's own FOCUS data must not add the two `EffectiveCost` sums. `costroid/cost_source` tells the rows apart.

## Row ids

`x_CostroidRowId` is the lower-case hexadecimal SHA-256 of the UTF-8 text `<request id>:<token class>`, joined by one colon. The token class is the row's `SkuMeter`. The request id is the provider's. An agent that reports none gets a stand-in from its adapter, which the adapter documents.

`examples-request-ids.json` names the synthetic request id behind each example row, by its `costroid/cost_source`. `validate.mjs` recomputes `x_CostroidRowId` from it on every row that passes the schema. The first row of `examples/request-rows.csv` hashes the text `req_example_0001:input_uncached`. `examples/rejected/row-id-without-the-colon.json` is the same row hashed without the colon.

## Numbers

Every amount and quantity is a decimal string with at most 12 fractional digits, never a JSON number and never scientific notation. A row states the digits it computed, without padding.

## Proof

Every example passes `scripts/validate.mjs`. The header has not been run through Costroid Platform's FOCUS version resolver: version 0.1's header was, on 2026-11-01. `RegionId` and `RegionName` are FOCUS columns, and `x_CostroidServiceTier` carries the prefix FOCUS reserves for custom columns.
