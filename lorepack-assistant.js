/**
 * lorepack-assistant.js -- Saga/Wandlight
 * Prompt and response helpers for Lorepack Assistant proposal drafting.
 */

const ASSISTANT_SUPPORTED_ACTIONS = Object.freeze(new Set([
    'upsert_entry',
    'disable_entry',
    'restore_entry',
    'upsert_tag_definition',
    'upsert_timeline_anchor',
    'upsert_timeline_window',
]));

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = 1000) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value, maxLength = 180) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanStringArray(value = [], limit = 24, maxLength = 240) {
    const input = Array.isArray(value) ? value : [];
    const output = [];
    const seen = new Set();
    for (const raw of input) {
        const item = cleanString(raw, maxLength);
        if (!item || seen.has(item.toLowerCase())) continue;
        seen.add(item.toLowerCase());
        output.push(item);
        if (output.length >= limit) break;
    }
    return output;
}

function stripJsonFences(text = '') {
    const cleaned = cleanString(text, 100000);
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return fenceMatch ? fenceMatch[1].trim() : cleaned;
}

function removeReasoningBlocks(text = '') {
    return String(text || '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
}

function sanitizeJsonish(text = '') {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[\u0000-\u001F]+/g, match =>
            match === '\n' || match === '\r' || match === '\t' ? match : ''
        )
        .trim();
}

function findBalancedJson(text = '', open = '{', close = '}') {
    const s = String(text || '');
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (start === -1) {
            if (ch === open) {
                start = i;
                depth = 1;
            }
            continue;
        }
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === open) depth += 1;
        if (ch === close) depth -= 1;
        if (depth === 0) return s.slice(start, i + 1);
    }
    return start >= 0 ? s.slice(start) : '';
}

function parseAssistantJson(text = '') {
    const cleaned = sanitizeJsonish(stripJsonFences(removeReasoningBlocks(text)));
    const candidates = [
        cleaned,
        findBalancedJson(cleaned, '{', '}'),
        findBalancedJson(cleaned, '[', ']'),
    ].filter(Boolean);
    const errors = [];
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (e) {
            errors.push(e?.message || 'Invalid JSON');
        }
    }
    throw new Error(`Lore Assistant returned invalid JSON${errors.length ? `: ${errors[0]}` : ''}.`);
}

function coerceAssistantShape(parsed) {
    if (Array.isArray(parsed)) return { proposals: parsed };
    if (!isPlainObject(parsed)) return { proposals: [] };
    return {
        summary: cleanString(parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(parsed.clarifyingQuestions || parsed.questions, 8, 300),
        proposals: Array.isArray(parsed.proposals)
            ? parsed.proposals
            : (Array.isArray(parsed.changes) ? parsed.changes : []),
    };
}

function normalizeAssistantProposal(raw = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const action = cleanString(raw.action || raw.type || raw.kind, 80);
    if (!ASSISTANT_SUPPORTED_ACTIONS.has(action)) return null;
    const entry = isPlainObject(raw.entry) ? raw.entry : null;
    const tagDefinition = isPlainObject(raw.tagDefinition || raw.tag) ? (raw.tagDefinition || raw.tag) : null;
    const timelineAnchor = isPlainObject(raw.timelineAnchor || raw.anchor) ? (raw.timelineAnchor || raw.anchor) : null;
    const timelineWindow = isPlainObject(raw.timelineWindow || raw.window) ? (raw.timelineWindow || raw.window) : null;
    const entryId = cleanId(raw.entryId || entry?.id);
    const tagId = cleanId(raw.tagId || tagDefinition?.id, 140);
    const timelineId = cleanId(raw.timelineId || timelineAnchor?.id || timelineWindow?.id);
    return {
        action,
        proposalId: cleanId(raw.proposalId || raw.id || `proposal_${index + 1}`, 120),
        title: cleanString(raw.title || raw.label || action, 240),
        reason: cleanString(raw.reason || raw.rationale || raw.description, 1000),
        confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : null,
        risk: cleanString(raw.risk || raw.riskLevel, 80),
        entryId,
        tagId,
        timelineId,
        entry,
        tagDefinition,
        timelineAnchor,
        timelineWindow,
        disable: raw.disable === true,
        restore: raw.restore === true,
        before: isPlainObject(raw.before) ? raw.before : null,
        after: isPlainObject(raw.after) ? raw.after : null,
    };
}

export function parseLorepackAssistantResponse(text = '') {
    const parsed = coerceAssistantShape(parseAssistantJson(text));
    const proposals = [];
    const warnings = [];
    for (const [index, raw] of (parsed.proposals || []).entries()) {
        const proposal = normalizeAssistantProposal(raw, index);
        if (!proposal) {
            warnings.push(`Skipped unsupported proposal ${index + 1}.`);
            continue;
        }
        proposals.push(proposal);
    }
    return {
        summary: parsed.summary || '',
        clarifyingQuestions: parsed.clarifyingQuestions || [],
        proposals,
        warnings,
    };
}

export function buildLorepackAssistantSystemPrompt() {
    return `You are Saga's Lore Assistant for editable fandom Lorepacks.

Return JSON only. Do not include markdown.

Core rule: propose changes for Pending Review. Do not claim changes are already applied.

Prioritize high-value scene context over wiki summaries:
- Good lore changes what characters know, hide, want, fear, expect, avoid, reveal, misunderstand, or react to.
- Avoid generic biography and encyclopedia summaries.
- Keep injection text concise and directly usable in a roleplay prompt.
- Preserve stable IDs unless creating a new entry.
- Preserve namespaced tags unless the user asks to change them.
- Use known timeline anchors where possible; do not invent anchor IDs unless the user asks to draft new anchors.
- Avoid future canon leakage outside the supplied Story Position windows.
- Ask clarifying questions when the user's creative direction is subjective or underspecified.

Supported proposal actions:
- upsert_entry with {entry}
- disable_entry with {entryId}
- restore_entry with {entryId}
- upsert_tag_definition with {tagDefinition}
- upsert_timeline_anchor with {timelineAnchor}
- upsert_timeline_window with {timelineWindow}

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Save entry: ...",
      "entryId": "existing_or_new_entry_id",
      "entry": {},
      "reason": "why this is useful scene lore",
      "confidence": 0.75,
      "risk": "low"
    }
  ]
}

If clarification is needed before proposing changes, return an empty proposals array and 1-3 clarifyingQuestions.`;
}

export function buildLorepackAssistantUserPrompt(context = {}) {
    return JSON.stringify({
        task: 'Draft reviewable Lorepack proposals from the user instruction.',
        instruction: cleanString(context.instruction, 4000),
        mode: cleanString(context.mode || 'mixed', 80),
        targetScope: cleanString(context.targetScope || 'current_filter', 80),
        pack: context.pack || {},
        storyPosition: context.storyPosition || {},
        allowedTimelineAnchorIds: cleanStringArray(context.allowedTimelineAnchorIds, 160, 180),
        knownTags: cleanStringArray(context.knownTags, 160, 140),
        targetEntries: Array.isArray(context.targetEntries) ? context.targetEntries.slice(0, 60) : [],
    }, null, 2);
}

export const __lorepackAssistantTestHooks = {
    parseAssistantJson,
    parseLorepackAssistantResponse,
    normalizeAssistantProposal,
};
