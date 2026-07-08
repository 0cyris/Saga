# Addendum 01: Host Contract And Fake Host

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga needs a real host boundary before the rest of the redesign can be reliable. Current code has useful host-adapter hints, but domain modules can still depend on SillyTavern-shaped globals, file paths, prompt APIs, and generation profiles. That limits Lumiverse/Spindle support, makes tests too dependent on browser state, and makes prompt/storage bugs difficult to isolate.

The target is a `SagaHost` contract that every runtime path uses for host-owned operations, plus a fake host that can run fast behavior tests without SillyTavern or Lumiverse.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\core\host-adapter-source.js`
- `F:\git\Saga\src\providers\lore-llm-client.js`
- `F:\git\Saga\src\continuity\prompt-injector.js`
- `F:\git\Saga\src\storage\saga-file-api.js`
- `F:\git\Saga\src\storage\saga-domain-storage.js`
- `F:\git\Saga\src\runtime\lore-panel.js`
- `F:\git\Saga\src\runtime\context-composition.js`
- `F:\git\Saga\src\runtime\loredeck-workflow-composition.js`

The storage rework already defines a flat `/user/files` model, but the host capability that provides that file API should be explicit. The prompt injector already abstracts some prompt behavior, but it should install a host-neutral prompt projection rather than reaching into one host's prompt shape directly.

## Target Contract

The host contract should expose capabilities by domain:

```js
export const SAGA_HOST_CAPABILITIES = Object.freeze({
  chat: "chat",
  prompt: "prompt",
  generation: "generation",
  files: "files",
  storage: "storage",
  notifications: "notifications",
  lifecycle: "lifecycle",
  navigation: "navigation",
  diagnostics: "diagnostics",
});
```

The contract should be a plain object with stable async methods and capability metadata:

```js
export function createSagaHostContract(adapter) {
  return {
    id: adapter.id,
    label: adapter.label,
    version: adapter.version,
    capabilities: adapter.capabilities,
    chat: adapter.chat,
    prompt: adapter.prompt,
    generation: adapter.generation,
    files: adapter.files,
    storage: adapter.storage,
    notifications: adapter.notifications,
    lifecycle: adapter.lifecycle,
    diagnostics: adapter.diagnostics,
  };
}
```

Each domain should have a narrow interface.

| Domain | Required methods | Notes |
| --- | --- | --- |
| Chat | `getMessages`, `getSelectedMessageVariant`, `getChatIdentity`, `onChatChanged` | Must report host message IDs and selected variants. |
| Prompt | `installProjection`, `clearProjection`, `getProjectionStatus` | Accepts Saga prompt projection packets, not raw card dumps. |
| Generation | `runGenerationRole`, `getProviderProfiles`, `abortGeneration` | Called by the generation router, not directly by Deck Maker or Story Maker. |
| Files | `writeFile`, `readFile`, `verifyFile`, `deleteFile` | Keeps flat-file constraints and safe filenames centralized. |
| Storage | `readSettings`, `writeSettings`, `readChatMetadata`, `writeChatMetadata` | Settings stay control-plane only. |
| Notifications | `showNotice`, `showProgress`, `clearProgress` | Keeps user feedback host-neutral. |
| Lifecycle | `onReady`, `onUnload`, `onSettingsChanged` | Lets Saga bind once and clean up. |
| Diagnostics | `recordEvent`, `exportDiagnostics` | Bounded, sanitized diagnostics only. |

## Capability Detection

The contract should not pretend every host can do everything. Each adapter should report support and limits:

```json
{
  "hostId": "sillytavern",
  "capabilities": {
    "files": { "supported": true, "flatFilenamesOnly": true, "maxBytes": 10485760 },
    "prompt": { "supported": true, "supportsNamedBlocks": true, "supportsPriority": true },
    "generation": { "supported": true, "supportsAbort": true, "supportsRoleProfiles": false },
    "chat": { "supported": true, "supportsSelectedVariant": true, "supportsEditEvents": "poll" }
  }
}
```

Domain services should branch on capability values, not on host names. A host-name branch is allowed only inside an adapter or a compatibility shim being deleted during the same migration wave.

## Fake Host

The fake host should implement the same contract with in-memory state:

- fake chat messages with selected variants;
- fake prompt installation records;
- fake provider responses by generation role;
- fake flat files;
- fake settings and chat metadata;
- fake lifecycle events;
- fake diagnostics sink.

It should be good enough to test:

- prompt projection installation;
- storage writes and stale-write conflicts;
- generation router error handling;
- source-frame reconciliation;
- Story Package projection;
- Loredeck import/export paths that do not require actual browser file dialogs.

The fake host is not a UI mock. It is a deterministic contract harness.

## Integration Flow

```text
Extension bootstrap
  -> detect host adapter
  -> create SagaHost
  -> install host in host-adapter-source
  -> initialize storage facade
  -> initialize generation router
  -> initialize prompt projection bridge
  -> render runtime panels
```

Panels should receive domain services, not the raw host. For example, Lorecards should call a `sourceLedger` or `generationRouter`; only those services should call the host.

## Storage Rules

The host contract should enforce storage ownership:

- settings are compact pointers and preferences;
- large user content goes through Saga domain storage;
- bundled content remains extension content;
- runtime source ledgers belong to chat/playthrough state;
- prompt projection audits are bounded diagnostics;
- raw provider payloads are not stored by default.

The file API should reject unsafe names before calling the host:

- no path separators;
- no leading dot;
- no executable extension;
- no spaces for Saga-owned generated filenames;
- no `..` traversal fragments;
- no remote URLs in file-write calls.

## Error Model

Host errors should be normalized before they reach product workflows:

| Code | Meaning |
| --- | --- |
| `host_capability_missing` | The current host cannot perform the requested operation. |
| `host_file_write_failed` | File write failed after Saga filename validation. |
| `host_file_stale_write` | Storage revision changed before write completed. |
| `host_prompt_install_failed` | Prompt projection could not be installed. |
| `host_generation_unavailable` | No provider lane is available for the requested role. |
| `host_generation_aborted` | User or host stopped the request. |
| `host_chat_source_unavailable` | Chat messages or selected variants cannot be read. |

User-facing copy should be short; diagnostics should carry host ID, capability, operation, and stable code.

## Loredeck And Lorecard Implications

Loredecks must be host-neutral assets. They should never depend on:

- SillyTavern `/user/files` paths as primary identity;
- host-specific prompt block names;
- host message IDs;
- chat metadata layout;
- local browser object URLs as durable asset references.

Host-specific references may exist only as resolved runtime pointers. Portable content should use `saga://` identity and relative package paths.

## Required Updates

Implementation of this addendum will require updates to:

- `F:\git\Saga\src\core\host-adapter-source.js`
- new `F:\git\Saga\src\core\saga-host-contract.js`
- new `F:\git\Saga\src\core\fake-saga-host.js`
- host-specific adapters under a new `F:\git\Saga\src\hosts` domain;
- provider routing in `F:\git\Saga\src\providers\lore-llm-client.js`;
- prompt installation in `F:\git\Saga\src\continuity\prompt-injector.js`;
- storage facades in `F:\git\Saga\src\storage`;
- alpha gate tests and fake-host fixtures.

## Verification

The slice is complete when:

1. Domain tests can run against fake host without browser globals.
2. SillyTavern adapter passes the same host contract tests as fake host where supported.
3. Lumiverse/Spindle adapter can declare unsupported capabilities without crashing domain services.
4. Prompt, generation, storage, and chat-source workflows do not reach through the contract for host globals.
5. The alpha gate includes a host-contract test group.

