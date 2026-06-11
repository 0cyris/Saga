/**
 * Prompt templates and memo limits for Saga.
 */

export const LORE_CONTEXT_DETECTION_SYSTEM_PROMPT = `You are Saga's Context Detector for long-form fandom roleplay.

Read the current continuity state and recent messages. Extract a compact Context Brief for the current scene.
The brief is not the final Loredeck Context. It is a set of clues Saga will resolve against loaded Loredeck anchors and windows.

Output ONLY valid JSON:
{
  "schemaVersion": 1,
  "summary": "one short sentence describing the current story position",
  "branchId": "main|custom branch string",
  "timeTravelMode": "none|visitor_from_future|past_changed|alternate_branch",
  "evidence": [
    {
      "quote": "short exact phrase from recent messages",
      "signal": "date|arc|episode|chapter|event|stardate|branch|uncertainty"
    }
  ],
  "signals": {
    "sceneDate": "string, or empty if unknown",
    "subjectiveDate": "string, or empty if same/unknown",
    "canonBoundary": "story-position phrase, or empty if unknown",
    "positionPhrases": ["brief before/after/during phrases"],
    "fandomHints": ["fandom or series names explicitly implied"],
    "arc": "arc/saga/run/film/season label, or empty",
    "phase": "phase/sub-arc/status quo, or empty",
    "season": "season number or label, or empty",
    "episode": "episode number/title, or empty",
    "chapter": "chapter number/range/title, or empty",
    "issue": "comic issue/run marker, or empty",
    "quest": "quest/mission label, or empty",
    "gameStage": "act/route/faction stage, or empty",
    "stardate": "stardate, or empty",
    "coordinates": {
      "axis": "value"
    },
    "eventLabels": ["named events, reveals, battles, lessons, deaths, or milestones"]
  },
  "uncertainty": {
    "level": "low|medium|high",
    "notes": ["short reason uncertainty remains"]
  }
}

Rules:
- Do not invent a precise date if only an era is known.
- Prefer story-position signals when precise dates are unclear.
- Use empty strings or empty arrays for unknown fields.
- Evidence quotes must come from the recent messages.
- Keep fields concise; do not summarize the full chat.
- Do not invent anchors, windows, dates, episodes, chapters, or stardates.
- If time travel is implied, separate sceneDate from subjectiveDate.
- Output JSON only.`;

// ── JSON repair prompt ──────────────────────────────────────────────────────────
export const JSON_REPAIR_SYSTEM_PROMPT = `You repair malformed JSON.

Return ONLY valid JSON.
Do not add markdown.
Do not explain.
Preserve the user's intended data and conform to the required shape provided in the user's repair request.`;

// ── Token budget for memo ───────────────────────────────────────────────────────
export const MEMO_MAX_TOKENS = 500;


// ── Character list truncation limits ────────────────────────────────────────────
export const MAX_PRESENT_CHARS_IN_MEMO = 8;
export const MAX_KNOWLEDGE_FACTS_PER_CHAR = 5;
export const MAX_ACTIVE_THREADS_IN_MEMO = 6;
export const MAX_RELATIONSHIPS_IN_MEMO = 6;
export const MAX_FLAGS_IN_MEMO = 4;
