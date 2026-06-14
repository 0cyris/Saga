# Loredeck Creator Live Test Log

Concise running log for real SillyTavern Loredeck Creator tests against `http://127.0.0.1:8000/` with `SAGA_ALLOW_PROVIDER_CALLS=1`.

## 2026-06-14

- Built out the `live-creator` smoke path in `tools/scripts/smoke-live-st-cdp.mjs` to drive Creator intake through Scope Brief, Story Outline, title batches, Context/Tag planning, Lorecard drafting, Pending Review, Pack Health, finalization, Library/file verification, and cleanup.
- Real One Piece Arlong Park run reached Scope Brief but exposed fragile DOM-text waits after provider completion. Changed key waits to use the Creator state probe instead of overlay text.
- Repeated One Piece runs exposed stale active smoke jobs and late provider responses rehydrating into new sessions. Added cancellation/reset checks before starting a new live run and made reset validation ignore `Pending Review 0`.
- Real runs exposed slow post-approval UI rerenders and duplicate Creator overlay surfaces. Hardened the click helper with bounded polling and all-matching-overlay lookup.
- Latest live One Piece run exercised Scope Brief, Story Outline, all title batches, one approved title, Context/Tag planning, one Lorecard draft, Send to Review, Accept All, and Pack Health. It bound at finalization because `Finalize Anyway` opens a confirmation dialog that the smoke runner did not confirm. Patched the runner to confirm coverage acknowledgement and wait for `Finalize as Custom Loredeck` to become enabled before finalization.
- Longer live One Piece run used seven real provider units through all title batches, then bound after approving the first title because another first-overlay text wait missed the visible `Plan Context and Tags` action. Replaced that wait with the Creator state/button-label probe.
- Next One Piece run hit a transient provider failure on Story Outline: two attempts ended with `No message generated` while the UI exposed `Retry Failed`. Added retry-aware generation waits that click `Retry Failed` once for Scope Brief, Story Outline, title batches, Context/Tag planning, and Lorecard drafting.
- Full One Piece run reached Pack Health and confirmed `Finalize Anyway`, but finalization stayed blocked on `Acknowledge coverage`. Root cause: `normalizeLoredeckCreatorJob()` dropped `coverageFinalizeAcknowledgement`, so the coverage acknowledgement vanished on project normalization. Added the field to the persisted Creator job model and a regression assertion.
- Post-fix One Piece run produced another full title pass, including a retry on one title batch, then hit a redundant timing gate before `Plan Context and Tags`. Removed that gate and now rely on the polling click helper for the next action.
- A short rerun showed the Scope Brief approval state can flip before the `Draft Story Outline` button is actually mounted. Changed brief and outline approval waits to require the next actionable button before continuing.
