<!--
Shared return contract. `loredeck brief` appends this to every role template, rendered with
the same context. Each role's context builder supplies returnWroteExample,
returnCountsExample, returnCountsNote and returnFlagsNote.
The contract shape is fixed by §3.3/§9 of the multi-agent design spec; change it there first.
-->
## Return format

Your files on disk are the deliverable. The orchestrator reads them from disk, so your final message reports on them and does not repeat their contents.

Your final message is exactly one JSON object and nothing else: no prose before or after it, and no Markdown code fence. It has this shape:

{"status":"ok","wrote":["{{returnWroteExample}}"],"counts":{{returnCountsExample}},"gaps":[],"flags":[]}

- `status`: `"ok"` when you completed the assignment. `"partial"` when you wrote the file but parts of the assignment are missing; list them in `gaps`. `"failed"` when you could not write a usable file; say why in `gaps`.
- `wrote`: the project-relative path of every file you wrote. Use `[]` when you wrote nothing.
- `counts`: {{returnCountsNote}}
- `gaps`: one short string per missing piece of the assignment, saying what is missing and why. Use `[]` when nothing is missing.
- `flags`: short `kind:detail` strings for decisions the orchestrator needs to make, for example {{returnFlagsNote}} Use `[]` when there is nothing to raise.
