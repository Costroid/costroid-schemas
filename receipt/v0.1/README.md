# Costroid receipt, version 0.1

The token counts of a developer's own agent sessions on one branch. `costroid receipt` reads the session files Claude Code writes on the developer's machine, and prints a receipt. The developer posts it as a comment on the pull request. The schema is [`receipt.schema.json`](receipt.schema.json), and every receipt's `schema` field reads `costroid.receipt/0.1`.

A receipt states counts and never an amount. The report that reads it prices the counts at the catalog its own binary loads, and [`result/v0.13`](../../result/v0.13/README.md) states that figure apart from the run's. Nothing checked the counts: they are the developer's statement about their own machine.

This is the first version. It reads Claude Code's session files alone, and a later version adds an agent. All branches, session ids, versions, models and counts in `examples/` are synthetic.

## The comment

The comment's body is a marker line, then the receipt as one JSON object in a fenced block:

````text
<!-- costroid:receipt -->
```json
{
  "schema": "costroid.receipt/0.1",
  "branch": "fix/retry-backoff",
  "written": "2026-11-20",
  "since": "2026-11-18",
  "agents": ["claude-code"],
  "sessions": [
    {
      "agent": "claude-code",
      "agent_version": "2.1.5",
      "session_id": "b81d02e4-6c3a-4f0e-8d5b-19a4c7e2f360",
      "model": "example-large-1",
      "service_tier": "standard",
      "region": null,
      "first_day": "2026-11-20",
      "last_day": "2026-11-20",
      "requests": 96,
      "largest_input": "121904",
      "tokens": {
        "input_uncached": "7311",
        "cache_read": "3904812",
        "cache_write_5m": "0",
        "cache_write_1h": "188040",
        "output": "88214"
      }
    }
  ],
  "sessions_omitted": 0
}
```
````

The object is [`examples/one-session.json`](examples/one-session.json).

A comment typed or pasted in a browser can be stored with CRLF line endings, and a copy from a terminal can lose or gain a final line feed. So a reader does two things to the body before it reads it, and nothing else:

1. It replaces each CRLF with LF.
2. It ignores blank lines after the closing fence.

