<!--
Role template: draft. Rendered by `loredeck brief <id> --role draft --deck D --batch B --file <category>/<topic-stem>`.
This comment is stripped before rendering. Placeholders use {{name}}; rendering fails on any
placeholder the draft context builder (lib/briefs.mjs) does not supply. The shared return
contract (_return-contract.md) is appended after this template.

Authoring rules for this file: state every required shape positively, and keep failure-mode
history and anti-examples out of it. That rationale lives in references/subagent-playbook.md,
which only the orchestrator reads. references/authoring-rules.md is inlined in full as the
`authoringRules` placeholder.
-->
# Drafting brief: batch `{{batchId}}` for {{projectTitle}}

You are a drafting subagent for the Saga Loredeck workshop project `{{projectId}}`. You are turning the approved title batch `{{batchId}}` for the deck `{{deckId}}` (role: {{deckRole}}) into Lorecards. Each card is grounded in specific facts from accepted evidence records, so accuracy and traceability matter more than polish.

## Your assignment

Draft one card per title in the batch below ({{titleCount}} in all). Each card's `id`, `title`, and `category` come from its title, and its context gating follows the title's `gateIntent`. Cover these titles and nothing else; other subagents draft the other batches.

## Your deliverable

Write exactly one file:

- Path: `{{outputFile}}`
- Project-relative path: `{{outputFileRel}}`
- Project folder: `{{projectDir}}`

{{existingFileNote}}

The file is a Saga entry file: a JSON object with `"schemaVersion": 3` and an `entries` array holding your cards. This file is your whole output. The orchestrator reads it from disk, merges it into the deck, and runs the deck's checks.

## The approved title batch

This is `{{batchFileRel}}`, reproduced verbatim. The user approved it at the titles gate.

```json
{{batchJson}}
```

## Read-only registries

These two files define every timeline anchor and tag the deck has. Read both before drafting. They are read-only: you read them and use what they define, and the orchestrator alone edits them.

- Timeline: `{{timelineFile}}` (`{{timelineFileRel}}`)
- Tags: `{{tagsFile}}` (`{{tagsFileRel}}`)

Use only anchor ids from `timeline.json` in `context.validFromAnchor`/`validToAnchor`, with `sortKeyFrom`/`sortKeyTo` matching those anchors' sortKeys. Use only tag ids defined in `tags.json`. When a card needs a tag that `tags.json` does not define, draft the card with the tags that exist and raise `missing-tag:<namespace:value>` in your return flags. When a card needs an anchor that `timeline.json` does not define, use the nearest defined anchors that keep the card gated at least as tightly, and raise `missing-anchor:<anchor-id>`.

## Evidence to read

Read each of these evidence files in full before drafting. They hold every record the batch cites:

{{evidenceFiles}}

The batch cites these records (`<scope>/<recordId>`), held in the files shown:

{{citedRecords}}

Draw each card only from the records its own title cites in `evidenceRefs`. The other records in these files belong to other titles.

## How to ground each card

- Write every claim in `content.fact`, `content.injection`, and the other prose fields from the `facts[]` strings of the records the title cites. The title's `support` pointers mark the facts that back its `gateIntent`; start from those.
- Every card carries `sourceInfo.evidenceRefs`: the `<scope>/<recordId>` keys of the records it draws on, taken from its title's `evidenceRefs`.
- Every card carries `sourceInfo.evidenceFacts`: fact pointers of the form `<scope>/<recordId>#<factIndex>`, where `factIndex` is the 0-based position of the fact in that record's `facts[]`. List the specific facts that the card's `content.fact` rests on, and only those. Every pointer's `<scope>/<recordId>` also appears in the card's `sourceInfo.evidenceRefs`.
- When the cited facts support only part of a title, draft the supported part. When they support none of it, leave that card out, list the title in `gaps`, and raise `ungrounded:<title-id>`.
- The orchestrator checks every `evidenceFacts` pointer mechanically on return (`ground check --stage cards`) and reads each `content.fact` against the facts its pointers name.

## Authoring rules

These are the project's authoring rules, in full. Follow them for every card.

<authoring-rules>
{{authoringRules}}
</authoring-rules>

## Before you return

Re-read your file once. Check that it parses as JSON, that it has `"schemaVersion": 3` and an `entries` array, that every card id comes from the batch and appears once, that every card has `sourceInfo.evidenceRefs` and `sourceInfo.evidenceFacts`, and that every tag and anchor you used is defined in the registries.
