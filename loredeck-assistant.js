/**
 * loredeck-assistant.js -- Saga/Wandlight
 * Prompt and response helpers for Loredeck Assistant proposal drafting.
 */

const ASSISTANT_SUPPORTED_ACTIONS = Object.freeze(new Set([
    'upsert_entry',
    'disable_entry',
    'restore_entry',
    'upsert_tag_definition',
    'upsert_timeline_anchor',
    'upsert_timeline_window',
]));

const ASSISTANT_RUBRIC_LEVELS = Object.freeze(new Set(['high', 'medium', 'low', 'not_applicable']));

const ASSISTANT_RUBRIC_KEYS = Object.freeze([
    'sceneUtility',
    'activationClarity',
    'behavioralImpact',
    'relationshipImpact',
    'conflictStakes',
    'nonRedundancy',
    'injectionQuality',
    'contextFit',
]);

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = 1000) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value, maxLength = 180) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanPackId(value, maxLength = 140) {
    return cleanId(value, maxLength)
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLength);
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

function cleanInteger(value, fallback = 0, min = 0, max = 100000) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanStringList(value = [], limit = 24, maxLength = 240) {
    if (Array.isArray(value)) return cleanStringArray(value, limit, maxLength);
    const item = cleanString(value, maxLength);
    return item ? [item] : [];
}

function cleanRubricLevel(value) {
    const raw = cleanString(value, 40)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!raw) return '';
    if (raw === 'n_a' || raw === 'na' || raw === 'none') return 'not_applicable';
    if (raw === 'med' || raw === 'moderate') return 'medium';
    if (raw === 'minor' || raw === 'minimal') return 'low';
    if (raw === 'strong') return 'high';
    return ASSISTANT_RUBRIC_LEVELS.has(raw) ? raw : '';
}

function normalizeAssistantRubric(raw = {}) {
    const source = isPlainObject(raw.rubric)
        ? raw.rubric
        : (isPlainObject(raw.qualityRubric)
            ? raw.qualityRubric
            : (isPlainObject(raw.quality) ? raw.quality : {}));
    if (!isPlainObject(source)) return null;
    const rubric = {};
    for (const key of ASSISTANT_RUBRIC_KEYS) {
        const level = cleanRubricLevel(source[key]);
        if (level) rubric[key] = level;
    }
    const wikiRisk = cleanRubricLevel(source.wikiSummaryRisk || source.wikiRisk || raw.wikiSummaryRisk);
    if (wikiRisk) rubric.wikiSummaryRisk = wikiRisk;
    const notes = cleanStringList(source.notes || source.rationale || raw.qualityNotes, 6, 220);
    if (notes.length) rubric.notes = notes;
    const warnings = cleanStringList(source.warnings || raw.qualityWarnings, 6, 220);
    if (warnings.length) rubric.warnings = warnings;
    return Object.keys(rubric).length ? rubric : null;
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
        rubric: normalizeAssistantRubric(raw),
        disable: raw.disable === true,
        restore: raw.restore === true,
        before: isPlainObject(raw.before) ? raw.before : null,
        after: isPlainObject(raw.after) ? raw.after : null,
    };
}

