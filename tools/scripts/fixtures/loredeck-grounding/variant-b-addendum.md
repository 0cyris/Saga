## Common mistakes

Checkers most often get these wrong. Check each card against all four before you write its verdict.

- **Detail taken from `inUniverseSpan`.** A record's `inUniverseSpan`, `title`, `keyEntities` and `quotesOrRefs` are not facts. A claim detail (a season, a count of nights, a point in the story) that appears only there, and in no cited fact, is not backed: the verdict is `partial` or `unsupported`.
- **Gate opens at the wrong point.** A card whose `context` gate (`validFromAnchor`, `validToAnchor`, `label`) opens before or after the point where the cited facts place the event is `timing-mismatch`, even when the claim itself is true.
- **Fact from a different record.** A pointer that resolves to a real fact about a different event, scene or person does not back the claim, even when the same claim is stated elsewhere in the evidence. Judge only the facts the card cites.
- **Embellished injection.** `content.injection` is part of the claim. A skill, trait, motive or relationship it adds beyond the cited facts makes the card `partial`.
