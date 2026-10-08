## Common mistakes

These are the mistakes checkers make most often. They apply the verdict rules above and add no new ones. Check each card against all four before you write its verdict.

- **Detail taken from a record's other fields.** A record's `inUniverseSpan`, `title`, `keyEntities` and `quotesOrRefs` are not facts. A claim detail (a date, place, quantity or ability) that appears only there, and in no cited fact, is not backed.
- **Gate opens too early.** A window that opens before the point where the cited facts place the event is a timing problem, even when the claim itself is true. So is a `public` card that states something the facts place later than its window opens.
- **Fact from a different record.** A pointer that resolves to a real fact about a different event, scene or person does not back the claim, even when the same claim is stated elsewhere in the evidence. Judge only the facts the card cites.
- **Embellished injection.** `content.injection` is part of the claim. A detail it adds beyond the cited facts is not backed, just as it would not be in `content.fact`.