export function parseLoredeckAssistantResponse(text = '') {
    const parsedJson = parseAssistantJson(text);
    const parsed = coerceAssistantShape(parsedJson);
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const proposals = [];
    const warnings = cleanStringArray(raw.warnings, 12, 300);
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

function normalizeCreatorBrief(raw = {}) {
    const source = isPlainObject(raw?.brief)
        ? raw.brief
        : (isPlainObject(raw?.packBrief)
            ? raw.packBrief
            : (isPlainObject(raw) ? raw : {}));
    if (!isPlainObject(source)) return null;
    const range = isPlainObject(source.estimatedEntryRange || source.entryRange)
        ? (source.estimatedEntryRange || source.entryRange)
        : {};
    const min = cleanInteger(range.min ?? range.low, 0, 0, 10000);
    const max = cleanInteger(range.max ?? range.high, min, min, 10000);
    const brief = {
        title: cleanString(source.title || source.name, 180),
        packId: cleanPackId(source.packId || source.id || source.title || source.name, 140),
        fandom: cleanString(source.fandom, 120),
        scope: cleanString(source.scope || source.coverageRange || source.coverage, 240),
        granularity: cleanString(source.granularity || source.density, 80),
        coverage: cleanString(source.coverage || source.coverageSummary, 1000),
        contextApproach: cleanString(source.contextApproach || source.timelineApproach, 1000),
        estimatedEntryRange: {
            min,
            max,
            rationale: cleanString(range.rationale || source.entryRangeRationale, 500),
        },
        timelinePlan: cleanStringArray(source.timelinePlan || source.timeline || source.anchors, 12, 240),
        tagPlan: cleanStringArray(source.tagPlan || source.tags || source.entityPlan, 16, 180),
        titlePassPlan: cleanStringArray(source.titlePassPlan || source.entryTitlePassPlan || source.titlePlan, 12, 240),
        assumptions: cleanStringArray(source.assumptions, 12, 240),
        exclusions: cleanStringArray(source.exclusions || source.outOfScope, 12, 240),
        risks: cleanStringArray(source.risks || source.openRisks, 12, 240),
        nextStage: cleanString(source.nextStage, 500),
    };
    return Object.values(brief).some(value => {
        if (Array.isArray(value)) return value.length > 0;
        if (isPlainObject(value)) return Object.values(value).some(Boolean);
        return !!value;
    }) ? brief : null;
}

function normalizeCreatorTitleDraft(raw = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const title = cleanString(raw.title || raw.name || raw.label, 220);
    if (!title) return null;
    const fallbackId = `title-${index + 1}`;
    const titleId = cleanPackId(raw.titleId || raw.id || raw.entryId || title || fallbackId, 160) || fallbackId;
    const relevance = cleanRubricLevel(raw.relevance || raw.importance || raw.priorityBand);
    const draft = {
        titleId,
        title,
        category: cleanString(raw.category || raw.type || raw.kind, 120),
        priority: cleanInteger(raw.priority ?? raw.weight ?? raw.rank, 50, 0, 100),
        relevance: relevance && relevance !== 'not_applicable' ? relevance : '',
        contextHint: cleanString(raw.contextHint || raw.timelineHint || raw.windowHint, 500),
        tags: cleanStringArray(raw.tags || raw.tagHints || raw.suggestedTags, 24, 140),
        reason: cleanString(raw.reason || raw.rationale || raw.description, 1000),
        rubric: normalizeAssistantRubric(raw),
        warnings: cleanStringArray(raw.warnings || raw.qualityWarnings, 8, 240),
    };
    return draft;
}

export function parseLoredeckCreatorBriefResponse(text = '') {
    const parsedJson = parseAssistantJson(text);
    const parsed = coerceAssistantShape(parsedJson);
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const brief = normalizeCreatorBrief(raw);
    return {
        summary: cleanString(raw.summary || parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(raw.clarifyingQuestions || raw.questions || parsed.clarifyingQuestions, 8, 300),
        brief,
        warnings: cleanStringArray(raw.warnings, 8, 300),
    };
}

export function parseLoredeckCreatorTitleResponse(text = '') {
    const parsedJson = parseAssistantJson(text);
    const parsed = coerceAssistantShape(parsedJson);
    const raw = isPlainObject(parsedJson) ? parsedJson : {};
    const titleRows = Array.isArray(parsedJson)
        ? parsedJson
        : (Array.isArray(raw.titleDrafts)
            ? raw.titleDrafts
            : (Array.isArray(raw.titles)
                ? raw.titles
                : (Array.isArray(raw.entries) ? raw.entries : [])));
    const titleDrafts = [];
    const warnings = cleanStringArray(raw.warnings, 12, 300);
    const seenIds = new Set();
    for (const [index, row] of titleRows.entries()) {
        const draft = normalizeCreatorTitleDraft(row, index);
        if (!draft) {
            warnings.push(`Skipped unsupported title draft ${index + 1}.`);
            continue;
        }
        let id = draft.titleId;
        if (seenIds.has(id)) id = `${id}-${index + 1}`;
        seenIds.add(id);
        titleDrafts.push({ ...draft, titleId: id });
    }
    const batch = isPlainObject(raw.batch || raw.titleBatch) ? (raw.batch || raw.titleBatch) : {};
    return {
        summary: cleanString(raw.summary || parsed.summary, 1000),
        clarifyingQuestions: cleanStringArray(raw.clarifyingQuestions || raw.questions || parsed.clarifyingQuestions, 8, 300),
        warnings,
        titleDrafts,
        batch: {
            label: cleanString(batch.label || batch.name, 160),
            coverage: cleanString(batch.coverage || batch.scope || raw.batchCoverage, 500),
            nextBatchHint: cleanString(batch.nextBatchHint || raw.nextBatchHint, 500),
            complete: batch.complete === true || raw.complete === true,
        },
    };
}

export function buildLoredeckCreatorBriefSystemPrompt() {
    return `You are Saga's Loredeck Creator intake assistant.

Return JSON only. Do not include markdown.

Your task is to turn a user's fandom, scope, and granularity into a short deck brief for approval. Do not generate Lorecards, timeline anchors, or tag registries yet.

Creator principles:
- Narrow vague or oversized requests into a practical story scope.
- Do not require spoiler boundary, adaptation, continuity, or approximate entry count from the user.
- Coverage says what the deck may contain; Context later decides what can inject.
- Lorecard count is derived from granularity, coverage size, and story density.
- Prefer high-value roleplay/fanfic scene context over wiki completeness.
- Flag assumptions and risks clearly.
- If the request is too broad or ambiguous, ask 1-3 clarifying questions and leave brief null.

Granularity meanings:
- compact: key constraints and major character/state changes only.
- focused: practical arc-level play with enough detail for long-form roleplay.
- dense: many anchors, relationships, and scene-specific constraints.
- scene_dense: intensive coverage for a short span with many moment-level entries.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "warnings": [],
  "brief": {
    "title": "Arlong Park Arc",
    "packId": "one-piece-arlong-park",
    "fandom": "One Piece",
    "scope": "Arlong Park Arc",
    "granularity": "focused",
    "coverage": "What this pack should cover.",
    "contextApproach": "How timeline anchors/windows should likely be organized later.",
    "estimatedEntryRange": { "min": 70, "max": 120, "rationale": "Derived from scope and granularity." },
    "timelinePlan": ["High-level anchor/window plan only."],
    "tagPlan": ["High-level tag/entity plan only."],
    "titlePassPlan": ["How the next title-pass should be organized."],
    "assumptions": ["Assumption to confirm."],
    "exclusions": ["Out-of-scope material."],
    "risks": ["Known risk."],
    "nextStage": "Recommended next generation stage."
  }
}`;
}

export function buildLoredeckCreatorBriefUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft a reviewable Loredeck Creator pack brief only.', 500),
        fandom: cleanString(context.fandom, 200),
        scope: cleanString(context.scope, 1000),
        granularity: cleanString(context.granularity || 'focused', 80),
        notes: cleanString(context.notes, 2000),
        revisionInstruction: cleanString(context.revisionInstruction, 2000),
        previousBrief: isPlainObject(context.previousBrief) ? context.previousBrief : null,
        constraints: {
            noEntryGenerationYet: true,
            noTimelineGenerationYet: true,
            noRequiredSpoilerBoundary: true,
            noRequiredAdaptationOrContinuityQuestion: true,
            entryCountMustBeDerived: true,
            coverageIsNotInjectionBoundary: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
        },
    }, null, 2);
}

