# Saga Storage And State Safety

Saga stores large Saga-owned content outside `settings.json` wherever the SillyTavern files API is available. This keeps generated Loredecks, imported packages, Creator drafts, Theme Packs, Icon Sets, and passive assets from bloating the main settings file.

## Storage Model

Saga uses a flat JSON file model under SillyTavern's `/user/files` area. It does not require a server plugin or a private filesystem workspace.

`settings.json` should keep compact preferences and pointers:

- current Saga settings and provider preferences
- the selected Theme Pack and Icon Set IDs
- compact storage metadata under `sagaStorage`
- migration and diagnostics timestamps

`/user/files` should hold Saga-owned payload files:

- `saga-storage-index.v1.json`: master list of Saga-managed files
- `saga-library-index.v1.json`: Library folders, placements, installed Lorepack summaries, and payload references
- `saga-creator-index.v1.json`: Creator project summaries and active project pointers
- `saga-lorepack-*.v1.json`: Generated and Custom Lorepack payloads
- `saga-creator-project-*.v1.json`: in-progress Creator project stage artifacts
- `saga-theme-index.v1.json`: installed Theme Pack records and payload references
- `saga-theme-pack-*.v1.json`: Custom Theme Pack payloads
- `saga-iconset-index.v1.json`: installed Icon Set records and payload references
- `saga-iconset-*.v1.json`: Custom Icon Set manifests
- passive assets referenced by imported packages, such as cover images and raster icons

Bundled Lorepacks, bundled Theme Packs, bundled Icon Sets, and bundled passive assets remain in the extension repository. Saga records references to them but does not copy every bundled payload into `/user/files`.

## Imports

Loredeck package imports write the parsed package payload to Saga storage and register it in the Library index. When an imported `.saga-loredeck.zip` includes a cover image or other passive assets, Saga stores those assets as files and keeps JSON references to them.

Theme Pack imports store JSON Theme Pack payloads as data. Theme Packs cannot run code.

Icon Set imports store JSON manifests and approved raster icon assets. SVG icon import remains intentionally restricted in the first pass because SVG can carry active content in some environments.

## Creator Projects

The Loredeck Creator stores heavy in-progress project data in Creator project payload files. This includes scope, outline, title batches, Context and tag planning, Lorecard draft batches, review queues, generation unit metadata, and generated-pack links.

The Creator index keeps the shelf summary and active project pointer compact. The current chat state can still point to the active Creator project, but it should not carry the full staged project payload.

## State Safety

Open **Settings**, switch to **Advanced**, then open **State Safety**.

State Safety has three storage controls:

- **Migrate Legacy Storage** moves legacy settings-backed Saga payloads into `/user/files`. If no legacy payloads are present, the button reads **Storage Current** and stays disabled.
- **Verify Storage** reads Saga's master storage index and checks whether tracked files still exist and parse as expected.
- **Settle Storage Writes** waits for queued Saga storage writes to finish, then verifies storage again. It is only enabled when queued writes or write errors are known.
- **Clean Missing Records** verifies the index and removes records for missing non-index files. It does not delete Library rows and does not scan for unknown orphan files.

The State Safety status pills and key-value rows summarize migration state, latest storage integrity, backups, and recent migration or cleanup log entries.

## What Cleanup Can Do

Because Saga is using SillyTavern's flat files API, it can confidently clean records it owns in its master index.

It can:

- remove stale master-index records for missing non-index files
- preserve protected index records for manual review
- report write failures and pending writes
- record cleanup actions in State Safety logs

It cannot reliably scan an arbitrary Saga folder for orphan files because this storage model does not assume folder listing support. Unknown orphan-file cleanup remains a manual or future-host-feature task.

## Troubleshooting

| Problem | First check |
| --- | --- |
| `settings.json` is growing quickly | Open **State Safety** and run **Migrate Legacy Storage** if available. |
| A Loredeck appears in Library but fails Pack Health after reload | Run **Verify Storage**, then reopen the Loredeck and run Pack Health again. |
| A write seems stuck or a recent import does not appear after reload | Run **Settle Storage Writes**, then **Verify Storage**. |
| Storage reports missing files | Confirm whether the file was manually deleted. Use **Clean Missing Records** only when stale records should be removed from Saga's storage index. |
| Cleanup does not remove a Library item | This is expected. Cleanup removes missing file records from the storage index; delete Library items from the Library UI. |
| A bundled Lorepack appears in settings metadata | Bundled packs can have compact records or references. Full bundled payloads should stay in the extension repository. |

## Manual Inspection

For alpha testing, inspect the active SillyTavern user profile after imports or generation:

- `settings.json` should not contain full Loredeck entry arrays, full Creator stage artifacts, large Theme Pack libraries, or base64 cover/icon blobs.
- `/user/files` should contain Saga-owned `saga-*.json` records for imported, generated, and custom content.
- imported cover images and icon rasters should appear as passive asset files referenced by JSON.
- `saga-library-index.v1.json` should reflect Library folders and placements.
- `saga-creator-index.v1.json` should reflect Creator project summaries.
- full Creator stage data should live in `saga-creator-project-*.v1.json`.
