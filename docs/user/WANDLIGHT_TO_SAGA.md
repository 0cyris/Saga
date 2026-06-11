# Wandlight To Saga

Saga is not a Wandlight-compatible preset workflow. It carries forward Wandlight's main lesson: users need a confident way to make the model respect story position, hidden knowledge, and relevant lore.

Saga expresses that workflow through Loredecks, Context, Lorecards, and reviewable prompt selection.

## Concept Mapping

| Wandlight-era concept | Saga concept |
| --- | --- |
| Fandom-specific preset | Loredeck or active Loredeck stack |
| Date-aware canon filtering | Context selected from a Loredeck timeline or Choose Story Position |
| Lorebook-style facts | Context-gated Lorecards |
| Prompt memo/injection controls | Advanced Injection preview and placement controls |
| Generated memory changes | Pending Review before acceptance |
| Continuity scan state | Continuity tools in Advanced |
| Manual lore edits | Add or edit Lorecards in Review |

## Basic Difference

Basic Saga users do not need to learn the Injection tab. They load a Loredeck, set Context, review Lorecards, and use the Session Start Checklist plus Lorecards review flow to decide when the chat is ready.

## Advanced Difference

Advanced users can inspect and tune the full injection pipeline, automate parts of the workflow, audit why a Lorecard did or did not affect the prompt, and author or repair Loredecks.

## Migration Mindset

Do not try to recreate every Wandlight control one-for-one. Translate user-facing needs into Saga-native surfaces:

- "What story point are we at?" belongs in **Context**.
- "What facts matter now?" belongs in **Lorecards**.
- "What exactly reaches the model?" belongs in **Advanced Injection**.
- "What source data should this fandom use?" belongs in **Loredecks**.