export function buildLoredeckCreatorTitleSystemPrompt() {
    return `You are Saga's Loredeck Creator title-pass assistant.

Return JSON only. Do not include markdown.

Your task is to turn an approved Creator brief into reviewable future Lorecard titles. Generate titles only.

Hard limits:
- Do not generate full Lorecards, facts, injection text, timeline anchors, timeline windows, or tag registries yet.
- Do not ask the user for an approximate Lorecard count. Derive title count from the approved brief's granularity, coverage size, story density, and entry range.
- If a deck is too large for one response, return a coherent first title batch and use batch.nextBatchHint to describe the next batch.
- When selectedTitleDrafts are supplied, revise only those selected title drafts and return replacements for them.

Title quality rules:
- Prefer high-value roleplay/fanfic scene context over wiki completeness.
- Each title should imply playable pressure, constraints, relationships, secrets, powers, obligations, setting response, or context consequences.
- Include broad/wide titles only when they are genuinely useful across a large window; mark that in contextHint.
- Avoid duplicate titles and avoid generic biography titles.
- Use category, priority, relevance, contextHint, tags, reason, and rubric so the user can review before Lorecard generation.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "warnings": [],
  "batch": {
    "label": "Characters and pressure",
    "coverage": "What this title batch covers.",
    "nextBatchHint": "What should be generated next, if anything.",
    "complete": false
  },
  "titleDrafts": [
    {
      "titleId": "nami-hides-her-bargain",
      "title": "Nami hides her bargain with Arlong",
      "category": "character_pressure",
      "priority": 85,
      "relevance": "high",
      "contextHint": "From the crew's Cocoyasi arrival until Nami asks for help.",
      "tags": ["character:nami", "faction:arlong-pirates"],
      "reason": "Creates secrecy, pressure, and timing for scenes.",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "high",
        "behavioralImpact": "high",
        "relationshipImpact": "medium",
        "conflictStakes": "high",
        "nonRedundancy": "high",
        "injectionQuality": "medium",
        "contextFit": "high",
        "wikiSummaryRisk": "low",
        "notes": ["Title points toward playable behavior, not biography."]
      },
      "warnings": []
    }
  ]
}`;
}

export function buildLoredeckCreatorTitleUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft a reviewable Creator title pass only.', 500),
        approvedBrief: isPlainObject(context.brief) ? context.brief : null,
        notes: cleanString(context.notes, 2000),
        revisionInstruction: cleanString(context.revisionInstruction, 2000),
        previousTitleDrafts: Array.isArray(context.previousTitleDrafts) ? context.previousTitleDrafts : [],
        selectedTitleDrafts: Array.isArray(context.selectedTitleDrafts) ? context.selectedTitleDrafts : [],
        titlePassLimit: cleanInteger(context.titlePassLimit, 80, 10, 120),
        constraints: {
            approvedBriefRequired: true,
            titlesOnly: true,
            noEntryGenerationYet: true,
            noTimelineGenerationYet: true,
            noTagRegistryGenerationYet: true,
            entryCountMustBeDerived: true,
            preserveTitleIdsWhenRevising: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
        },
    }, null, 2);
}

export function buildLoredeckCreatorPlanningSystemPrompt() {
    return `You are Saga's Loredeck Creator timeline and tag planning assistant.

Return JSON only. Do not include markdown.

Your task is to turn an approved Creator brief and approved title drafts into reviewable planning proposals for Pending Review.

Hard limits:
- Do not generate full Lorecards, facts, injection text, Lorecard bodies, or entry overrides yet.
- Return only supported planning proposal actions: upsert_timeline_anchor, upsert_timeline_window, and upsert_tag_definition.
- Do not claim proposals are applied. They are drafts for Pending Review.
- Preserve stable IDs and namespaced tags.
- Timeline anchors/windows should be useful for Context gating and should prevent future canon leakage.
- Tags should support retrieval, filtering, Deck Health, and future Lorecard generation. Avoid tag spam and avoid vague unnamespaced tags when a namespace is natural.
- Use approvedTitleDrafts to infer the minimum useful timeline and tag shape; do not attempt full deck completeness in one pass.
- If the approved title shape is insufficient, ask 1-3 clarifying questions and return an empty proposals array.

Planning guidance:
- Use anchors for meaningful story moments, reveals, arrivals, battles, state changes, relationship pivots, or date/arc boundaries.
- Use windows for spans where entries should be eligible between two anchors.
- Use tag definitions for characters, factions, locations, arcs, concepts, powers, secrets, and relationship/state clusters that the approved titles imply.
- Prefer a compact but robust registry foundation over exhaustive wiki coverage.
- Include confidence, risk, reason, and rubric on every proposal.

Supported proposal actions:
- upsert_timeline_anchor with {timelineAnchor}
- upsert_timeline_window with {timelineWindow}
- upsert_tag_definition with {tagDefinition}

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "warnings": [],
  "proposals": [
    {
      "action": "upsert_timeline_anchor",
      "title": "Create anchor: crew reaches Cocoyasi",
      "timelineId": "one-piece.arlong.cocoyasi-arrival",
      "timelineAnchor": {
        "id": "one-piece.arlong.cocoyasi-arrival",
        "label": "Straw Hats reach Cocoyasi Village",
        "contextType": "arc_event",
        "sortKey": 120,
        "arc": "Arlong Park",
        "aliases": ["Cocoyasi arrival", "crew reaches Nami's village"],
        "tags": ["arc:arlong-park", "location:cocoyasi-village"],
        "notes": "Anchor for early Cocoyasi scenes before the full Nami reveal."
      },
      "reason": "Gives Context a clear early-arc boundary.",
      "confidence": 0.82,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "high",
        "behavioralImpact": "medium",
        "relationshipImpact": "medium",
        "conflictStakes": "medium",
        "nonRedundancy": "high",
        "injectionQuality": "not_applicable",
        "contextFit": "high",
        "wikiSummaryRisk": "low",
        "notes": ["Planning metadata, not wiki recap."]
      }
    }
  ]
}`;
}

export function buildLoredeckCreatorPlanningUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft reviewable Creator timeline anchors/windows and tag definitions only.', 500),
        generatedPackId: cleanPackId(context.generatedPackId || '', 140),
        approvedBrief: isPlainObject(context.brief) ? context.brief : null,
        approvedTitleDrafts: Array.isArray(context.approvedTitleDrafts) ? context.approvedTitleDrafts : [],
        notes: cleanString(context.notes, 2000),
        existingTimelineIds: cleanStringArray(context.existingTimelineIds, 160, 180),
        existingTagIds: cleanStringArray(context.existingTagIds, 240, 140),
        proposalLimit: cleanInteger(context.proposalLimit, 40, 8, 80),
        constraints: {
            approvedBriefRequired: true,
            approvedTitlesRequired: true,
            timelineAndTagsOnly: true,
            noEntryGenerationYet: true,
            noEntryFactsOrInjectionYet: true,
            pendingReviewOnly: true,
            preserveStableIds: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
        },
    }, null, 2);
}

export function buildLoredeckCreatorEntrySystemPrompt() {
    return `You are Saga's Loredeck Creator Lorecard drafting assistant.

Return JSON only. Do not include markdown.

Your task is to generate reviewable schema v3 Lorecard proposals from approved title drafts and accepted planning metadata.

Hard limits:
- Return only upsert_entry proposals. Do not return timeline, tag, disable, restore, manifest, or settings proposals.
- Do not claim Lorecards are applied. They are drafts for edit-before-queue review, then Pending Review, then acceptance.
- Generate one Lorecard proposal per targetTitleDraft.
- Treat targetTitleDrafts as the entire assignment for this response. Do not continue into unlisted titles, even if the deck needs more entries.
- Use targetTitleDraft.titleId as entry.id unless it is invalid; preserve stable IDs.
- Use only acceptedTimelineRegistry anchors/windows and acceptedTagRegistry tags. Do not invent anchor IDs or tag IDs at this stage.
- Every entry must be schemaVersion 3 with content.fact, content.injection, context, retrieval, tags, category, canon/canonStatus, relevance, and priority.
- Do not write wiki summaries. The fact should state the useful story constraint; the injection should tell the roleplay prompt what changes in-scene.
- Keep each proposal compact: fact under 90 words, injection under 110 words, notes under 40 words, and reason under 50 words.

Schema v3 entry requirements:
- entry.context.scope must be "anchor", "window", or "global".
- entry.context.sortKeyFrom and entry.context.sortKeyTo must be numeric.
- entry.context.precision and entry.context.label must be non-empty.
- window entries should use validFromAnchor/validToAnchor when a matching accepted window exists.
- anchor entries should use anchorId when tied to a single accepted anchor.
- global/wide entries must use conservative retrieval: activation "topic_or_entity", frequency "low", contextBoost "low".
- entry.retrieval.activation, frequency, and contextBoost must be non-empty.

High-value lore rules:
- Prefer playable scene pressure over completeness.
- Encode what characters know, hide, want, fear, expect, avoid, misunderstand, reveal, protect, threaten, or risk.
- Include consequences, relationship pressure, secrets, obligations, local rules, faction expectations, or setting reactions.
- Keep content.injection concise and directly usable in a prompt.
- Avoid future canon leakage outside the chosen Context window.
- Ask 1-3 clarifying questions and return no proposals if accepted planning metadata is insufficient.

Use the Lore Value Rubric for every proposal.

Output shape:
{
  "summary": "short summary",
  "clarifyingQuestions": [],
  "warnings": [],
  "proposals": [
    {
      "action": "upsert_entry",
      "title": "Draft entry: Nami hides her bargain with Arlong",
      "entryId": "nami-hides-her-bargain",
      "entry": {
        "id": "nami-hides-her-bargain",
        "schemaVersion": 3,
        "title": "Nami hides her bargain with Arlong",
        "category": "secret",
        "canon": "canon",
        "canonStatus": "canon",
        "relevance": "high",
        "priority": 88,
        "tags": ["character:nami", "faction:arlong-pirates"],
        "context": {
          "scope": "window",
          "validFromAnchor": "one-piece.arlong.cocoyasi-arrival",
          "validToAnchor": "one-piece.arlong.nami-asks-for-help",
          "sortKeyFrom": 120,
          "sortKeyTo": 180,
          "precision": "anchor_window",
          "windowKind": "arc",
          "label": "Cocoyasi arrival through Nami asking for help"
        },
        "retrieval": {
          "activation": "context_or_topic",
          "frequency": "normal",
          "contextBoost": "high"
        },
        "content": {
          "fact": "Nami conceals that she is trying to buy Cocoyasi's freedom from Arlong, so her apparent betrayal is a protective deception rather than loyalty to Arlong.",
          "injection": "When Nami, Arlong, Cocoyasi, money, betrayal, or the Straw Hats' trust are in focus during this window, frame Nami as evasive and desperate: she protects the village by lying, pushing allies away, and hiding how much leverage Arlong holds over her.",
          "notes": "Playable secrecy and relationship pressure, not a biography."
        },
        "source": "saga-loredeck:one-piece-arlong-park:creator"
      },
      "reason": "Creates scene behavior, secrecy, and timing pressure.",
      "confidence": 0.84,
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "high",
        "behavioralImpact": "high",
        "relationshipImpact": "high",
        "conflictStakes": "high",
        "nonRedundancy": "high",
        "injectionQuality": "high",
        "contextFit": "high",
        "wikiSummaryRisk": "low",
        "notes": ["Entry drives deception and pressure in scenes."]
      }
    }
  ]
}`;
}

export function buildLoredeckCreatorEntryUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft one micro-batch of schema v3 lore entry proposals only.', 500),
        generatedPackId: cleanPackId(context.generatedPackId || '', 140),
        approvedBrief: isPlainObject(context.brief) ? context.brief : null,
        targetTitleDrafts: Array.isArray(context.targetTitleDrafts) ? context.targetTitleDrafts : [],
        acceptedTimelineRegistry: isPlainObject(context.timelineRegistry) ? context.timelineRegistry : null,
        acceptedTagRegistry: isPlainObject(context.tagRegistry) ? context.tagRegistry : null,
        existingEntryIds: cleanStringArray(context.existingEntryIds, 240, 180),
        notes: cleanString(context.notes, 2000),
        entryBatchLimit: cleanInteger(context.entryBatchLimit, 3, 1, 6),
        batchProgress: {
            microBatch: true,
            remainingTitleCount: cleanInteger(context.remainingTitleCount, 0, 0, 10000),
            remainingAfterThisBatch: cleanInteger(context.remainingAfterThisBatch, 0, 0, 10000),
        },
        constraints: {
            generatedPackRequired: true,
            approvedBriefRequired: true,
            approvedTitlesRequired: true,
            acceptedPlanningMetadataRequired: true,
            upsertEntriesOnly: true,
            currentMicroBatchOnly: true,
            doNotGenerateUnlistedTitles: true,
            schemaVersion: 3,
            requireContext: true,
            requireRetrieval: true,
            requireContentFactAndInjection: true,
            useAcceptedTimelineIdsOnly: true,
            useAcceptedTagIdsOnly: true,
            noWikiSummaries: true,
            conciseFields: true,
            pendingReviewOnly: true,
            sagaUseCase: 'long-form fanfic and roleplay Loredecks',
        },
    });
}

