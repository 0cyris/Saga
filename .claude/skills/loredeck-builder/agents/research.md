<!--
Role template: research. Rendered by `loredeck brief <id> --role research --deck D --scope S [--file F] [--assignment TEXT]`.
This comment is stripped before rendering. Placeholders use {{name}}; rendering fails on any
placeholder the research context builder (lib/briefs.mjs) does not supply. The shared return
contract (_return-contract.md) is appended after this template.

Authoring rules for this file: state every required shape positively, and keep failure-mode
history and anti-examples out of it. That rationale lives in references/subagent-playbook.md,
which only the orchestrator reads.
-->
# Research brief: `{{scope}}` evidence for {{projectTitle}}

You are a research subagent for the Saga Loredeck workshop project `{{projectId}}`. You are gathering evidence for the deck `{{deckId}}` (role: {{deckRole}}), within the evidence scope `{{scope}}`. Evidence records are the only material that Lorecards may later be drafted from, so accuracy and provenance matter more than coverage.

## Your assignment

Research {{assignment}}. Cover that and nothing outside it; other subagents cover the rest of the scope.

## Your deliverable

Write exactly one file:

- Path: `{{outputFile}}`
- Project-relative path: `{{outputFileRel}}`
- Project folder: `{{projectDir}}`

This file is your whole output. The orchestrator reads it from disk, validates it, and presents it to the user for review.

## Scope brief

This is the user-approved scope brief for the project. It defines the source range, the continuity boundary ({{continuityId}}), and the spoiler posture. Everything you record falls inside it.

<scope-brief>
{{scopeBrief}}
</scope-brief>

## Evidence file shape

Your file has exactly this shape. It is the project's evidence template, reproduced verbatim. Keep every top-level key and every record key, keep `records` as the array that holds the records, and replace the example values with your research.

```json
{{evidenceTemplate}}
```

Field by field:

- `schemaVersion`: the number `1`.
- `scope`: the string `"{{scope}}"`.
- `deckId`: the string `""`. Evidence is shared project-wide by default, so leave it empty even though you are researching for `{{deckId}}`; the orchestrator's task note may give a deck id to use instead.
- `sourceKind`: `"web"` when your facts come from web pages, or `"user_supplied"` when they come from material the orchestrator gave you.
- `provenance`: `url` is the page you researched (required for `"web"`), `title` names the source (required for `"user_supplied"`), and `retrievedAt` is the date you read it, as `YYYY-MM-DD`.
- `records`: one object per discrete topic (a chapter, character, place, rule, or event):
  - `id`: a short lowercase slug that is unique within the scope and reads clearly on its own, like `canon-ch-01` in the template. Cards will cite it as `{{scope}}/<id>`.
  - `title`: one line saying what the record covers.
  - `inUniverseSpan`: a story-coordinate label such as a chapter, episode, or arc name. It is used for sorting.
  - `keyEntities`: the named people, places, groups, and objects the record concerns.
  - `authoringSignals`: one or more values from the vocabulary below.
  - `facts`: at least one fact. Each fact is one specific, source-grounded statement.
  - `quotesOrRefs`: short quotes or precise references (chapter, page, section heading) that back the facts.
- `failures`: one string per thing you set out to research and could not source, saying what and why.

{{usedRecordIds}}

## authoringSignals vocabulary

Tag each record with the signals it supports, using these values exactly:

{{authoringSignals}}

## Source policy

- Use the source material named in the scope brief and the orchestrator's task note. When the task note supplies source text, that text is your source, and `sourceKind` is `"user_supplied"`.
- For web research, prefer established reference wikis for this canon. Record the exact page URL and the retrieval date in `provenance`. Use one evidence file per assignment. When you consult several pages, put the main page in `provenance.url` and cite the others in each record's `quotesOrRefs`.
- Read the full text of every page you rely on. When a tool returns only part of a page, open the full page at its URL, or record the gap in `failures` and raise the `truncated-source` flag.
- Quote briefly. Record facts in your own words, and keep quotes to a sentence or two.

## How to write facts

- Base every fact on source text you actually read during this task. When the source does not clearly support something, record it in `failures` instead.
- Make each fact specific: who, what, and when in story terms. One claim per fact.
- When the source is ambiguous, say so in the fact itself.
- When sources disagree, write the fact as contested, name both sources and what each says, and raise the `contested` flag for that record.
- Stay inside the continuity boundary and source range from the scope brief.
- Record what the source states. Interpretation, summaries of themes, and card drafting belong to later stages that the orchestrator runs.

## Before you return

Re-read your file once. Check that it parses as JSON, that `scope` is `"{{scope}}"`, that every record has an `id`, a `title`, and at least one fact, and that every record id is unique.
