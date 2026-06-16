# Story Maker Live Test Results

Date: 2026-06-16

Environment:
- Real SillyTavern: `http://127.0.0.1:8000/`
- Installed extension path synced from workspace before testing.
- Active stack for model test: Harry Potter bundled Loredecks, 9 active decks, 498 active Lorecards.
- No character chat was selected; test used Saga's global Session/Loredeck path.

Test scenario:
- Context: Harry Potter Book 6 - January, after Christmas break and before Dumbledore has taught Harry about Horcruxes. Hermione is in her sixth year; the Half-Blood Prince book, Slughorn, Ron and Lavender, and Draco acting strangely are current concerns. Characters should not yet know what Horcruxes are.
- Prose Style: Harry Potter prose style for the Half-Blood Prince era: close third-person, school-year mystery, warm comic friction, precise magical detail, and restrained danger.
- User Prompt: Create a strong story opener featuring Hermione in her sixth year. Start in the Gryffindor common room late in the evening as she notices something that pulls her attention away from homework and toward the larger mystery around Draco and the Prince textbook.
- Character Focus: Hermione Granger, with Harry and Ron present but secondary.
- Opening Shape: Dialogue first.
- PoV/Tense: 3rd person limited on Hermione, past tense.
- Target Length: Scene.
- Variants: enabled.

Results:
- Desktop Session tab rendered Story Maker after Automation Mode and before Session Metrics.
- Created a global Story Maker session and confirmed the Deck Maker-style stage bar, revert controls, source actions, variants, revision prompt, and copy button.
- With no active stack, readiness clearly reported missing User Prompt, Context, and Loredeck stack.
- After adding the Harry Potter stack, `Use Current Active Stack` detected Harry Potter and pre-populated editable Prose Style.
- Full provider pipeline completed in about 116 seconds.
- Context Packet result: 14 eligible facts, 484 blocked facts, 40 visible guardrails.
- Visible guardrails included Half-Blood Prince identity, Snape loyalty, Ron/Lavender timing, Harry/Ginny timing, and altered Horcrux-memory timing.
- Three variant buttons rendered: Variant A, Variant B, Variant C.
- Copy Opener wrote the selected opener exactly to the browser clipboard in the first draft pass.
- Revision pass completed in about 51 seconds.
- Revision history recorded the revision instruction and previous selected opener.
- Mobile root at 390px stayed compact and showed a dedicated Story Maker action.
- Mobile Story Maker subview rendered the full stage bar, inputs, variants, output, copy, and revise controls.
- Full alpha gate passed after the final mobile patch.

Initial draft evidence:
- Variant A: 6331 chars. Started: "No, the wrist rotation is counterclockwise on the third pass--honestly, Ronald, were you even listening in Flitwick's review session?"
- Variant B: 8653 chars. Started: "No, the wand movement is counter-clockwise first, then the diagonal slash--honestly, did you even read the chapter?"
- Variant C: 7435 chars. Started: "No, the wand movement is counterclockwise first, then the diagonal slash--look, it's right there in the diagram, Ron."
- Initial variants mentioned Hermione, Draco, and the Prince; none mentioned Horcruxes by name.

Revision prompt:
"Make Hermione more central and reduce the Ron/Lavender comedy. Keep the opener in the same January Book 6 position and preserve the no-Horcrux-knowledge guardrail."

Revised opener evidence:
- Variant A: 8894 chars. Started: "No, the counter-clockwise comes after the diagonal--honestly, Harry, you're not even looking at the standard instructions anymore."
- Variant B: 8817 chars. Started: "No, the counter-clockwise rotation stabilizes the ward boundary--that's what makes it a containment variant rather than a standard shield--honestly, Ron, it's not complicated, you're just not reading the diagram properly"
- Variant C: 7121 chars. Started: "No, the counter-clockwise rotation comes before the diagonal slash--see? The diagram shows the wand tip moving first, then the flick."
- Revised variants mentioned Hermione, Draco, and the Prince; none mentioned Horcruxes by name.

Notes:
- The model generated relatively long "Scene" outputs. That is acceptable for this test, but the target-length instructions may need tightening if we want Scene to cap closer to a chat-message-sized opener.
- The live profile's active stack was empty before testing; the test added all matching Harry Potter decks through the Loredeck Library UI.