The body is then exactly these lines: the marker `<!-- costroid:receipt -->`, a line that reads `` ```json ``, the object, and a line that reads `` ``` ``, with or without a line feed after it. A carriage return that is not followed by a line feed refuses the receipt. Nothing else is normalised: a space at the end of the marker or a fence, and a line of spaces after the closing fence, each refuse it. A comment whose first line is not the marker, a blank line included, is no receipt. [What a reader refuses](#what-a-reader-refuses) lists each case.

The marker names no version, so a reader of 0.1 that meets a later receipt reads its `schema` and refuses it, rather than passing it over.

A report reads the newest receipt the pull request's author posted on the pull request. It refuses one that was edited after it was posted, and one that names another branch than the pull request's. [`result/v0.13`](../../result/v0.13/README.md#receipts) states each refusal.

## What it holds

| Field              | Value                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | `costroid.receipt/0.1`                                                                                                                                |
| `branch`           | The branch the receipt is for. [The branch](#the-branch) gives its form                                                                               |
| `written`          | The UTC day the receipt was written, as `YYYY-MM-DD`                                                                                                  |
| `since`            | The UTC day of the oldest entry of the branch's reflog on the machine. A session that ended before it is not counted. Null when the reflog holds none |
| `agents`           | The agents whose session files were read: `["claude-code"]` in this version                                                                           |
| `sessions`         | One entry per session, model, service tier and region, at most 150                                                                                    |
| `sessions_omitted` | The oldest sessions left out so that the receipt fits in one comment                                                                                  |

A `since` of null states that the receipt has no lower bound. Sessions of an earlier branch of the same name on the same machine can then be counted.

Each entry of `sessions`:

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `agent`         | `claude-code`                                                                                                           |
| `agent_version` | The agent's own version string, as its session file states it                                                           |
| `session_id`    | The agent's session id, in the form of the tag `costroid/session_id`. A join, never a credential                        |
| `model`         | The model that served the requests, in the form of the tag `costroid/model`                                             |
| `service_tier`  | The service tier as the catalog names it, or null when the session file states none                                     |
| `region`        | The region the requests were held to, or null on default routing. Never `global`                                        |
| `first_day`     | The UTC day of the entry's first request                                                                                |
| `last_day`      | The UTC day of the entry's last request                                                                                 |
| `requests`      | The model requests the entry sums, at least 1                                                                           |
| `largest_input` | The largest whole input of any one of those requests: its uncached input, cache reads and cache writes                  |
| `tokens`        | Token counts by billed class                                                                                            |
| `assumed_ttl`   | The cache lifetimes the adapter's rule assigned because the session file did not state them. Absent when it stated each |

`largest_input` selects a context tier. A sum of requests cannot: an entry whose largest request is within the lowest tier prices exactly, and one past it does not.

Every count is a whole number written as a decimal string, with no sign, no fraction and no leading zero, below 10^15. `requests` is a JSON integer.

## Token classes

`tokens` names the billed classes of [`focus-row/v0.6`](../../focus-row/v0.6/README.md#token-classes) that Claude Code's session file states: `input_uncached`, `cache_read`, `cache_write_5m`, `cache_write_1h` and `output`. Each is stated, `0` included. The informational classes, `reasoning_output` and `cached_input_reported`, repeat a billed class and are never stated.

`assumed_ttl` holds `5m` or `1h` where the row's rule for Claude Code assigned the lifetime, as [row version 0.6](../../focus-row/v0.6/README.md#assumed-lifetimes) lists. It carries that to the rows the report builds, which state it in `costroid/assumed_ttl`.

## The branch

`branch` is the branch as git names it. It takes letters, digits and `.`, `_`, `+` and `-`, in components joined by `/`, and opens with a letter or a digit. No component opens with a dot or ends with `.lock`, the name holds no `..`, does not end with a dot and is never `HEAD`. It is at most 255 characters.

A detached head has no branch, and gets no receipt. A branch whose name falls outside this form gets none either.

## What it never holds

A receipt holds no prompt, response, tool input or tool output, no file path, instruction, title or summary, and no cost, price, currency or login. The working directory a session file records is compared with the repository's and never written, because it names the user's home.

Every string is a closed word, a day or a pattern. No field holds free text, and a key the schema does not define refuses the whole receipt. A cost or a price key is such a key.

## What a reader refuses

A reader refuses the whole receipt, and reads none of its sessions, when the object breaks the schema:

| The receipt                                                          | Example in `examples/rejected/`                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| States a cost, a price or a currency                                 | `states-a-cost.json`, `states-a-price.json`, `states-a-currency.json`, `states-a-cost-as-a-token-class.json`                                                                    |
| Holds a key the schema does not define                               | `names-the-working-directory.json`, `holds-a-prompt.json`, `names-its-author.json`                                                                                              |
| Names no branch, or a branch outside its form                        | `without-a-branch.json`, `branch-as-null.json`, `branch-of-a-detached-head.json`, `branch-with-a-space.json`, `branch-with-a-parent-segment.json`, `branch-ending-in-lock.json` |
| Holds a string outside its pattern                                   | `model-outside-its-pattern.json`, `region-global.json`, `day-with-a-time.json`                                                                                                  |
| Names an agent this version does not read                            | `names-codex.json`, `agent-outside-the-list.json`                                                                                                                               |
| States a count outside its form or past its bound                    | `count-past-fifteen-digits.json`, `count-as-a-json-number.json`, `count-with-a-fraction.json`, `count-with-a-leading-zero.json`, `requests-zero.json`                           |
| States a class Claude Code does not state, or leaves out one it does | `informational-class.json`, `cache-write-at-30-minutes.json`, `claude-code-without-its-one-hour-writes.json`                                                                    |
| States a lifetime as assumed that Claude Code's rule never assigns   | `assumed-lifetime-at-30-minutes.json`                                                                                                                                           |
| Leaves out its lower bound, rather than stating null                 | `lower-bound-absent.json`                                                                                                                                                       |
| Holds no session, the same entry twice, or more than 150             | `no-sessions.json`, `session-twice.json`, `sessions-past-150.json`                                                                                                              |
| States another version                                               | `schema-of-another-version.json`                                                                                                                                                |

A reader also refuses a receipt for four faults the schema cannot see, because `scripts/validate.mjs` reads the object alone:

- A body outside the form under [The comment](#the-comment), in the cases below.
- An object that holds a key twice. JSON parsers disagree on which value wins, so a person and a reader could read two receipts.
- Two entries with the same `session_id`, `model`, `service_tier` and `region`.
- A day out of order: a `first_day` after its `last_day`, a `last_day` after `written`, or a `last_day` before `since`.

What a reader does with the body, before it reads the object:

| The body                                                                       | The reader                                |
| ------------------------------------------------------------------------------ | ----------------------------------------- |
| Lines that end in LF                                                           | Reads it                                  |
| Lines that end in CRLF, or some in CRLF and some in LF                         | Replaces each CRLF with LF, then reads it |
| No line feed after the closing fence                                           | Reads it                                  |
| One or more blank lines after the closing fence, in LF or CRLF                 | Ignores them, then reads it               |
| A carriage return that no line feed follows, anywhere                          | Refuses it                                |
| A line of spaces, any text or a second fenced block after the closing fence    | Refuses it                                |
| A space or a tab at the end of the marker or of a fence line                   | Refuses it                                |
| An opening fence that does not read `json`, or any other line out of its place | Refuses it                                |
| A first line other than the marker, a blank line included                      | Is no receipt, and is not read            |
