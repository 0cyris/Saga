# Saga Reliability Patches — October 6, 2026

These patches were pushed to `main` after the `0.4.0-alpha.4` (**Scribe**) cut. They do not change the alpha version identifier. See commit [`ec2138e1`](https://github.com/MentallyQuill/Saga/commit/ec2138e1e04127f5415990bbdb5f63ed95e19422).

## Data and state safety

- Settings migration now supports unversioned and schema-1 inline Library, Deck Maker, Theme Pack, and Icon Set registries. Saga verifies an exact-source recovery backup before writing the external payloads and indexes. It preserves source data and stops if a write cannot be verified, the settings format is unsupported, or existing external content conflicts. See [Storage And State Safety](../user/STORAGE_AND_STATE_SAFETY.md).
- Failed payload or index writes retain the prior verified files, the recoverable transaction record, and a reportable operation failure. An unrelated successful write no longer clears a pending failure. Startup can restore an interrupted change or finish a committed cleanup.
- Storage indexes now coordinate writes among Saga adapters and cooperating tabs when browser locks are available. The system detects stale revisions and supports conditional writes when the host provides them.
- Supported state imports preserve the source schema until its migrations finish. Imports from schema versions 20–26 keep their existing migration behavior, including legacy automation choices.

## Chat, generation, and Story Maker

- Continuity, Lore Automation, and other async state updates stay attached to the chat that started them. A chat switch or disable prevents stale work from committing. Per-chat automatic work is serialized and coalesces to the latest event.
- State-saving flows expose whether persistence was acknowledged. Durable backup or restore actions stop when a protective save cannot be confirmed.
- Generation commits now have stable unit identities and are checkpointed separately. If a checkpoint fails after a successful commit, recovery retries the checkpoint instead of repeating the provider call or logical change. Permanent provider errors are separated from retryable errors; supported routes use bounded retries and backoff.
- Story Maker persists each finished variant before its siblings finish. Saved variants survive reload and resume without another provider call; failed or unfinished variants can be retried. See the [desktop](../user/STORY_MAKER_DESKTOP_GUIDE.md) and [mobile](../user/STORY_MAKER_MOBILE_GUIDE.md) guides.
- Context loading no longer lets a slow, older request overwrite the current cache. Missing, invalid, reversed, or unresolved required timeline bounds fail closed, and media identifiers match exactly by field.

## Resource, lifecycle, and bundled-content fixes

- Provider requests have bounded deadlines; streaming responses enforce output and idle limits and release readers on exit. Late results cannot update Saga state after timeout or cancellation.
- ZIP imports enforce input, per-file, and total decompressed-size limits while reading and validate archive bounds before accepting entries.
- Extension events, tools, and runtime views now have symmetric setup and teardown. Failed view refreshes can recover while prompt synchronization continues.
- Windows bundle creation uses the repository’s Node ZIP support rather than requiring a separate `zip` or Python executable.
- Restored 40 existing manifest-declared Star Trek reveal and future-guard Lorecards. Narrow ignore exceptions include the authored deck data in fresh checkouts while keeping unrelated files and credential paths ignored.

## Verification and limits

The local run passed all 218 production JavaScript syntax checks. The full run plus final affected reruns covered all 183 discovered test scripts; 75 affected tests passed again after the last storage change. The secret scan passed. No live SillyTavern UI, provider, or user-storage run was part of this patch validation.

Host support still sets two important limits. SillyTavern’s raw and quiet generation APIs do not accept Saga’s abort signal, so a timed-out underlying request may continue even though Saga suppresses its late result and does not overlap it with another request on that route. Storage coordination cannot guarantee conflict-free writes from another device or an uncoordinated client when the host lacks server-side conditional writes. Legacy host settings-save APIs that only report a scheduled save cannot confirm that trimmed settings reached disk; the verified recovery backup remains available.

For the full implementation record and test detail, see the [reliability implementation ledger](../development/SAGA_RELIABILITY_IMPLEMENTATION_2026-10-06.md), [storage coordination contract](../development/SAGA_STORAGE_COORDINATION_CONTRACT.md), and [chat persistence contract](../development/SAGA_CHAT_PERSISTENCE_CONTRACT.md).