export function buildLoredeckAssistantSystemPrompt() {
    return `You are Saga's Lore Assistant for editable fandom Loredecks.

Return JSON only. Do not include markdown.

Core rule: propose changes for Pending Review. Do not claim changes are already applied.

When selectedDraftProposals are supplied, revise only those draft proposals and return replacement proposals for them. Do not rewrite unrelated entries unless the user explicitly asks.

When selectedHealthIssues are supplied, draft repair proposals for those Deck Health issues only. Use supported proposal actions; if an issue needs manifest/stat repair or another unsupported edit, report it in warnings or ask a clarifying question.

Prioritize high-value scene context over wiki summaries:
- Good lore changes what characters know, hide, want, fear, expect, avoid, reveal, misunderstand, or react to.
- Avoid generic biography and encyclopedia summaries.
- Keep injection text concise and directly usable in a roleplay prompt.
- Preserve stable IDs unless creating a new entry.
- Preserve namespaced tags unless the user asks to change them.
- Use known timeline anchors where possible; do not invent anchor IDs unless the user asks to draft new anchors.
- Avoid future canon leakage outside the supplied Context windows.
- Ask clarifying questions when the user's creative direction is subjective or underspecified.

Use the Lore Value Rubric for every proposal:
- sceneUtility: improves dialogue, action, tension, characterization, or setting behavior.
- activationClarity: has a clear Context, window, trigger, or retrieval purpose.
- behavioralImpact: changes what characters do, say, know, believe, hide, avoid, or expect.
- relationshipImpact: affects trust, suspicion, allegiance, intimacy, rivalry, family pressure, or social standing.
- conflictStakes: adds danger, obligation, taboo, mystery, leverage, consequence, or pressure.
- nonRedundancy: is distinct from nearby entries and not generic canon recap.
- injectionQuality: is concise, direct, and useful in a prompt.
- contextFit: avoids future leakage and fits the intended activation window.

Rubric levels must be "high", "medium", "low", or "not_applicable". If wikiSummaryRisk is medium or high, prefer revising the proposal or asking a clarifying question instead of sending weak lore.

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
      "risk": "low",
      "rubric": {
        "sceneUtility": "high",
        "activationClarity": "medium",
        "behavioralImpact": "high",
        "relationshipImpact": "medium",
        "conflictStakes": "medium",
        "nonRedundancy": "high",
        "injectionQuality": "high",
        "contextFit": "medium",
        "wikiSummaryRisk": "low",
        "notes": ["Adds playable pressure instead of biography."]
      }
    }
  ]
}

If clarification is needed before proposing changes, return an empty proposals array and 1-3 clarifyingQuestions.`;
}

export function buildLoredeckAssistantUserPrompt(context = {}) {
    return JSON.stringify({
        task: cleanString(context.task || 'Draft reviewable Loredeck proposals from the user instruction.', 500),
        instruction: cleanString(context.instruction, 4000),
        mode: cleanString(context.mode || 'mixed', 80),
        targetScope: cleanString(context.targetScope || 'current_filter', 80),
        loreValueRubric: {
            target: 'High-value scene context, not wiki completeness.',
            prefer: [
                'playable pressure, secrets, beliefs, fears, obligations, reactions, limits, and relationship consequences',
                'concise injection text that changes the next scene',
                'clear Context fit and retrieval purpose',
            ],
            avoid: [
                'generic biography',
                'broad encyclopedia summary',
                'future canon leakage outside supplied Context windows',
                'long injection text that repeats the fact field',
            ],
            rubricKeys: ASSISTANT_RUBRIC_KEYS,
            levels: [...ASSISTANT_RUBRIC_LEVELS],
        },
        pack: context.pack || {},
        context: context.context || {},
        allowedTimelineAnchorIds: cleanStringArray(context.allowedTimelineAnchorIds, 160, 180),
        knownTags: cleanStringArray(context.knownTags, 160, 140),
        selectedDraftProposals: Array.isArray(context.selectedDraftProposals)
            ? context.selectedDraftProposals.slice(0, 40)
            : [],
        selectedHealthIssues: Array.isArray(context.selectedHealthIssues)
            ? context.selectedHealthIssues.slice(0, 40)
            : [],
        targetEntries: Array.isArray(context.targetEntries) ? context.targetEntries.slice(0, 60) : [],
    }, null, 2);
}

export const __loredeckAssistantTestHooks = {
    parseAssistantJson,
    parseLoredeckAssistantResponse,
    normalizeAssistantProposal,
};
