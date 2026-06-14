/**
 * lore-generator.js — Saga
 * LLM-calling logic for lore context detection and lore matrix generation.
 * No direct UI dependencies — all state operations go through state-manager.
 *
 * Imports: constants.js, state-manager.js, lore-matrix.js
 * Imported by: src/extension/index.js
 */

import {
    LOG_PREFIX,
    LORE_CONTEXT_DETECTION_SYSTEM_PROMPT,
    JSON_REPAIR_SYSTEM_PROMPT,
} from '../state/constants.js';

import {
    getState,
    getSettings,
    setLoreContext,
    setContextBrief,
    normalizeContextBrief,
    recordLoreAttempt,
    appendPendingLoreEntries,
    startLoreBulkBatch,
    checkpointLoreBulkChunk,
    flushLoreBulkFullCheckpoint,
    markInterruptedLoreBulkChunks,
    patchPendingLoreMeta,
    markPendingLoreStale,
    markPendingLoreReplaced,
    saveState,
} from '../state/state-manager.js';

import {
    normalizeLoreContext,
    normalizeLoreMatrix,
    buildLoreGenerationKey,
    filterDuplicateLoreEntries,
    routeSimilarLoreEntries,
} from './lore-matrix.js';

import { sendLoreRequest, validateLoreProviderConfiguration } from '../providers/lore-llm-client.js';
import {
    extractLoreResponseText,
    LORE_PARSE_ERROR_CODES,
} from '../providers/lore-response-normalizer.js';
import { proposeCanonLoreForContext } from '../context/canon-lore-db.js';
import { normalizeLorePurpose, computeSpecificityScore } from './lore-relevance.js';
import { buildContextResolutionAudit, buildResolverContextFromContextBrief, resolveAndApplyContextsFromContext, resolveContextsWithModel } from '../context/context-resolver.js';

// ── Guard flags ─────────────────────────────────────────────────────────────────

let _detectionRunning = false;
let _generationRunning = false;

/** Cooldown window after a failed/empty automatic scan attempt. */
const FAILED_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

/** Attempt statuses that count as a recent failure for automatic scan cooldown. */
const FAILED_STATUSES = ['failed_parse', 'failed_no_response', 'failed_exception', 'empty'];

// ── Helper: quiet LLM prompt ────────────────────────────────────────────────────

/**
 * Sends a controlled JSON task to the LLM via the configured Reasoning provider.
 * Uses sendLoreRequest which dispatches to the provider selected in settings
 * (current ST model, connection profile, or OpenAI-compatible endpoint).
 * @param {string} systemPrompt - System message text
 * @param {string} userMessage - User message text
 * @returns {Promise<string>} LLM response text (may be empty on failure)
 */
async function quietPrompt(systemPrompt, userMessage, options = {}) {
    try {
        const settings = getSettings();
        if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        return extractLoreResponseText(await sendLoreRequest(systemPrompt, userMessage, {
            maxTokens: options.maxTokens || settings.loreMaxTokens || 8192,
            prefill: '',
            signal: options.signal,
            providerKind: options.providerKind || 'lore',
            expectedOutput: options.expectedOutput || 'json',
            stream: options.stream === true,
            onProgress: options.onProgress,
        }));
    } catch (e) {
        if (e?.name === 'AbortError' || /aborted|cancelled|canceled/i.test(e?.message || '')) {
            throw e;
        }
        console.error(`${LOG_PREFIX} Lore generation prompt failed:`, e);
        return '';
    }
}

function isAbortError(e) {
    return e?.name === 'AbortError' || /aborted|cancelled|canceled/i.test(String(e?.message || e || ''));
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw new DOMException('Lore generation cancelled', 'AbortError');
}

// ── Robust JSON response parsing ─────────────────────────────────────────────────

/**
 * Strips markdown code fences from text.
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function stripJsonFences(text) {
    let cleaned = String(text || '').trim();

    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) return fenceMatch[1].trim();

    return cleaned;
}

/**
 * Removes think/reasoning blocks that thinking models sometimes emit.
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function removeLikelyReasoningBlocks(text) {
    return String(text || '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
}

/**
 * Applies common JSON-ish sanitization (smart quotes, trailing commas, comments, control chars).
 * @param {string} text - Raw text
 * @returns {string} Sanitized text
 */
function sanitizeJsonish(text) {
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

/**
 * Finds the first balanced JSON object {...} in a string by tracking depth.
 * Handles nested braces, strings, and escape sequences.
 * @param {string} text - Raw text
 * @returns {string} The balanced object substring, or empty string
 */
function findBalancedJsonObject(text) {
    const s = String(text || '');
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (start === -1) {
            if (ch === '{') {
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

        if (ch === '{') depth++;
        if (ch === '}') depth--;

        if (depth === 0) {
            return s.slice(start, i + 1);
        }
    }

    return start >= 0 ? s.slice(start) : '';
}

function findBalancedJsonArray(text) {
    const s = String(text || '');
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (start === -1) {
            if (ch === '[') {
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
        if (ch === '[') depth++;
        if (ch === ']') depth--;
        if (depth === 0) return s.slice(start, i + 1);
    }

    return start >= 0 ? s.slice(start) : '';
}

/**
 * Coerces various shapes the model may return into the expected { summary, entries } structure.
 * @param {*} parsed - Already-parsed (but possibly wrong-shaped) JSON
 * @returns {Object|null} Normalized shape or null
 */
function coerceLoreShape(parsed) {
    if (Array.isArray(parsed)) {
        return { summary: '', entries: parsed };
    }
    if (!parsed || typeof parsed !== 'object') return null;

    // Already correct.
    if (Array.isArray(parsed.entries)) {
        return {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            entries: parsed.entries,
        };
    }

    // Some models return the array directly under lore/loreMatrix.
    if (Array.isArray(parsed.loreMatrix)) {
        return {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            entries: parsed.loreMatrix,
        };
    }

    if (Array.isArray(parsed.lore)) {
        return {
            summary: typeof parsed.summary === 'string' ? parsed.summary : '',
            entries: parsed.lore,
        };
    }

    // Some models return a single entry.
    if (parsed.id && (parsed.title || parsed.fact)) {
        return {
            summary: '',
            entries: [parsed],
        };
    }

    return null;
}

/**
 * Parses a JSON response from the LLM. Tolerant of markdown fences,
 * reasoning blocks, smart quotes, trailing commas, JS comments, and
 * wrong-shaped objects. Tries multiple candidate extraction strategies
 * before giving up.
 * @param {string} text - Raw LLM response
 * @returns {Object|null} Parsed JSON or null
 */
function parseJsonResponse(text) {
    const responseText = extractLoreResponseText(text);
    if (!responseText.trim()) return null;

    const candidates = [];

    const noReasoning = removeLikelyReasoningBlocks(responseText);
    candidates.push(noReasoning);
    candidates.push(stripJsonFences(noReasoning));
    if (noReasoning && !noReasoning.trim().startsWith('{') && !noReasoning.trim().startsWith('[')) {
        candidates.push('{' + noReasoning);
        candidates.push('[' + noReasoning);
    }
    candidates.push(findBalancedJsonObject(noReasoning));
    candidates.push(findBalancedJsonObject(stripJsonFences(noReasoning)));
    candidates.push(findBalancedJsonArray(noReasoning));
    candidates.push(findBalancedJsonArray(stripJsonFences(noReasoning)));

    for (const candidate of candidates) {
        if (!candidate || !candidate.trim()) continue;

        const cleaned = sanitizeJsonish(candidate);

        try {
            const parsed = JSON.parse(cleaned);
            return coerceLoreShape(parsed) || parsed;
        } catch (_) {
            // Continue trying candidates.
        }
    }

    return null;
}

/**
 * When initial bulk candidate parsing fails, sends the raw response through a
 * task-specific JSON repair pass. The repair target is candidate-fact output,
 * not the removed legacy full-lore-entry schema.
 * @param {string} rawResponse - The raw LLM response that failed parsing
 * @param {Object} [chunk={}] - Chunk metadata for candidate normalization
 * @returns {Promise<Object|null>} Parsed { chunkSummary, facts } shape, or null
 */
async function repairBulkCandidateJsonResponse(rawResponse, chunk = {}) {
    const settings = getSettings();
    if (!settings.loreRepairOnParseFail) return null;

    try {
        const repairPrompt = `Repair this malformed bulk story-lore extraction response into valid JSON.

Required shape:
{
  "chunkSummary": "string",
  "facts": [
    {
      "category": "character|relationship|item|spell|knowledge|location|faction|timeline|event|secret|rule",
      "subject": "string",
      "fact": "one atomic durable story fact",
      "priorityHint": "high|medium|low",
      "relevanceHint": "high|normal|low",
      "messageRefs": [1]
    }
  ]
}

Rules:
- Preserve every recoverable candidate fact from the malformed response.
- Do not invent facts not present in the malformed response.
- Return only the repaired JSON object. No markdown fences or commentary.

Malformed response:
${String(rawResponse || '').slice(0, 12000)}
`;

        const repaired = await quietPrompt(JSON_REPAIR_SYSTEM_PROMPT, repairPrompt);
        if (!repaired) return null;

        return parseBulkCandidateResponse(repaired, chunk);
    } catch (e) {
        console.warn(`${LOG_PREFIX} Bulk candidate JSON repair pass failed:`, e);
        return null;
    }
}


// ── Build context message ───────────────────────────────────────────────────────

/**
 * Collects recent chat messages for context detection/generation.
 * @param {number} [count=20] - Max messages to include
 * @returns {string} Formatted messages text
 */
function buildContextBriefRepairPrompt(rawResponse = '') {
    return `Repair this malformed Saga Context Brief detector response into valid JSON.

Required shape:
{
  "schemaVersion": 1,
  "summary": "one short sentence describing the current story position",
  "branchId": "main",
  "timeTravelMode": "none|visitor_from_future|past_changed|alternate_branch",
  "evidence": [
    {
      "quote": "short exact phrase from the malformed response or recent messages",
      "signal": "date|arc|episode|chapter|event|stardate|branch|uncertainty"
    }
  ],
  "signals": {
    "sceneDate": "",
    "subjectiveDate": "",
    "canonBoundary": "",
    "positionPhrases": [],
    "fandomHints": [],
    "arc": "",
    "phase": "",
    "season": "",
    "episode": "",
    "chapter": "",
    "issue": "",
    "quest": "",
    "gameStage": "",
    "stardate": "",
    "coordinates": {},
    "eventLabels": []
  },
  "uncertainty": {
    "level": "low|medium|high",
    "notes": []
  }
}

Rules:
- Preserve only recoverable Context signals from the malformed response.
- Do not invent anchors, windows, dates, episodes, chapters, stardates, or canon facts.
- Use empty strings, empty arrays, or empty objects when unknown.
- Return only the repaired JSON object. No markdown fences or commentary.

Malformed response:
${String(rawResponse || '').slice(0, 12000)}
`;
}

async function repairContextBriefJsonResponse(rawResponse = '', legacyContext = {}, options = {}) {
    const settings = getSettings();
    if (settings.loreRepairOnParseFail === false || options.repair === false) return null;

    try {
        const repaired = await quietPrompt(JSON_REPAIR_SYSTEM_PROMPT, buildContextBriefRepairPrompt(rawResponse), {
            signal: options.signal || null,
            maxTokens: options.maxTokens || 1800,
            expectedOutput: 'json',
        });
        if (!repaired) return null;
        const parsed = parseJsonResponse(repaired);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const updatedAt = Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : Date.now();
        const brief = normalizeDetectedContextBrief(parsed, legacyContext, {
            source: 'model',
            updatedAt,
            status: {
                state: 'repaired',
                message: 'Detector response repaired into Context Brief JSON.',
                repaired: true,
                rawResponsePreview: String(rawResponse || '').slice(0, 1000),
            },
        });
        return hasUsableContextBrief(brief) ? brief : null;
    } catch (e) {
        console.warn(`${LOG_PREFIX} Context Brief JSON repair pass failed:`, e);
        return null;
    }
}

function getRecentMessageObjects(count = 8) {
    try {
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        return chat.slice(-Math.max(1, Number(count) || 8));
    } catch (_) {
        return [];
    }
}

function formatMessageObjects(messages = []) {
    return messages
        .map((m, index) => {
            const name = m?.name || 'Unknown';
            const role = m?.is_user ? 'User' : m?.is_system ? 'System' : name;
            const text = String(m?.mes || m?.content || '').trim();
            return text ? `[${index + 1}] ${role}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function getRecentMessages(count = 8) {
    const formatted = formatMessageObjects(getRecentMessageObjects(count));
    return formatted || '(No messages available)';
}

function inferContextLocallyFromMessages(messages, state = getState()) {
    const text = String(messages || '');
    const result = {
        sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
        subjectiveDate: state?.loreContext?.subjectiveDate || '',
        canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
        branchId: state?.loreContext?.branchId || 'main',
        timeTravelMode: state?.loreContext?.timeTravelMode || 'none',
        summary: 'Fallback context inferred locally from message headings and current state.',
    };

    const datePatterns = [
        /(?:^|\n)\s*(?:date|day|in[- ]?universe date|scene date)\s*[:\-]\s*([^\n]+)/i,
        /(?:^|\n)\s*#{1,6}\s*([^\n]*(?:\b\d{4}\b|\bJan\.?\b|\bFeb\.?\b|\bMar\.?\b|\bApr\.?\b|\bJun\.?\b|\bJul\.?\b|\bAug\.?\b|\bSep\.?\b|\bSept\.?\b|\bOct\.?\b|\bNov\.?\b|\bDec\.?\b|\bJanuary\b|\bFebruary\b|\bMarch\b|\bApril\b|\bMay\b|\bJune\b|\bJuly\b|\bAugust\b|\bSeptember\b|\bOctober\b|\bNovember\b|\bDecember\b)[^\n]*)/i,
        /\b((?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\.?\s*,?\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s+\d{4})\b/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
    ];
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            result.sceneDate = match[1].replace(/^#+\s*/, '').trim();
            break;
        }
    }

    const canonMatch = text.match(/(?:canon|boundary|canon reference|reference point)\s*[:\-]\s*([^\n]+)/i);
    if (canonMatch?.[1]) {
        result.canonBoundary = canonMatch[1].trim();
    }

    const branchMatch = text.match(/(?:branch|timeline|au)\s*[:\-]\s*([^\n]+)/i);
    if (branchMatch?.[1]) {
        result.branchId = branchMatch[1].trim() || 'main';
    }

    const tt = text.match(/\b(time travel|from the future|alternate timeline|changed past|branch)\b/i);
    if (tt) {
        result.timeTravelMode = /future/i.test(tt[0]) ? 'visitor_from_future' : 'alternate_branch';
    }

    const normalized = normalizeLoreContext(result);
    return normalized.sceneDate || normalized.canonBoundary || normalized.branchId !== 'main' ? normalized : null;
}

function asPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanBriefString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function pushBriefString(list, value, limit = 12, maxLength = 180) {
    const text = cleanBriefString(value, maxLength);
    if (!text) return;
    const key = text.toLowerCase();
    if (list.some(item => String(item || '').toLowerCase() === key)) return;
    if (list.length < limit) list.push(text);
}

function addLocalEvidence(evidence, quote, signal) {
    const cleanQuote = cleanBriefString(quote, 280);
    const cleanSignal = cleanBriefString(signal, 80);
    if (!cleanQuote && !cleanSignal) return;
    const key = `${cleanSignal.toLowerCase()}::${cleanQuote.toLowerCase()}`;
    if (evidence.some(item => `${item.signal.toLowerCase()}::${item.quote.toLowerCase()}` === key)) return;
    if (evidence.length < 12) evidence.push({ quote: cleanQuote, signal: cleanSignal });
}

function normalizeLocalTitle(value = '') {
    return cleanBriefString(String(value || '')
        .replace(/^#+\s*/, '')
        .replace(/\s+/g, ' ')
        .replace(/[.;,!?]+$/g, '')
        .trim(), 180);
}

function inferContextBriefLocallyFromMessages(messages, state = getState(), options = {}) {
    const text = String(messages || '');
    const signals = {
        sceneDate: '',
        subjectiveDate: '',
        canonBoundary: '',
        positionPhrases: [],
        fandomHints: [],
        arc: '',
        phase: '',
        season: '',
        episode: '',
        chapter: '',
        issue: '',
        quest: '',
        gameStage: '',
        stardate: '',
        coordinates: {},
        eventLabels: [],
    };
    const evidence = [];
    let explicitSignals = 0;

    const record = (quote, signal) => {
        explicitSignals += 1;
        addLocalEvidence(evidence, quote, signal);
    };

    const datePatterns = [
        /(?:^|\n)\s*(?:date|day|in[- ]?universe date|scene date)\s*[:\-]\s*([^\n]+)/i,
        /(?:^|\n)\s*#{1,6}\s*([^\n]*(?:\b\d{4}\b|\bJan\.?\b|\bFeb\.?\b|\bMar\.?\b|\bApr\.?\b|\bJun\.?\b|\bJul\.?\b|\bAug\.?\b|\bSep\.?\b|\bSept\.?\b|\bOct\.?\b|\bNov\.?\b|\bDec\.?\b|\bJanuary\b|\bFebruary\b|\bMarch\b|\bApril\b|\bMay\b|\bJune\b|\bJuly\b|\bAugust\b|\bSeptember\b|\bOctober\b|\bNovember\b|\bDecember\b)[^\n]*)/i,
        /\b((?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\.?\s*,?\s*(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s+\d{4})\b/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,
    ];
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match?.[1]) {
            signals.sceneDate = normalizeLocalTitle(match[1]);
            record(match[0], 'date');
            break;
        }
    }

    const canonMatch = text.match(/(?:canon|boundary|canon reference|reference point)\s*[:\-]\s*([^\n]+)/i);
    if (canonMatch?.[1]) {
        signals.canonBoundary = normalizeLocalTitle(canonMatch[1]);
        pushBriefString(signals.positionPhrases, signals.canonBoundary, 16, 180);
        record(canonMatch[0], 'event');
    }

    const stardateMatch = text.match(/\bstardate\s*[:#]?\s*(-?\d+(?:\.\d+)?)/i);
    if (stardateMatch?.[1]) {
        signals.stardate = stardateMatch[1];
        record(stardateMatch[0], 'stardate');
    }

    const seasonEpisodePatterns = [
        /\bS(?:eason)?\s*0?(\d{1,2})\s*E(?:p(?:isode)?\.?)?\s*0?(\d{1,3})\b\s*[:\-]?\s*([A-Z][^\n.;,!?]{1,80})?/i,
        /\bseason\s+0?(\d{1,2})\s*(?:,|\-|:)?\s*(?:episode|ep\.?)\s+0?(\d{1,3})\b\s*[:\-]?\s*([A-Z][^\n.;,!?]{1,80})?/i,
    ];
    for (const pattern of seasonEpisodePatterns) {
        const match = text.match(pattern);
        if (!match) continue;
        signals.season = match[1];
        signals.episode = match[2];
        const label = normalizeLocalTitle(match[3]);
        if (label) pushBriefString(signals.eventLabels, label, 24, 180);
        record(match[0], 'episode');
        break;
    }
    if (!signals.season) {
        const seasonMatch = text.match(/\bseason\s+0?(\d{1,2})\b/i);
        if (seasonMatch?.[1]) {
            signals.season = seasonMatch[1];
            record(seasonMatch[0], 'episode');
        }
    }
    if (!signals.episode) {
        const episodeMatch = text.match(/\b(?:episode|ep\.?)\s+0?(\d{1,3}|[A-Z][^\n.;,!?]{1,80})/i);
        if (episodeMatch?.[1]) {
            signals.episode = normalizeLocalTitle(episodeMatch[1]);
            record(episodeMatch[0], 'episode');
        }
    }

    const chapterMatch = text.match(/\b(?:chapter|chapters|ch\.?)\s*[:#]?\s*(\d+(?:\s*(?:-|to|through)\s*\d+)?|[A-Z][^\n.;,!?]{1,80})/i);
    if (chapterMatch?.[1]) {
        signals.chapter = normalizeLocalTitle(chapterMatch[1]);
        record(chapterMatch[0], 'chapter');
    }

    const issueMatch = text.match(/\b(?:issue|issues)\s*[:#]?\s*(\d+(?:\s*(?:-|to|through)\s*\d+)?|[A-Z][^\n.;,!?]{1,80})/i);
    if (issueMatch?.[1]) {
        signals.issue = normalizeLocalTitle(issueMatch[1]);
        record(issueMatch[0], 'issue');
    }

    const explicitArc = text.match(/(?:^|\n|\b)(?:arc|run|film|movie)\s*[:\-]\s*([^\n.;!?]+)/i);
    const namedArc = text.match(/\b(?:during|in|inside|within)\s+the\s+([A-Z][A-Za-z0-9'’:\- ]{2,80}?)\s+(?:arc|saga|run|film|movie)\b/i)
        || text.match(/\b([A-Z][A-Za-z0-9'’:\- ]{2,80}?)\s+(?:arc|saga|run|film|movie)\b/i);
    const arcValue = explicitArc?.[1] || namedArc?.[1] || '';
    if (arcValue) {
        signals.arc = normalizeLocalTitle(arcValue);
        record((explicitArc || namedArc)?.[0], 'arc');
    }

    const phaseMatch = text.match(/(?:^|\n|\b)(?:phase|sub[- ]arc|stage)\s*[:\-]\s*([^\n.;!?]+)/i);
    if (phaseMatch?.[1]) {
        signals.phase = normalizeLocalTitle(phaseMatch[1]);
        record(phaseMatch[0], 'arc');
    }

    const questMatch = text.match(/(?:^|\n|\b)(?:quest|mission)\s*[:\-]\s*([^\n.;!?]+)/i);
    if (questMatch?.[1]) {
        signals.quest = normalizeLocalTitle(questMatch[1]);
        record(questMatch[0], 'quest');
    }

    const gameStageMatch = text.match(/(?:^|\n|\b)(?:game stage|act|route)\s*[:\-]\s*([^\n.;!?]+)/i);
    if (gameStageMatch?.[1]) {
        signals.gameStage = normalizeLocalTitle(gameStageMatch[1]);
        record(gameStageMatch[0], 'gameStage');
    }

    const coordinatePattern = /\b(series|saga|island|location|route|faction|era|book|film|run)\s*[:\-]\s*([^\n.;!?]+)/gi;
    for (const match of text.matchAll(coordinatePattern)) {
        const axis = cleanBriefString(match[1].toLowerCase(), 80);
        const value = normalizeLocalTitle(match[2]);
        if (axis && value && Object.keys(signals.coordinates).length < 12) {
            signals.coordinates[axis] = value;
            record(match[0], 'event');
        }
    }

    const knownSeries = [
        ['tng', /\b(?:TNG|Star Trek:\s*The Next Generation)\b/i],
        ['voy', /\b(?:VOY|Star Trek:\s*Voyager)\b/i],
        ['ds9', /\b(?:DS9|Star Trek:\s*Deep Space Nine)\b/i],
        ['one piece', /\bOne Piece\b/i],
        ['harry potter', /\b(?:Harry Potter|Hogwarts)\b/i],
    ];
    for (const [hint, pattern] of knownSeries) {
        const match = text.match(pattern);
        if (!match) continue;
        pushBriefString(signals.fandomHints, hint, 16, 140);
        if (!signals.coordinates.series && ['tng', 'voy', 'ds9'].includes(hint)) signals.coordinates.series = hint;
        record(match[0], 'event');
    }

    const relativePattern = /\b((?:right\s+|just\s+)?(?:before|after|during|following|prior to)\s+[^.\n!?]{3,140})/gi;
    for (const match of text.matchAll(relativePattern)) {
        const phrase = normalizeLocalTitle(match[1]);
        if (!phrase) continue;
        pushBriefString(signals.positionPhrases, phrase, 16, 180);
        pushBriefString(signals.eventLabels, phrase.replace(/^(?:right\s+|just\s+)?(?:before|after|during|following|prior to)\s+/i, ''), 24, 180);
        record(match[0], 'event');
        if (signals.positionPhrases.length >= 4) break;
    }

    const previous = state?.loreContext || {};
    if (!explicitSignals && (previous.sceneDate || previous.canonBoundary || previous.branchId && previous.branchId !== 'main')) {
        return buildContextBriefFromLoreContext(previous, {
            source: 'local',
            updatedAt: Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : Date.now(),
            note: options.note || 'No new local Context signals found; preserving previous known Context.',
        });
    }
    if (!explicitSignals) return null;

    const branchMatch = text.match(/(?:branch|timeline|au)\s*[:\-]\s*([^\n]+)/i);
    const branchId = normalizeLocalTitle(branchMatch?.[1]) || previous.branchId || 'main';
    const tt = text.match(/\b(time travel|from the future|alternate timeline|changed past|branch)\b/i);
    const timeTravelMode = tt
        ? (/future/i.test(tt[0]) ? 'visitor_from_future' : 'alternate_branch')
        : (previous.timeTravelMode || 'none');

    const summaryParts = [
        signals.sceneDate,
        signals.stardate ? `Stardate ${signals.stardate}` : '',
        signals.arc,
        signals.season && signals.episode ? `S${signals.season}E${signals.episode}` : (signals.season ? `Season ${signals.season}` : ''),
        signals.chapter ? `Chapter ${signals.chapter}` : '',
        signals.issue ? `Issue ${signals.issue}` : '',
        signals.quest,
        signals.gameStage,
        signals.positionPhrases[0],
    ].filter(Boolean);

    return normalizeContextBrief({
        schemaVersion: 1,
        summary: summaryParts.length ? `Local Context signals: ${summaryParts.join('; ')}.` : 'Local Context Brief inferred from explicit story-position phrases.',
        branchId,
        timeTravelMode,
        evidence,
        signals,
        uncertainty: {
            level: explicitSignals >= 3 ? 'medium' : 'high',
            notes: [options.note || 'Deterministic local fallback; review if the story position is ambiguous.'],
        },
        status: {
            state: 'fallback',
            message: 'Deterministic local fallback produced a Context Brief.',
            fallbackUsed: true,
        },
        source: 'local_alias',
        updatedAt: Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : Date.now(),
    }, {});
}

function mergeBriefSignals(rawSignals = {}, raw = {}) {
    const signals = asPlainObject(rawSignals);
    const source = asPlainObject(raw);
    return {
        ...signals,
        sceneDate: signals.sceneDate ?? source.sceneDate,
        subjectiveDate: signals.subjectiveDate ?? source.subjectiveDate,
        canonBoundary: signals.canonBoundary ?? source.canonBoundary,
        positionPhrases: signals.positionPhrases ?? source.positionPhrases,
        fandomHints: signals.fandomHints ?? source.fandomHints,
        arc: signals.arc ?? source.arc,
        phase: signals.phase ?? source.phase,
        season: signals.season ?? source.season,
        episode: signals.episode ?? source.episode,
        chapter: signals.chapter ?? source.chapter,
        issue: signals.issue ?? source.issue,
        quest: signals.quest ?? source.quest,
        gameStage: signals.gameStage ?? source.gameStage,
        stardate: signals.stardate ?? source.stardate,
        coordinates: signals.coordinates ?? source.coordinates,
        eventLabels: signals.eventLabels ?? source.eventLabels,
    };
}

function normalizeDetectedContextBrief(rawDetection = {}, legacyContext = {}, options = {}) {
    const raw = asPlainObject(rawDetection);
    const embedded = asPlainObject(raw.contextBrief || raw.brief);
    const source = Object.keys(embedded).length ? embedded : raw;
    const rawUncertainty = asPlainObject(source.uncertainty || raw.uncertainty);
    return normalizeContextBrief({
        ...source,
        summary: source.summary ?? raw.summary,
        branchId: source.branchId ?? raw.branchId ?? legacyContext?.branchId,
        timeTravelMode: source.timeTravelMode ?? raw.timeTravelMode ?? legacyContext?.timeTravelMode,
        evidence: source.evidence ?? raw.evidence,
        signals: mergeBriefSignals(source.signals || raw.signals, raw),
        uncertainty: {
            ...rawUncertainty,
            level: rawUncertainty.level ?? raw.uncertaintyLevel,
            notes: rawUncertainty.notes ?? raw.uncertaintyNotes,
        },
        status: options.status || source.status || raw.status || {
            state: options.source === 'model' ? 'detected' : 'idle',
            message: options.source === 'model' ? 'Detector returned Context Brief JSON.' : '',
        },
        source: options.source || source.source || raw.source || 'unknown',
        updatedAt: Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : (Number(source.updatedAt) || Date.now()),
    }, {});
}

function buildLoreContextFromContextBrief(brief = {}, previousContext = {}) {
    const normalizedBrief = normalizeContextBrief(brief || {}, {});
    const signals = normalizedBrief.signals || {};
    return normalizeLoreContext({
        sceneDate: signals.sceneDate || '',
        subjectiveDate: signals.subjectiveDate || '',
        canonBoundary: signals.canonBoundary || '',
        branchId: normalizedBrief.branchId || previousContext?.branchId || 'main',
        timeTravelMode: normalizedBrief.timeTravelMode || previousContext?.timeTravelMode || 'none',
        lastDetectedAt: normalizedBrief.updatedAt || Date.now(),
        lastGeneratedFor: previousContext?.lastGeneratedFor || '',
        lastGenerationSummary: previousContext?.lastGenerationSummary || '',
    });
}

function buildContextBriefFromLoreContext(context = {}, options = {}) {
    const normalized = normalizeLoreContext(context || {});
    return normalizeContextBrief({
        schemaVersion: 1,
        summary: options.summary || normalized.canonBoundary || normalized.sceneDate || 'Fallback context inferred locally from message headings and current state.',
        branchId: normalized.branchId || 'main',
        timeTravelMode: normalized.timeTravelMode || 'none',
        evidence: [],
        signals: {
            sceneDate: normalized.sceneDate || '',
            subjectiveDate: normalized.subjectiveDate || '',
            canonBoundary: normalized.canonBoundary || '',
            positionPhrases: normalized.canonBoundary ? [normalized.canonBoundary] : [],
        },
        uncertainty: {
            level: normalized.sceneDate || normalized.canonBoundary ? 'medium' : 'high',
            notes: options.note ? [options.note] : [],
        },
        status: {
            state: 'fallback',
            message: 'Legacy local fallback projected existing loreContext into Context Brief.',
            fallbackUsed: true,
        },
        source: options.source || 'local_alias',
        updatedAt: Number.isFinite(Number(options.updatedAt)) ? Number(options.updatedAt) : Date.now(),
    }, normalized);
}


async function maybeProposeCanonLoreFromContext(context, progress = null) {
    const settings = getSettings();
    if (settings.canonLoreDatabaseEnabled === false || settings.canonLoreAutoPropose === false) {
        return null;
    }

    try {
        progress?.('Checking local canon lore database...', 88);
        return await proposeCanonLoreForContext(context, {
            progress,
            maxEntries: settings.canonLoreMaxEntries || 12,
        });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Local canon lore database query failed:`, e);
        progress?.(`Canon lore database query failed: ${e.message || e}`, 100);
        return { status: 'failed', error: e.message || String(e) };
    }
}

function formatCanonProposalSuffix(result) {
    if (!result) return '';
    if (result.status === 'proposed') return ` Local canon database proposed ${result.proposedCount || 0} Pending Review entries.`;
    if (result.status === 'duplicates_only') return ' Local canon database found matches, but they were already present or similar.';
    if (result.status === 'no_date') return ' Local canon database skipped: no parseable canon date.';
    if (result.status === 'empty') return ' Local canon database found no entries for this date/context.';
    if (result.status === 'disabled') return '';
    if (result.status === 'failed') return ` Local canon database failed: ${result.error || 'unknown error'}.`;
    return '';
}

function getContextFallbackCharacterThreshold(settings = getSettings()) {
    const configured = Number(settings.contextModelFallbackMinCharacters);
    return Math.max(0, Math.min(20000, Number.isFinite(configured) ? configured : 1200));
}

function getContextConfidenceSetting(settings = getSettings(), key = '', fallback = 0) {
    const configured = Number(settings?.[key]);
    return Math.max(0, Math.min(1, Number.isFinite(configured) ? configured : fallback));
}

function shouldRunContextModelFallback(sourceText = '', options = {}, settings = getSettings()) {
    if (options.modelFallback === false) return false;
    if (options.forceModelFallback === true || options.explicit === true) return true;
    if (settings.contextReasonerFallbackEnabled === false) return false;
    const threshold = getContextFallbackCharacterThreshold(settings);
    return String(sourceText || '').trim().length >= threshold;
}

function storeContextResolutionProposals(result = null, context = {}, sourceText = '') {
    const state = getState();
    if (!state?.lorePanel) return;
    state.lorePanel.contextResolutionAudit = buildContextResolutionAudit(result || {}, context || {}, {
        source: 'automatic_context_detection',
        sourceText,
    });
    if (result?.cacheRecord) {
        state.lorePanel.contextResolutionCache = result.cacheRecord;
    }
    if (result?.status === 'in_flight') {
        saveState(state, { syncPrompt: false });
        return;
    }
    const proposals = Array.isArray(result?.proposals) ? result.proposals : [];
    if (!proposals.length) {
        if (Array.isArray(state.lorePanel.contextResolutionProposals) && state.lorePanel.contextResolutionProposals.length) {
            state.lorePanel.contextResolutionProposals = [];
            saveState(state, { syncPrompt: false });
        } else {
            saveState(state, { syncPrompt: false });
        }
        return;
    }
    state.lorePanel.contextResolutionProposals = proposals.map(proposal => ({
        packId: String(proposal.packId || '').trim(),
        candidateId: String(proposal.candidateId || '').trim(),
        candidateType: String(proposal.candidateType || '').trim(),
        label: String(proposal.label || '').trim().slice(0, 240),
        summary: String(proposal.summary || '').trim().slice(0, 500),
        confidence: Number.isFinite(Number(proposal.confidence)) ? Math.max(0, Math.min(1, Number(proposal.confidence))) : 0,
        patch: proposal.patch && typeof proposal.patch === 'object' && !Array.isArray(proposal.patch) ? { ...proposal.patch } : {},
    })).filter(proposal => proposal.packId && proposal.patch && Object.keys(proposal.patch).length);
    state.lorePanel.contextResolutionProposalMeta = {
        createdAt: Date.now(),
        source: 'reasoner_context_resolution',
        sourceCharacters: String(sourceText || '').length,
        contextLabel: context.label || context.canonBoundary || context.sceneDate || '',
        cached: result?.cached === true,
    };
    saveState(state, { syncPrompt: false });
}

async function maybeResolveContextsFromContext(context, options = {}) {
    try {
        const settings = getSettings();
        const progress = typeof options.progress === 'function' ? options.progress : null;
        progress?.('Resolving Loredeck Context...', 82);
        const local = await resolveAndApplyContextsFromContext(context, {
            contextSource: options.contextSource || 'local_alias',
            sourceText: options.sourceText || '',
            minLocalConfidence: getContextConfidenceSetting(settings, 'contextLocalApplyMinConfidence', 0.78),
        });
        if (local.unresolvedCount && settings.contextReasonerFallbackEnabled === false) {
            const skipped = {
                ...local,
                status: 'skipped',
                reason: 'context_reasoner_fallback_disabled',
                message: 'Reasoner fallback is disabled; unresolved Loredeck Context rows were left unchanged.',
                local,
                appliedCount: local.appliedCount || 0,
                localAppliedCount: local.appliedCount || 0,
                skippedCount: Math.max(1, Number(local.skippedCount || 0) + Number(local.unresolvedCount || 0)),
                targetPackIds: (local.results || [])
                    .filter(result => result.status === 'unresolved')
                    .map(result => result.packId)
                    .filter(Boolean),
            };
            storeContextResolutionProposals(skipped, context, options.sourceText || '');
            return skipped;
        }
        if (!local.unresolvedCount || !shouldRunContextModelFallback(options.sourceText || '', options, settings)) {
            storeContextResolutionProposals(local, context, options.sourceText || '');
            return local;
        }
        progress?.('Asking Reasoner for bounded Context proposals...', 86);
        const model = await resolveContextsWithModel(context, {
            contextSource: options.contextSource || 'model',
            sourceText: options.sourceText || '',
            applyLocal: false,
            applyModel: false,
            minLocalConfidence: getContextConfidenceSetting(settings, 'contextLocalApplyMinConfidence', 0.78),
            minConfidence: getContextConfidenceSetting(settings, 'contextReasonerProposalMinConfidence', 0.55),
            resolutionCache: getState()?.lorePanel?.contextResolutionCache || null,
        });
        const merged = {
            ...model,
            local,
            appliedCount: local.appliedCount || 0,
            localAppliedCount: local.appliedCount || 0,
        };
        storeContextResolutionProposals(merged, context, options.sourceText || '');
        return merged;
    } catch (e) {
        console.warn(`${LOG_PREFIX} Context resolver failed:`, e);
        return { status: 'failed', error: e?.message || String(e || '') };
    }
}

function formatContextResolutionSuffix(result) {
    if (!result || result.status === 'failed') return '';
    if (result.appliedCount > 0) return ` Context resolved for ${result.appliedCount} Loredeck${result.appliedCount === 1 ? '' : 's'}.`;
    if (result.proposalCount > 0) return ` Reasoner drafted ${result.proposalCount} Context proposal${result.proposalCount === 1 ? '' : 's'} for review.`;
    if (result.resolvedCount > 0) return ' Context already matched the current context.';
    if (result.skippedCount > 0 && !result.unresolvedCount) return ' Context resolver skipped locked Loredecks.';
    return '';
}

// ── Lore Context Detection ──────────────────────────────────────────────────────

function hasUsableContextBrief(brief = {}) {
    const normalized = normalizeContextBrief(brief || {});
    const signals = normalized.signals || {};
    return Boolean(
        normalized.summary
        || normalized.evidence?.length
        || Object.values(signals).some(value => {
            if (Array.isArray(value)) return value.length > 0;
            if (value && typeof value === 'object') return Object.keys(value).length > 0;
            return String(value || '').trim();
        })
    );
}

async function saveContextBriefAndResolve(brief, messages, options = {}) {
    const progress = typeof options.progress === 'function' ? options.progress : null;
    const state = getState();
    const loreContext = buildLoreContextFromContextBrief(brief, state?.loreContext || {});
    setContextBrief(brief, { save: false });
    setLoreContext(loreContext);
    const savedState = getState();
    const resolverContext = buildResolverContextFromContextBrief(brief, savedState?.loreContext || loreContext);
    const positionResult = await maybeResolveContextsFromContext(resolverContext, {
        contextSource: options.contextSource || 'model',
        sourceText: messages,
        progress,
    });
    const canonResult = await maybeProposeCanonLoreFromContext(savedState?.loreContext || loreContext, progress);
    return {
        loreContext: savedState?.loreContext || loreContext,
        contextBrief: normalizeContextBrief(brief, savedState?.loreContext || loreContext),
        resolverContext,
        positionResult,
        canonResult,
    };
}

function recordContextBriefStatus(statusPatch = {}, state = getState()) {
    const previous = asPlainObject(state?.contextBrief);
    setContextBrief({
        ...previous,
        status: {
            ...(previous.status || {}),
            ...statusPatch,
        },
        updatedAt: Date.now(),
    });
}

/**
 * Runs lore context detection via LLM.
 * Guarded by _detectionRunning to prevent concurrent calls.
 * The result is written to Context Brief state plus the legacy loreContext projection.
 * @returns {Promise<Object|null>} Detected resolver context or null on failure
 */
export async function runLoreContextDetection(options = {}) {
    if (_detectionRunning) {
        console.debug(`${LOG_PREFIX} Lore context detection already running, skipping`);
        return null;
    }

    _detectionRunning = true;
    try {
        const signal = options.signal || null;
        throwIfAborted(signal);
        const state = getState();
        const settings = getSettings();
        const progress = typeof options.progress === 'function' ? options.progress : null;
        progress?.('Reading recent messages...', 10);
        const messageCount = settings.contextSourceMessageCount || settings.loreSourceMessageCount || 20;
        const messageObjects = getRecentMessageObjects(messageCount);

        const validation = validateLoreProviderConfiguration();
        if (!validation.ok) {
            progress?.(`API/model settings incomplete: ${validation.message}`, 100);
            return null;
        }

        if (!settings.debugMode) {
            // In non-debug, only run if not already detected recently
        }

        const stateSummary = JSON.stringify({
            canon: state.canon,
            scene: state.scene,
            loreContext: state.loreContext,
            contextBrief: state.contextBrief,
        }, null, 0);

        const messages = formatMessageObjects(messageObjects) || '(No messages available)';
        progress?.('Sending context detection request...', 35);
        const userMessage = `Current state: ${stateSummary}\n\nRecent messages:\n${messages}\n\nExtract the current Context Brief. Output ONLY a valid JSON object with no markdown fences, no commentary, no explanations:`;

        const response = await quietPrompt(LORE_CONTEXT_DETECTION_SYSTEM_PROMPT, userMessage, { signal });
        if (!response) {
            const fallbackBrief = inferContextBriefLocallyFromMessages(messages, state, {
                updatedAt: Date.now(),
                note: 'Model returned no response; deterministic local fallback used recent message signals.',
            });
            if (fallbackBrief) {
                const saved = await saveContextBriefAndResolve(fallbackBrief, messages, {
                    contextSource: 'local_alias',
                    progress,
                });
                const positionResult = saved.positionResult;
                const canonResult = saved.canonResult;
                progress?.(`Context inferred locally from message headings.${formatContextResolutionSuffix(positionResult)}${formatCanonProposalSuffix(canonResult)}`, 100);
                return saved.resolverContext;
            }
            const fallback = inferContextLocallyFromMessages(messages, state);
            if (fallback) {
                const savedFallback = { ...fallback, lastDetectedAt: Date.now() };
                const legacyBrief = buildContextBriefFromLoreContext(savedFallback, {
                    source: 'local_alias',
                    updatedAt: savedFallback.lastDetectedAt,
                    note: 'Model returned no response; legacy local fallback used current headings/state only.',
                });
                const saved = await saveContextBriefAndResolve(legacyBrief, messages, {
                    contextSource: 'local_alias',
                    progress,
                });
                progress?.(`Context inferred locally from message headings.${formatContextResolutionSuffix(saved.positionResult)}${formatCanonProposalSuffix(saved.canonResult)}`, 100);
                return saved.resolverContext;
            }
            recordContextBriefStatus({
                state: 'empty',
                message: 'Context detector returned no response and local fallback found no signals.',
                fallbackUsed: false,
            }, state);
            progress?.('Context detection returned no response.', 100);
            return null;
        }

        progress?.('Parsing detected context...', 75);
        const parsed = parseJsonResponse(response);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            console.warn(`${LOG_PREFIX} Could not parse lore context detection response`);
            progress?.('Repairing malformed context response...', 78);
            const repairedBrief = await repairContextBriefJsonResponse(response, state?.loreContext || {}, {
                signal,
                updatedAt: Date.now(),
            });
            if (repairedBrief) {
                const saved = await saveContextBriefAndResolve(repairedBrief, messages, {
                    contextSource: 'model',
                    progress,
                });
                const positionResult = saved.positionResult;
                const canonResult = saved.canonResult;
                progress?.(`Context response repaired.${formatContextResolutionSuffix(positionResult)}${formatCanonProposalSuffix(canonResult)}`, 100);
                return saved.resolverContext;
            }
            const fallbackBrief = inferContextBriefLocallyFromMessages(messages, state, {
                updatedAt: Date.now(),
                note: 'Model response could not be parsed; deterministic local fallback used recent message signals.',
            });
            if (fallbackBrief) {
                const saved = await saveContextBriefAndResolve(fallbackBrief, messages, {
                    contextSource: 'local_alias',
                    progress,
                });
                const positionResult = saved.positionResult;
                const canonResult = saved.canonResult;
                progress?.(`Context inferred locally from message headings.${formatContextResolutionSuffix(positionResult)}${formatCanonProposalSuffix(canonResult)}`, 100);
                return saved.resolverContext;
            }
            const fallback = inferContextLocallyFromMessages(messages, state);
            if (fallback) {
                const savedFallback = { ...fallback, lastDetectedAt: Date.now() };
                const legacyBrief = buildContextBriefFromLoreContext(savedFallback, {
                    source: 'local_alias',
                    updatedAt: savedFallback.lastDetectedAt,
                    note: 'Model response could not be parsed; legacy local fallback used current headings/state only.',
                });
                const saved = await saveContextBriefAndResolve(legacyBrief, messages, {
                    contextSource: 'local_alias',
                    progress,
                });
                progress?.(`Context inferred locally from message headings.${formatContextResolutionSuffix(saved.positionResult)}${formatCanonProposalSuffix(saved.canonResult)}`, 100);
                return saved.resolverContext;
            }
            recordContextBriefStatus({
                state: 'failed',
                message: 'Context detector returned malformed JSON; repair and local fallback found no usable signals.',
                error: 'parse_failed',
                rawResponsePreview: String(response || '').slice(0, 1000),
            }, state);
            progress?.('Context detection returned no usable result.', 100);
            return null;
        }

        const detectedAt = Date.now();
        const contextBrief = normalizeDetectedContextBrief(parsed, state?.loreContext || {}, {
            source: 'model',
            updatedAt: detectedAt,
        });
        if (!hasUsableContextBrief(contextBrief)) {
            recordContextBriefStatus({
                state: 'empty',
                message: 'Context detector returned valid JSON without usable Context signals.',
                rawResponsePreview: String(response || '').slice(0, 1000),
            }, state);
            progress?.('Context detection returned no usable signals.', 100);
            return null;
        }
        const saved = await saveContextBriefAndResolve(contextBrief, messages, {
            contextSource: 'model',
            progress,
        });
        const normalized = saved.loreContext;
        const positionResult = saved.positionResult;
        const canonResult = saved.canonResult;
        progress?.(`Context detection complete.${formatContextResolutionSuffix(positionResult)}${formatCanonProposalSuffix(canonResult)}`, 100);

        if (settings.debugMode) {
            console.log(`${LOG_PREFIX} Context Brief detected:`, saved.contextBrief);
        }

        return saved.resolverContext;
    } catch (e) {
        console.error(`${LOG_PREFIX} Lore context detection failed:`, e);
        const progress = typeof options.progress === 'function' ? options.progress : null;
        if (!isAbortError(e)) {
            recordContextBriefStatus({
                state: 'failed',
                message: 'Context detection failed before a usable Context Brief could be saved.',
                error: e?.message || String(e || ''),
            });
        }
        progress?.(`Context detection failed: ${e.message || e}`, 100);
        return null;
    } finally {
        _detectionRunning = false;
    }
}


function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function entrySourceText(entry = {}) {
    const source = entry?.source;
    const sourceInfo = entry?.sourceInfo || {};
    if (typeof source === 'string') return source;
    if (source && typeof source === 'object') {
        return [source.id, source.work, source.book, source.chapter, source.notes].filter(Boolean).join(' ');
    }
    return [sourceInfo.id, sourceInfo.work, sourceInfo.book, sourceInfo.chapter, sourceInfo.notes].filter(Boolean).join(' ');
}

function isAcceptedStoryLoreEntry(entry = {}) {
    const e = entry || {};
    const source = entrySourceText(e).toLowerCase();
    const canonStatus = String(e.canonStatus || '').toLowerCase();
    const category = String(e.category || '').toLowerCase();
    if (/model-generated|story-generation|lore-generator|manual|user|au|divergent/.test(source)) return true;
    if (['au', 'divergent', 'fanon', 'contested', 'unknown'].includes(canonStatus)) return true;
    if (['relationship', 'character', 'item', 'knowledge', 'place', 'faction', 'spell', 'artifact', 'behavior', 'skill', 'secret', 'timeline', 'event'].includes(category) && canonStatus !== 'canon') return true;
    return false;
}

function countAcceptedStoryLore(entries = []) {
    return normalizeLoreMatrix(entries).filter(isAcceptedStoryLoreEntry).length;
}

function determineLoreGenerationProfile(settings, state, { force = false, sourceCount = 40, chunkCount = 1 } = {}) {
    const configured = String(settings.loreGenerationBreadthMode || 'auto').toLowerCase();
    const storyLoreCount = countAcceptedStoryLore(state?.loreMatrix || []);
    const bootstrapThreshold = clampInt(settings.loreBootstrapStoryLoreThreshold, 0, 100, 12);
    const autoBootstrap = configured === 'auto' && force && storyLoreCount < bootstrapThreshold;
    const mode = configured === 'bootstrap' || autoBootstrap ? 'bootstrap' : 'incremental';
    const targetTotal = mode === 'bootstrap'
        ? clampInt(settings.loreBootstrapTargetEntries, 12, 120, 40)
        : clampInt(settings.loreIncrementalTargetEntries, 3, 30, 8);
    const safeChunkCount = Math.max(1, Number(chunkCount) || 1);
    const perChunkTarget = mode === 'bootstrap'
        ? clampInt(Math.ceil(targetTotal / safeChunkCount), 6, 20, 10)
        : clampInt(Math.ceil(targetTotal / safeChunkCount), 1, 8, 3);
    const perChunkMin = mode === 'bootstrap'
        ? Math.max(4, Math.min(perChunkTarget, Math.floor(perChunkTarget * 0.7)))
        : Math.max(1, Math.min(perChunkTarget, Math.floor(perChunkTarget * 0.6)));
    const perChunkMax = mode === 'bootstrap'
        ? Math.max(perChunkTarget + 2, Math.min(24, perChunkTarget + 6))
        : Math.max(perChunkTarget + 1, Math.min(10, perChunkTarget + 3));

    return {
        mode,
        configuredMode: configured,
        autoBootstrap,
        storyLoreCount,
        bootstrapThreshold,
        sourceCount,
        chunkCount: safeChunkCount,
        targetTotal,
        perChunkTarget,
        perChunkMin,
        perChunkMax,
        maxTokens: clampInt(settings.loreMaxTokens, 1024, 16384, 8192),
    };
}



// ── Bulk Lore Scan Helpers ──────────────────────────────────────────────────────

function getAllMessageObjects() {
    try {
        const ctx = SillyTavern.getContext();
        const chat = ctx?.chat || [];
        return Array.isArray(chat) ? chat : [];
    } catch (_) {
        return [];
    }
}

function stableStringHash(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeScanMessage(message, zeroIndex = 0) {
    const text = String(message?.mes || message?.content || '').trim();
    const name = String(message?.name || (message?.is_user ? 'User' : message?.is_system ? 'System' : 'Unknown')).trim() || 'Unknown';
    const role = message?.is_user ? 'user' : message?.is_system ? 'system' : 'character';
    const fallbackId = stableStringHash(`${zeroIndex + 1}|${name}|${role}|${text}`);
    const id = String(message?.extra?.id || message?.id || message?.swipe_id || fallbackId);
    const hash = stableStringHash(`${id}|${name}|${role}|${text}`);
    return {
        index: zeroIndex + 1,
        zeroIndex,
        id,
        role,
        speaker: name,
        text,
        hash,
    };
}

function formatScanMessages(messages = []) {
    return messages
        .filter(m => String(m?.text || '').trim())
        .map(m => `[${m.index}] ${m.speaker || m.role || 'Unknown'}: ${m.text}`)
        .join('\n\n');
}

function compactLoreIndexLine(entry = {}, prefix = 'accepted') {
    const scope = entry.scope || {};
    const subjects = [
        ...(Array.isArray(scope.characters) ? scope.characters : []),
        ...(Array.isArray(scope.objects) ? scope.objects : []),
        ...(Array.isArray(scope.spells) ? scope.spells : []),
        ...(Array.isArray(scope.locations) ? scope.locations : []),
    ].slice(0, 4).join(', ');
    const fact = String(entry.content?.fact || entry.fact || '').replace(/\s+/g, ' ').slice(0, 180);
    return `- [${prefix}] ${entry.id || ''} | ${entry.title || ''} | ${entry.category || ''}/${entry.lorePurpose || ''} | ${subjects || 'general'} | ${fact}`;
}

function buildCompactLoreIndexForGeneration(state = {}, limit = 80) {
    const accepted = normalizeLoreMatrix(state?.loreMatrix || [])
        .filter(entry => isAcceptedStoryLoreEntry(entry))
        .slice(-limit);
    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []).slice(-Math.max(10, Math.floor(limit / 3)));
    const lines = [];
    for (const entry of accepted) lines.push(compactLoreIndexLine(entry, 'accepted'));
    for (const entry of pending) lines.push(compactLoreIndexLine(entry, 'pending'));
    return lines.join('\n').slice(0, 16000);
}

function buildLoreBulkScanPlan(settings = getSettings(), state = getState()) {
    const allMessages = getAllMessageObjects().map((message, idx) => normalizeScanMessage(message, idx));
    const totalMessages = allMessages.length;
    const scanMode = String(settings.loreBulkScanMode || 'recent').toLowerCase();
    const recentCount = clampInt(settings.loreSourceMessageCount, 1, 5000, 40);
    let startIndex = 1;
    let endIndex = totalMessages;

    if (scanMode === 'range') {
        startIndex = clampInt(settings.loreBulkRangeStart, 1, Math.max(1, totalMessages), 1);
        const configuredEnd = Number(settings.loreBulkRangeEnd) || totalMessages;
        endIndex = clampInt(configuredEnd, startIndex, Math.max(startIndex, totalMessages), totalMessages);
    } else if (scanMode === 'entire') {
        startIndex = 1;
        endIndex = totalMessages;
    } else {
        endIndex = totalMessages;
        startIndex = Math.max(1, totalMessages - recentCount + 1);
    }

    const selected = allMessages.filter(m => m.index >= startIndex && m.index <= endIndex);
    const chunkSize = clampInt(settings.loreBulkChunkSize || settings.loreGenerationChunkSize, 1, 50, 10);
    const overlap = clampInt(settings.loreBulkOverlap, 0, Math.max(0, chunkSize - 1), 1);
    const step = Math.max(1, chunkSize - overlap);
    const contextKey = buildLoreGenerationKey(state);
    const chunks = [];

    for (let offset = 0; offset < selected.length; offset += step) {
        const chunkMessages = selected.slice(offset, offset + chunkSize);
        if (!chunkMessages.length) break;
        const first = chunkMessages[0];
        const last = chunkMessages[chunkMessages.length - 1];
        const messageHash = stableStringHash(chunkMessages.map(m => `${m.index}:${m.hash}`).join('|'));
        const chunkId = `${contextKey || 'context'}:bulk:${first.index}-${last.index}`;
        chunks.push({
            chunkId,
            startIndex: first.index,
            endIndex: last.index,
            messageCount: chunkMessages.length,
            messages: chunkMessages,
            messageHash,
        });
        if (offset + chunkSize >= selected.length) break;
    }

    return {
        chatMessageCount: totalMessages,
        scanMode,
        startIndex,
        endIndex,
        sourceMessageCount: selected.length,
        chunkSize,
        overlap,
        chunks,
        contextKey,
    };
}

function getBulkChunkPriorState(chunkId) {
    try {
        return getState()?.loreBulkGeneration?.chunks?.[chunkId] || null;
    } catch (_) {
        return null;
    }
}

function shouldQueueBulkChunk(chunk, settings = getSettings()) {
    const mode = String(settings.loreBulkRescanMode || 'skip_unchanged').toLowerCase();
    const prior = getBulkChunkPriorState(chunk.chunkId);
    if (mode === 'rescan_all') return true;
    if (mode === 'retry_failed') return prior?.status === 'failed';
    if (mode === 'stale_only') return !!prior && prior.messageHash !== chunk.messageHash;
    if (!prior) return true;
    if (prior.status === 'failed') return true;
    if (prior.messageHash !== chunk.messageHash) return true;
    return prior.status !== 'complete';
}

function buildEffectiveBulkSettings(baseSettings = getSettings(), options = {}) {
    const effective = { ...(baseSettings || {}) };
    if (options.scanModeOverride) effective.loreBulkScanMode = String(options.scanModeOverride).toLowerCase();
    if (options.rescanModeOverride) effective.loreBulkRescanMode = String(options.rescanModeOverride).toLowerCase();
    if (Number.isFinite(Number(options.rangeStart))) effective.loreBulkRangeStart = Number(options.rangeStart);
    if (Number.isFinite(Number(options.rangeEnd))) effective.loreBulkRangeEnd = Number(options.rangeEnd);
    if (Number.isFinite(Number(options.sourceMessageCount))) effective.loreSourceMessageCount = Number(options.sourceMessageCount);
    if (Number.isFinite(Number(options.chunkSize))) effective.loreBulkChunkSize = Number(options.chunkSize);
    if (Number.isFinite(Number(options.overlap))) effective.loreBulkOverlap = Number(options.overlap);
    if (Number.isFinite(Number(options.concurrency))) effective.loreBulkConcurrency = Number(options.concurrency);
    if (Number.isFinite(Number(options.retryAttempts))) effective.loreBulkRetryAttempts = Number(options.retryAttempts);
    if (Number.isFinite(Number(options.factsPerChunk))) effective.loreBulkFactsPerChunk = Number(options.factsPerChunk);

    // Automatic maintenance must not unexpectedly launch an entire-chat backfill
    // just because the manual scan UI was left on "entire chat".
    if (options.automationSafe) {
        effective.loreBulkScanMode = String(options.scanModeOverride || 'recent').toLowerCase();
        effective.loreBulkRescanMode = String(options.rescanModeOverride || 'skip_unchanged').toLowerCase();
        effective.loreBulkConcurrency = clampInt(effective.loreBulkConcurrency, 1, 3, 2);
        effective.loreBulkFactsPerChunk = clampInt(effective.loreBulkFactsPerChunk, 3, 12, 8);
        effective.loreSourceMessageCount = Math.max(Number(effective.loreSourceMessageCount) || 40, 120);
    }

    return effective;
}

function buildBulkCandidateSystemPrompt(settings = getSettings(), profile = {}) {
    const factsPerChunk = clampInt(settings.loreBulkFactsPerChunk, 4, 30, 14);
    return `You are Saga's bulk story-lore extractor.

Task:
- Extract compact, durable story-specific lore operations from a message interval.
- This is a bulk backfill pass. Prefer high-value durable lore over coverage.
- Do not output full lore-entry schema. Output compact operation candidates only.
- Do not create generic Harry Potter encyclopedia facts, obvious canon identity facts, broad setting definitions, or glossary/reference facts.
- Only capture specific lore that protects timing, knowledge boundaries, statuses, secrets, relationships, possessions/items, goals, branch/story-established changes, or facts likely to be forgotten in a long chat.
- Capture new/original characters, canon characters as used by this story, relationships, possessions/items, spells/skills, secrets/knowledge boundaries, locations, factions, goals/threads, timeline anchors, and story-established canon changes.
- Use priorityHint: high only for active secrets, identity constraints, major relationship/current-goal facts, critical possessions, current injuries/conditions, or major story-established changes; medium for durable useful facts; low for minor but specific constraints.
- Use relevanceHint: high for facts from the current scene or immediate next-scene constraints; normal for durable recent-background/story facts; low for long-term specific constraints.
- Story-scan output is story-specific lore by default unless the message explicitly restates a canon fact.
- Every fact must include lorePurpose using one of: temporal_gate, knowledge_gate, ability_gate, status_change, event_anchor, branch_fact, relationship_state, secret, objective, item_state, location_state, rule_constraint, behavior_constraint.
- Use operation:
  - create: genuinely new durable lore.
  - update: changes or refines an existing durable state.
  - merge: adds durable details to an existing entry.
  - supersede: replaces an older state with a newer state.
  - conflict: contradicts accepted/pending lore and needs user review.
  - none: no durable lore in this interval.
- If similar existing lore exists, prefer update/merge/supersede/conflict and include targetEntryId when known.
- Include a concise title, 3-8 words, label-like, not a full sentence and not an evidence recap.
- Include injection as model-facing instruction text. It should be usable directly in a roleplay prompt.
- Include constraints and antiLore when they help prevent mistakes.
- Include durabilityReason explaining why this belongs in lore rather than a summary.
- It is acceptable to return zero facts when nothing durable happened.

Output requirements:
- Return ONLY valid JSON. No markdown fences. No commentary.
- Required shape: {"chunkSummary":"string","facts":[...]}
- Produce up to ${factsPerChunk} facts when supported by the chunk. Sparse chunks may produce fewer.
- Every fact must include: operation, category, subject, title, fact, injection, lorePurpose, priorityHint, relevanceHint, durabilityReason, messageRefs.
- messageRefs must be message numbers from the bracketed message labels.
- Keep facts atomic: one durable claim per fact.
- Use categories: character, relationship, item, spell, knowledge, place, faction, goal, timeline, event, secret, artifact, skill, rule. Do not emit reference/glossary/general facts.

Generation mode: ${profile.mode || 'bootstrap'}.
Target total entries for this scan: ${profile.targetTotal || 40}.`;
}

function buildBulkCandidateUserMessage({ stateSummary, loreIndex, chunk, plan, profile }) {
    return `Current Saga state summary:
${stateSummary}

Accepted/pending lore index for duplicate/update routing:
${loreIndex || '(No accepted or pending story lore yet.)'}

Bulk scan range: messages ${plan.startIndex}-${plan.endIndex} (${plan.sourceMessageCount} messages).
Current chunk: messages ${chunk.startIndex}-${chunk.endIndex}.
Generation mode: ${profile.mode || 'bootstrap'}.

Message interval:
${formatScanMessages(chunk.messages) || '(No message text)'}

Extract compact candidate lore operations from this interval. Output ONLY the JSON object now.`;
}

function normalizeCandidateFact(raw = {}, chunk = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const category = String(raw.category || raw.kind || raw.type || 'knowledge').trim().toLowerCase().replace(/[^a-z_ -]+/g, '').replace(/\s+/g, '_') || 'knowledge';
    const subject = String(raw.subject || raw.character || raw.item || raw.location || raw.title || '').trim();
    const fact = String(raw.fact || raw.detail || raw.description || raw.text || raw.summary || '').trim();
    if (!fact || fact.length < 8) return null;
    const messageRefs = Array.isArray(raw.messageRefs) ? raw.messageRefs : Array.isArray(raw.messages) ? raw.messages : Array.isArray(raw.evidenceMessageRefs) ? raw.evidenceMessageRefs : [];
    const operationRaw = String(raw.operation || raw.action || 'create').trim().toLowerCase().replace(/[^a-z_ -]+/g, '').replace(/\s+/g, '_');
    const operation = ['create', 'update', 'merge', 'supersede', 'conflict', 'none'].includes(operationRaw) ? operationRaw : 'create';
    const toStrings = (value, limit = 8) => Array.isArray(value)
        ? value.map(v => String(v || '').trim()).filter(Boolean).slice(0, limit)
        : [];
    return {
        operation,
        targetEntryId: String(raw.targetEntryId || raw.targetId || raw.existingEntryId || '').trim(),
        category,
        subject: subject || fact.split(/[.;]/)[0].slice(0, 80).trim() || 'Story fact',
        title: String(raw.title || raw.name || '').trim(),
        fact,
        injection: String(raw.injection || raw.promptText || raw.instruction || '').trim(),
        constraints: toStrings(raw.constraints),
        antiLore: toStrings(raw.antiLore || raw.avoid || raw.doNot),
        durabilityReason: String(raw.durabilityReason || raw.reason || raw.whyLore || '').trim().slice(0, 500),
        priorityHint: String(raw.priorityHint || raw.priority || 'medium').trim().toLowerCase(),
        relevanceHint: String(raw.relevanceHint || raw.relevance || '').trim().toLowerCase(),
        lorePurpose: String(raw.lorePurpose || raw.purpose || '').trim().toLowerCase(),
        canon: String(raw.canon || raw.canonMode || 'au').trim().toLowerCase(),
        confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0.75,
        messageRefs: messageRefs.map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0),
        scope: raw.scope && typeof raw.scope === 'object' ? raw.scope : {},
        visibility: raw.visibility && typeof raw.visibility === 'object' ? raw.visibility : {},
        date: raw.date && typeof raw.date === 'object' ? raw.date : {},
        recommendedPin: raw.recommendedPin === true || raw.pin === true || raw.protected === true,
        recommendedMute: raw.recommendedMute === true || raw.mute === true,
        evidence: String(raw.evidence || raw.quote || '').trim().slice(0, 500),
        chunkId: chunk.chunkId || '',
        startIndex: chunk.startIndex || 0,
        endIndex: chunk.endIndex || 0,
    };
}

function coerceBulkFactsShape(parsed) {
    if (Array.isArray(parsed)) return { chunkSummary: '', facts: parsed };
    if (!parsed || typeof parsed !== 'object') return null;
    if (Array.isArray(parsed.facts)) return { chunkSummary: String(parsed.chunkSummary || parsed.summary || ''), facts: parsed.facts };
    if (Array.isArray(parsed.candidates)) return { chunkSummary: String(parsed.chunkSummary || parsed.summary || ''), facts: parsed.candidates };
    if (Array.isArray(parsed.entries)) return { chunkSummary: String(parsed.chunkSummary || parsed.summary || ''), facts: parsed.entries };
    if (parsed.fact || parsed.description || parsed.text) return { chunkSummary: '', facts: [parsed] };
    return null;
}

function parseJsonLinesAsFacts(text) {
    const facts = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const trimmed = line.trim().replace(/,$/, '');
        if (!trimmed || !trimmed.startsWith('{')) continue;
        try {
            facts.push(JSON.parse(sanitizeJsonish(trimmed)));
        } catch (_) {
            // Keep scanning; JSONL salvage should preserve good lines.
        }
    }
    return facts.length ? { chunkSummary: '', facts } : null;
}

function parseBulkCandidateResponse(text, chunk = {}) {
    const responseText = extractLoreResponseText(text);
    if (!responseText.trim()) return null;
    const jsonl = parseJsonLinesAsFacts(responseText);
    const parsed = parseJsonResponse(responseText);
    const shaped = coerceBulkFactsShape(parsed);
    if (shaped) {
        const shapedFacts = shaped.facts.map(f => normalizeCandidateFact(f, chunk)).filter(Boolean);
        if (jsonl && jsonl.facts.length > shapedFacts.length) {
            const lineFacts = jsonl.facts.map(f => normalizeCandidateFact(f, chunk)).filter(Boolean);
            return { chunkSummary: jsonl.chunkSummary || shaped.chunkSummary || '', facts: lineFacts };
        }
        return { chunkSummary: shaped.chunkSummary || '', facts: shapedFacts };
    }
    if (jsonl) {
        const facts = jsonl.facts.map(f => normalizeCandidateFact(f, chunk)).filter(Boolean);
        return { chunkSummary: jsonl.chunkSummary || '', facts };
    }
    return null;
}

function getBulkCandidateParseFailure(rawResponse = '') {
    const hadVisibleResponse = String(rawResponse || '').trim().length > 0;
    return {
        error: hadVisibleResponse
            ? 'Story lore extraction returned malformed JSON that could not be repaired.'
            : 'Story lore extraction returned no visible response.',
        errorCode: hadVisibleResponse ? LORE_PARSE_ERROR_CODES.JSON_INVALID : '',
    };
}

function priorityFromHint(hint, category = '') {
    const h = String(hint || '').toLowerCase();
    const c = String(category || '').toLowerCase();
    if (/^(critical|highest|very_high|high|90|100)/.test(h)) return 85;
    if (/^(low|minor|background|flavor|20|30)/.test(h)) return 35;
    if (['secret', 'goal', 'timeline', 'event', 'rule'].includes(c)) return 75;
    if (['character', 'relationship', 'item', 'artifact', 'spell', 'skill'].includes(c)) return 65;
    return 55;
}

function cleanIdPart(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'story_fact';
}

function inferScopeFromCandidate(candidate = {}) {
    const scope = candidate.scope && typeof candidate.scope === 'object' ? { ...candidate.scope } : {};
    const subject = String(candidate.subject || '').trim();
    const category = String(candidate.category || '').toLowerCase();
    if (subject) {
        if (['character', 'relationship', 'secret'].includes(category)) {
            scope.characters = Array.from(new Set([...(Array.isArray(scope.characters) ? scope.characters : []), subject]));
        } else if (['place', 'location'].includes(category)) {
            scope.locations = Array.from(new Set([...(Array.isArray(scope.locations) ? scope.locations : []), subject]));
        } else if (['item', 'artifact'].includes(category)) {
            scope.objects = Array.from(new Set([...(Array.isArray(scope.objects) ? scope.objects : []), subject]));
        } else if (category === 'spell') {
            scope.spells = Array.from(new Set([...(Array.isArray(scope.spells) ? scope.spells : []), subject]));
        } else {
            scope.topics = Array.from(new Set([...(Array.isArray(scope.topics) ? scope.topics : []), subject]));
        }
    }
    return scope;
}

function categoryToLoreCategory(category = '') {
    const c = String(category || '').toLowerCase();
    if (c === 'place') return 'location';
    if (c === 'artifact' || c === 'object') return 'item';
    if (c === 'goal') return 'event';
    if (c === 'skill' || c === 'behavior' || c === 'age') return 'character';
    return ['character', 'relationship', 'item', 'spell', 'knowledge', 'location', 'faction', 'timeline', 'event', 'secret', 'rule'].includes(c) ? c : 'knowledge';
}

function candidateRelevanceToLoreRelevance(candidate = {}, profile = {}) {
    const raw = String(candidate.relevanceHint || candidate.relevance || '').trim().toLowerCase();
    if (['high', 'normal', 'low'].includes(raw)) return raw;
    const priority = String(candidate.priorityHint || '').trim().toLowerCase();
    const category = String(candidate.category || '').trim().toLowerCase();
    if (profile.mode === 'incremental' && ['high', 'urgent', 'critical'].includes(priority)) return 'high';
    if (['secret', 'relationship', 'item', 'artifact', 'goal'].includes(category) && ['high', 'critical'].includes(priority)) return 'high';
    if (['low', 'flavor', 'background'].includes(priority)) return 'low';
    return profile.mode === 'incremental' ? 'normal' : 'normal';
}

function candidateCanonToLoreCanon(candidate = {}) {
    const raw = String(candidate.canon || candidate.canonMode || candidate.canonStatus || '').trim().toLowerCase();
    return raw === 'canon' ? 'canon' : 'au';
}

function conciseGeneratedTitle(candidate = {}, category = 'knowledge', lorePurpose = '') {
    const explicit = String(candidate.title || '').replace(/\s+/g, ' ').trim();
    if (explicit) return explicit.replace(/[.!?]+$/g, '').slice(0, 80);
    const subject = String(candidate.subject || '').replace(/\s+/g, ' ').trim();
    const fact = String(candidate.fact || '').replace(/\s+/g, ' ').trim();
    const purposeLabels = {
        knowledge_gate: 'knowledge gate',
        ability_gate: 'ability gate',
        status_change: 'state change',
        event_anchor: 'event anchor',
        branch_fact: 'story branch',
        relationship_state: 'relationship state',
        secret: 'secret',
        objective: 'objective',
        item_state: 'item state',
        location_state: 'location state',
        rule_constraint: 'rule',
        behavior_constraint: 'behavior constraint',
        temporal_gate: 'timeline gate',
        age_gate: 'age gate',
    };
    const suffix = purposeLabels[lorePurpose] || (category ? `${category} lore` : 'story lore');
    if (subject) return `${subject} ${suffix}`.slice(0, 80);
    return fact.split(/[.;:]/)[0].replace(/\b(found|discovered|noticed|saw|talked|went)\b/ig, '').trim().slice(0, 80) || 'Story lore';
}

function generatedKindFor(category = '', lorePurpose = '') {
    if (lorePurpose === 'knowledge_gate' || lorePurpose === 'secret') return 'knowledge_gate';
    if (lorePurpose === 'ability_gate') return category === 'spell' ? 'spell_gate' : 'skill_band';
    if (lorePurpose === 'relationship_state') return 'relationship_state';
    if (lorePurpose === 'item_state') return 'object_state';
    if (lorePurpose === 'event_anchor' || lorePurpose === 'temporal_gate') return 'event_anchor';
    if (lorePurpose === 'behavior_constraint') return 'behavior_gate';
    if (lorePurpose === 'location_state') return 'place_fact';
    if (lorePurpose === 'rule_constraint') return 'continuity_rule';
    if (lorePurpose === 'status_change') return 'character_state';
    return category === 'spell' ? 'spell_use'
        : category === 'relationship' ? 'relationship_state'
            : category === 'item' ? 'object_state'
                : 'fact';
}

function candidateFactToLoreEntry(candidate = {}, { batchId = '', chunk = {}, profile = {} } = {}) {
    const generationMode = profile.mode === 'incremental' ? 'bulk-incremental' : 'bulk-bootstrap';
    const category = categoryToLoreCategory(candidate.category);
    const subject = String(candidate.subject || 'Story fact').trim();
    const fact = String(candidate.fact || '').trim();
    const rangeLabel = chunk?.startIndex && chunk?.endIndex ? `Messages ${chunk.startIndex}-${chunk.endIndex}` : '';
    const hash = stableStringHash(`${batchId}|${chunk?.chunkId || ''}|${subject}|${fact}`);
    const messageRefs = Array.isArray(candidate.messageRefs) ? candidate.messageRefs : [];
    const lorePurpose = normalizeLorePurpose(candidate.lorePurpose || candidate.purpose, { kind: category === 'spell' ? 'spell_gate' : category === 'relationship' ? 'relationship_gate' : category === 'item' || category === 'artifact' ? 'artifact_state' : category === 'event' ? 'event_anchor' : category === 'timeline' ? 'event_anchor' : category === 'secret' ? 'knowledge_gate' : 'fact', category });
    const title = conciseGeneratedTitle(candidate, category, lorePurpose);
    const scope = inferScopeFromCandidate(candidate);
    const kind = generatedKindFor(category, lorePurpose);
    const injection = String(candidate.injection || '').trim() || fact;
    const constraints = Array.isArray(candidate.constraints) ? candidate.constraints : [];
    const antiLore = Array.isArray(candidate.antiLore) ? candidate.antiLore : [];
    const date = candidate.date && typeof candidate.date === 'object' ? candidate.date : {};
    const specificityScore = computeSpecificityScore({ category, kind, lorePurpose, content: { fact, injection, constraints, antiLore }, scope, date });
    return {
        id: `story_bulk_${cleanIdPart(subject)}_${hash}`,
        title,
        kind,
        gateType: kind,
        category,
        canon: candidateCanonToLoreCanon(candidate),
        canonStatus: candidateCanonToLoreCanon(candidate),
        relevance: candidateRelevanceToLoreRelevance(candidate, profile),
        lorePurpose,
        specificityScore,
        injectableByDefault: true,
        truthStatus: category === 'secret' || lorePurpose === 'secret' || lorePurpose === 'knowledge_gate' ? 'hidden' : 'true',
        revealPolicy: category === 'secret' || lorePurpose === 'secret' || lorePurpose === 'knowledge_gate' ? 'private' : 'public',
        priority: priorityFromHint(candidate.priorityHint, category),
        tags: [subject, category, 'bulk scan', rangeLabel].filter(Boolean),
        protected: !!candidate.recommendedPin,
        date,
        visibility: candidate.visibility && typeof candidate.visibility === 'object' ? candidate.visibility : {},
        scope,
        content: {
            fact,
            injection,
            constraints,
            antiLore,
            notes: [candidate.durabilityReason ? `Why lore: ${candidate.durabilityReason}` : '', candidate.evidence ? `Evidence: ${candidate.evidence}` : ''].filter(Boolean).join(' '),
        },
        effects: {
            addsTags: [subject, category, lorePurpose].filter(Boolean),
            injectionRules: constraints.length || antiLore.length ? { preferAsConstraint: true } : {},
        },
        source: `model-generated:bulk:${batchId}:${chunk?.chunkId || ''}`,
        sourceInfo: {
            id: `bulk-lore:${batchId}:${chunk?.chunkId || ''}`,
            work: 'Current chat',
            chapter: rangeLabel,
            confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0.75)),
            notes: messageRefs.length ? `Evidence messages: ${messageRefs.join(', ')}` : rangeLabel,
        },
        extensions: {
            sagaGeneration: {
                mode: generationMode,
                batchId,
                chunkId: chunk?.chunkId || '',
                startIndex: chunk?.startIndex || 0,
                endIndex: chunk?.endIndex || 0,
                messageHash: chunk?.messageHash || '',
                evidenceMessageRefs: messageRefs,
                operation: candidate.operation || 'create',
                targetEntryId: candidate.targetEntryId || '',
                candidateCategory: candidate.category || category,
                relevanceHint: candidate.relevanceHint || '',
                lorePurpose,
                canonHint: candidate.canon || '',
                durabilityReason: candidate.durabilityReason || '',
                recommendedPin: !!candidate.recommendedPin,
                recommendedMute: !!candidate.recommendedMute,
                generatedAt: Date.now(),
                targetTotal: profile.targetTotal || 0,
            },
        },
    };
}

function classifyGeneratedLoreValue(entry = {}) {
    const generation = entry.extensions?.sagaGeneration || {};
    const operation = String(generation.operation || 'create').toLowerCase();
    if (operation === 'none') {
        return { route: 'discard_none', keep: false, reason: 'Model marked this interval as having no durable lore.' };
    }
    if (['update', 'merge', 'supersede', 'conflict'].includes(operation)) {
        return { route: operation, keep: true, reason: `Candidate proposes a ${operation} operation for review.` };
    }

    const content = entry.content || {};
    const fact = String(content.fact || entry.fact || '');
    const injection = String(content.injection || '');
    const text = `${entry.title || ''} ${fact} ${injection} ${(content.constraints || []).join(' ')} ${(content.antiLore || []).join(' ')} ${content.notes || ''}`;
    const hasConstraint = (content.constraints || []).length > 0 || (content.antiLore || []).length > 0;
    const durablePattern = /\b(each time|whenever|when opened|until|before|after|unless|should not|do not|must not|secret|hidden|knows?|does not know|revealed|vow|curse|injur|wound|dead|alive|owns?|carries|possesses|lost|stolen|cannot|can no longer|learned|able to|unable to|relationship|trust|rival|enemy|ally|goal|objective|mission|plan|branch|au|diverge|changed canon|rule|law|ritual|bound|marked)\b/i;
    const recapPattern = /\b(found|discovered|noticed|saw|met|visited|went to|talked to|read|looked at|picked up|entered)\b/i;
    const specificity = Number(entry.specificityScore || 0);

    if (hasConstraint || durablePattern.test(text)) {
        return { route: 'create', keep: true, reason: 'Candidate includes a durable constraint, state, trigger, secret, rule, or recurring behavior.' };
    }
    if (specificity >= 55) {
        return { route: 'create', keep: true, reason: `Candidate passes specificity threshold (${specificity}).` };
    }
    if (recapPattern.test(fact) && !durablePattern.test(text)) {
        return { route: 'low_value_summary', keep: false, reason: 'Looks like a scene recap without durable consequences.' };
    }
    if (specificity < 40) {
        return { route: 'insufficient_specificity', keep: false, reason: `Specificity score ${specificity} is too low for story lore.` };
    }
    return { route: 'needs_review', keep: true, reason: 'Specific enough for user review, but no strong durable marker was detected.' };
}

function applyGeneratedLoreQualityRouting(entries = [], settings = getSettings()) {
    const kept = [];
    const dropped = [];
    const strict = settings.loreStrictQualityGate !== false;
    for (const raw of normalizeLoreMatrix(entries)) {
        const classification = classifyGeneratedLoreValue(raw);
        const generation = raw.extensions?.sagaGeneration || {};
        const routed = normalizeLoreMatrix([{
            ...raw,
            extensions: {
                ...(raw.extensions || {}),
                sagaGeneration: {
                    ...generation,
                    qualityRoute: classification.route,
                    qualityReason: classification.reason,
                },
                sagaPendingReview: {
                    ...(raw.extensions?.sagaPendingReview || {}),
                    qualityRoute: classification.route,
                    qualityReason: classification.reason,
                },
            },
        }])[0];
        if (!classification.keep && strict) {
            dropped.push({ entry: routed || raw, reason: classification.reason, route: classification.route });
        } else if (routed) {
            kept.push(routed);
        }
    }
    return { entries: kept, dropped };
}

async function runWithConcurrency(items, concurrency, worker) {
    const limit = Math.max(1, Math.min(12, Number(concurrency) || 1));
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runner() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            try {
                results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
            } catch (error) {
                results[index] = { status: 'rejected', reason: error };
            }
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
    await Promise.all(workers);
    return results;
}

async function extractBulkChunkCandidates({ chunk, plan, batchId, profile, settings, stateSummary, loreIndex, signal }) {
    const maxAttempts = Math.max(1, Math.min(5, clampInt(settings.loreBulkRetryAttempts, 0, 4, 2) + 1));
    const systemPrompt = buildBulkCandidateSystemPrompt(settings, profile);
    const userMessage = buildBulkCandidateUserMessage({ stateSummary, loreIndex, chunk, plan, profile });
    let lastError = '';
    let lastErrorCode = '';
    let rawResponse = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        throwIfAborted(signal);
        checkpointLoreBulkChunk(chunk.chunkId, {
            batchId,
            chunkPatch: {
                batchId,
                status: attempt === 1 ? 'running' : 'retrying',
                attempts: attempt,
                startIndex: chunk.startIndex,
                endIndex: chunk.endIndex,
                messageHash: chunk.messageHash,
                messageCount: chunk.messageCount,
                startedAt: attempt === 1 ? Date.now() : undefined,
                error: '',
            },
        }, { full: false, syncPrompt: false });

        try {
            rawResponse = await quietPrompt(systemPrompt, userMessage, { signal, maxTokens: profile.maxTokens, expectedOutput: 'json' });
            throwIfAborted(signal);
            let parsed = parseBulkCandidateResponse(rawResponse, chunk);
            if ((!parsed || !parsed.facts.length) && settings.loreRepairOnParseFail) {
                parsed = await repairBulkCandidateJsonResponse(rawResponse, chunk);
            }
            if (!parsed) {
                const failure = getBulkCandidateParseFailure(rawResponse);
                lastError = failure.error;
                lastErrorCode = failure.errorCode;
                continue;
            }

            const candidates = parsed.facts || [];
            checkpointLoreBulkChunk(chunk.chunkId, {
                batchId,
                candidates,
                rawResponse,
                chunkPatch: {
                    batchId,
                    status: 'complete',
                    attempts: attempt,
                    startIndex: chunk.startIndex,
                    endIndex: chunk.endIndex,
                    messageHash: chunk.messageHash,
                    messageCount: chunk.messageCount,
                    candidateCount: candidates.length,
                    chunkSummary: parsed.chunkSummary || '',
                    rawResponse: settings.debugMode || settings.loreBulkRetainRawResponses ? String(rawResponse || '').slice(0, 20000) : '',
                    error: '',
                    lastScannedAt: Date.now(),
                    completedAt: Date.now(),
                },
            }, { full: false, syncPrompt: false });
            return { status: 'complete', chunk, candidates, summary: parsed.chunkSummary || '', attempts: attempt };
        } catch (e) {
            if (isAbortError(e)) throw e;
            lastError = e?.message || String(e || 'Unknown provider error');
            lastErrorCode = e?.code || e?.errorCode || '';
        }
    }

    checkpointLoreBulkChunk(chunk.chunkId, {
        batchId,
        rawResponse,
        chunkPatch: {
            batchId,
            status: 'failed',
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            messageHash: chunk.messageHash,
            messageCount: chunk.messageCount,
            error: lastError || 'Bulk extraction failed.',
            errorCode: lastErrorCode,
            rawResponse: settings.debugMode || settings.loreBulkRetainRawResponses ? String(rawResponse || '').slice(0, 20000) : '',
            lastScannedAt: Date.now(),
            failedAt: Date.now(),
        },
    }, { full: false, syncPrompt: false });
    return { status: 'failed', chunk, candidates: [], summary: '', error: lastError || 'Bulk extraction failed.', errorCode: lastErrorCode };
}

/**
 * Runs a resumable, range-based bulk story lore scan.
 * Processes chunks concurrently, checkpoints candidate facts, and consolidates Pending Lore entries in durable batches.
 * @param {Object} [options]
 * @param {boolean} [options.force=true]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.progress]
 * @returns {Promise<Object>} Structured bulk scan result
 */
export async function runBulkLoreGeneration(options = {}) {
    const { force = true, signal = null } = options;
    const progress = typeof options.progress === 'function' ? options.progress : null;
    const source = options.source || (force ? 'manual' : 'auto');
    const automationSafe = !!options.automationSafe || source === 'auto' || !force;

    if (_generationRunning) {
        return { status: 'skipped_running' };
    }

    _generationRunning = true;
    try {
        throwIfAborted(signal);
        let state = getState();
        const settings = buildEffectiveBulkSettings(getSettings(), options);
        markInterruptedLoreBulkChunks(settings.loreBulkRunningCheckpointStaleMs || 10 * 60 * 1000);

        const validation = validateLoreProviderConfiguration();
        if (!validation.ok) {
            progress?.(`API/model settings incomplete: ${validation.message}`, 100);
            return { status: 'api_not_configured', error: validation.message };
        }

        if (!state.loreContext?.lastDetectedAt) {
            if (force) {
                progress?.('Detecting context before lore scan...', 4);
                const detected = await runLoreContextDetection({ progress, signal });
                if (!detected) {
                    progress?.('No context could be detected. Lore scan cancelled.', 100);
                    return { status: 'no_context_detected' };
                }
                state = getState();
            } else {
                if (settings.debugMode) console.debug(`${LOG_PREFIX} Skipping lore scan — no lore context detected yet`);
                return { status: 'no_context_detected', contextKey: buildLoreGenerationKey(state) };
            }
        }

        const contextKey = buildLoreGenerationKey(state);
        const pending = state.pendingLoreEntries || [];
        const pendingMeta = state.pendingLoreMeta || null;
        if (pending.length > 0 && automationSafe) {
            const pendingKey = pendingMeta?.contextKey || '';
            if (pendingKey && pendingKey !== contextKey) {
                markPendingLoreStale(`Current context changed to ${contextKey}`);
                return { status: 'skipped_stale_pending_exists', contextKey, pendingContextKey: pendingKey };
            }
            return { status: 'skipped_same_context_pending', contextKey, pendingContextKey: pendingKey };
        }
        if (pending.length > 0 && settings.loreReplacementGuard !== false && !automationSafe && !options.allowPendingAppend && !options.replacePending) {
            const pendingKey = pendingMeta?.contextKey || '';
            return {
                status: 'pending_lore_exists',
                contextKey,
                pendingContextKey: pendingKey,
                pendingCount: pending.length,
                sameContext: !pendingKey || pendingKey === contextKey,
            };
        }
        if (pending.length > 0 && !automationSafe && options.replacePending) {
            markPendingLoreReplaced(contextKey);
            state = getState();
            state.pendingLoreEntries = [];
            state.pendingLoreMeta = null;
            saveState(state, { syncPrompt: false });
        }

        const ledger = state.loreGeneration || {};
        const attempt = ledger.attempts?.[contextKey];
        if (automationSafe && attempt?.status === 'accepted') {
            return { status: 'skipped_already_accepted', contextKey };
        }
        if (automationSafe && attempt?.status === 'rejected') {
            return { status: 'skipped_previously_rejected', contextKey };
        }
        if (automationSafe && attempt && FAILED_STATUSES.includes(attempt.status)) {
            const last = attempt.lastAttemptAt || 0;
            if (Date.now() - last < FAILED_RETRY_COOLDOWN_MS) {
                return { status: 'skipped_recent_failure', contextKey };
            }
        }

        recordLoreAttempt(contextKey, {
            status: 'running',
            lastSource: source,
            lastError: '',
            generationMode: automationSafe ? 'bulk-incremental' : 'bulk-bootstrap',
        }, { syncPrompt: false });

        const plan = buildLoreBulkScanPlan(settings, state);
        if (!plan.sourceMessageCount || !plan.chunks.length) {
            recordLoreAttempt(contextKey, {
                status: 'empty_range',
                lastSource: source,
                generationMode: automationSafe ? 'bulk-incremental' : 'bulk-bootstrap',
                lastError: '',
            }, { increment: false, syncPrompt: false });
            progress?.('No chat messages found in the configured bulk scan range.', 100);
            return { status: 'empty_range', plan };
        }

        const allChunks = plan.chunks;
        const queuedChunks = allChunks.filter(chunk => shouldQueueBulkChunk(chunk, settings));
        const skippedChunks = allChunks.length - queuedChunks.length;
        const batchId = `bulk_lore_${Date.now()}_${stableStringHash(`${contextKey}|${plan.startIndex}|${plan.endIndex}|${plan.chunkSize}|${plan.overlap}`)}`;
        const profile = determineLoreGenerationProfile(settings, state, {
            force,
            sourceCount: plan.sourceMessageCount,
            chunkCount: Math.max(1, queuedChunks.length || allChunks.length),
        });
        const bulkMode = options.generationModeOverride || (automationSafe ? 'incremental' : 'bootstrap');
        profile.mode = bulkMode;
        profile.bulk = true;
        if (bulkMode === 'bootstrap') {
            profile.targetTotal = Math.max(profile.targetTotal, Math.ceil(plan.sourceMessageCount / Math.max(1, plan.chunkSize)) * 6);
        } else {
            profile.targetTotal = Math.max(1, Math.min(profile.targetTotal, Math.ceil(plan.sourceMessageCount / Math.max(1, plan.chunkSize)) * 3));
        }

        const concurrency = clampInt(settings.loreBulkConcurrency, 1, 8, 3);
        const consolidationChunkWindow = clampInt(settings.loreBulkConsolidationChunkWindow, 1, 25, 5);
        const consolidationFactWindow = clampInt(settings.loreBulkConsolidationFactWindow, 10, 500, 80);
        const fullCheckpointEveryChunks = clampInt(settings.loreBulkFullCheckpointEveryChunks, 1, 25, 5);
        const fullCheckpointEveryMs = clampInt(settings.loreBulkFullCheckpointEveryMs, 1000, 60000, 12000);
        const stateSummary = JSON.stringify({
            canon: state.canon,
            scene: state.scene,
            loreContext: state.loreContext,
            acceptedStoryLoreCount: countAcceptedStoryLore(state.loreMatrix || []),
        }, null, 0);
        const loreIndex = buildCompactLoreIndexForGeneration(state);

        startLoreBulkBatch({
            id: batchId,
            contextKey,
            status: 'running',
            mode: profile.mode === 'bootstrap' ? 'bulk-bootstrap' : 'bulk-incremental',
            source,
            automationSafe,
            scanMode: plan.scanMode,
            rangeStart: plan.startIndex,
            rangeEnd: plan.endIndex,
            sourceMessageCount: plan.sourceMessageCount,
            chunkSize: plan.chunkSize,
            overlap: plan.overlap,
            concurrency,
            rescanMode: settings.loreBulkRescanMode || 'skip_unchanged',
            totalChunks: allChunks.length,
            queuedChunks: queuedChunks.length,
            skippedChunks,
            completedChunks: 0,
            failedChunks: 0,
            candidateCount: 0,
            pendingEntryCount: (state.pendingLoreEntries || []).length,
            checkpointPolicy: {
                chunkCheckpoint: 'immediate',
                fullCheckpointEveryChunks,
                fullCheckpointEveryMs,
                consolidationChunkWindow,
                consolidationFactWindow,
            },
        });

        if (!queuedChunks.length) {
            flushLoreBulkFullCheckpoint(batchId, { status: 'complete', completedAt: Date.now(), skippedChunks, completedChunks: 0 });
            recordLoreAttempt(contextKey, {
                status: 'skipped_unchanged',
                lastSource: source,
                generationMode: profile.mode === 'bootstrap' ? 'bulk-bootstrap' : 'bulk-incremental',
                lastError: '',
            }, { increment: false, syncPrompt: false });
            progress?.(`Lore scan found no changed chunks. Skipped ${skippedChunks} unchanged chunk${skippedChunks === 1 ? '' : 's'}.`, 100);
            return { status: 'skipped_unchanged', batchId, plan, skippedChunks };
        }

        progress?.(`Story lore scan queued ${queuedChunks.length}/${allChunks.length} chunks from messages ${plan.startIndex}-${plan.endIndex}. Running ${concurrency} in parallel.`, 8);

        let completed = 0;
        let failed = 0;
        let candidateCount = 0;
        let pendingEntryCount = (state.pendingLoreEntries || []).length;
        let duplicateDrops = 0;
        let qualityDrops = 0;
        let routedSimilarCount = 0;
        let dirtyChunksSinceFullCheckpoint = 0;
        let lastFullCheckpointAt = Date.now();
        const summaries = [];
        const pendingCandidateRecords = [];
        let consolidationChain = Promise.resolve();

        const currentBatchPatch = (extra = {}) => ({
            completedChunks: completed,
            failedChunks: failed,
            candidateCount,
            pendingEntryCount,
            droppedDuplicateCount: duplicateDrops,
            droppedQualityCount: qualityDrops,
            routedSimilarCount,
            lastProgressAt: Date.now(),
            ...extra,
        });

        function queuedFactCount() {
            return pendingCandidateRecords.reduce((sum, record) => sum + (Array.isArray(record.candidates) ? record.candidates.length : 0), 0);
        }

        async function flushConsolidationWindow(forceFlush = false) {
            const factsWaiting = queuedFactCount();
            if (!pendingCandidateRecords.length) return { changed: false, entryCount: 0, duplicateDrops: 0 };
            if (!forceFlush && pendingCandidateRecords.length < consolidationChunkWindow && factsWaiting < consolidationFactWindow) {
                return { changed: false, entryCount: 0, duplicateDrops: 0 };
            }

            const records = pendingCandidateRecords.splice(0, pendingCandidateRecords.length);
            const rawEntries = [];
            for (const record of records) {
                for (const candidate of record.candidates || []) {
                    rawEntries.push(candidateFactToLoreEntry(candidate, { batchId, chunk: record.chunk, profile }));
                }
            }
            const entries = normalizeLoreMatrix(rawEntries);
            const qualityFiltered = applyGeneratedLoreQualityRouting(entries, settings);
            let filteredEntries = qualityFiltered.entries;
            let drops = [];
            let quality = qualityFiltered.dropped || [];
            qualityDrops += quality.length;
            if (settings.loreDuplicateGuard !== false && filteredEntries.length) {
                const current = getState();
                const guardBase = [ ...(current.loreMatrix || []), ...(current.pendingLoreEntries || []) ];
                const filtered = settings.loreSimilarityRouting === false
                    ? filterDuplicateLoreEntries(filteredEntries, guardBase, {
                        storyGeneration: true,
                        ignoreCanonicalSourceSimilarity: true,
                    })
                    : routeSimilarLoreEntries(filteredEntries, guardBase, {
                        storyGeneration: true,
                        ignoreCanonicalSourceSimilarity: true,
                    });
                filteredEntries = filtered.entries;
                drops = filtered.dropped || [];
                routedSimilarCount += (filtered.routed || []).length;
            }
            duplicateDrops += drops.length;

            if (settings.loreBulkConsolidateAsPending !== false && filteredEntries.length) {
                const append = appendPendingLoreEntries(filteredEntries, {
                    id: batchId,
                    contextKey,
                    source: source === 'auto' ? 'auto_bulk' : 'manual_bulk',
                    summary: `${profile.mode === 'bootstrap' ? 'Bootstrap' : 'Incremental'} story lore scan messages ${plan.startIndex}-${plan.endIndex}`,
                    rawEntryCount: entries.length,
                    normalizedEntryCount: entries.length,
                    droppedDuplicateCount: drops.length,
                    droppedQualityCount: quality.length,
                    routedSimilarCount,
                    sourceMessageCount: plan.sourceMessageCount,
                    chunkSize: plan.chunkSize,
                    chunkCount: allChunks.length,
                    completedChunkCount: completed,
                    failedChunkCount: failed,
                    generationMode: profile.mode === 'bootstrap' ? 'bulk-bootstrap' : 'bulk-incremental',
                    generationConfiguredMode: settings.loreGenerationBreadthMode || 'auto',
                    targetEntryCount: profile.targetTotal,
                    storyLoreCountBefore: profile.storyLoreCount,
                    bulkBatchId: batchId,
                    bulkChunkId: records.map(r => r.chunk?.chunkId).filter(Boolean).slice(-1)[0] || '',
                    bulk: true,
                }, {
                    syncPrompt: false,
                    full: true,
                });
                pendingEntryCount = append.pendingCount;
            }

            flushLoreBulkFullCheckpoint(batchId, currentBatchPatch({
                lastConsolidatedAt: Date.now(),
                lastConsolidatedChunkCount: records.length,
                lastConsolidatedFactCount: factsWaiting,
            }));
            dirtyChunksSinceFullCheckpoint = 0;
            lastFullCheckpointAt = Date.now();
            return { changed: true, entryCount: filteredEntries.length, duplicateDrops: drops.length };
        }

        async function scheduleConsolidation(forceFlush = false) {
            consolidationChain = consolidationChain.then(() => flushConsolidationWindow(forceFlush));
            return consolidationChain;
        }

        function maybeFullCheckpoint(forceFlush = false) {
            const now = Date.now();
            if (!forceFlush && dirtyChunksSinceFullCheckpoint < fullCheckpointEveryChunks && now - lastFullCheckpointAt < fullCheckpointEveryMs) {
                return;
            }
            flushLoreBulkFullCheckpoint(batchId, currentBatchPatch({
                lastCheckpointReason: forceFlush ? 'forced' : dirtyChunksSinceFullCheckpoint >= fullCheckpointEveryChunks ? 'chunk_window' : 'time_window',
            }));
            dirtyChunksSinceFullCheckpoint = 0;
            lastFullCheckpointAt = now;
        }

        const results = await runWithConcurrency(queuedChunks, concurrency, async (chunk) => {
            throwIfAborted(signal);
            progress?.(`Story lore scan running: ${completed + failed}/${queuedChunks.length} chunks complete, ${Math.min(concurrency, queuedChunks.length - completed - failed)} active.`, Math.min(95, 8 + Math.round(((completed + failed) / queuedChunks.length) * 85)));
            const result = await extractBulkChunkCandidates({ chunk, plan, batchId, profile, settings, stateSummary, loreIndex, signal });

            if (result.status === 'complete') {
                candidateCount += result.candidates.length;
                pendingCandidateRecords.push({ chunk, candidates: result.candidates || [], summary: result.summary || '' });
                if (result.summary) summaries.push(result.summary);
                completed++;
            } else {
                failed++;
            }

            dirtyChunksSinceFullCheckpoint++;
            if (pendingCandidateRecords.length >= consolidationChunkWindow || queuedFactCount() >= consolidationFactWindow) {
                await scheduleConsolidation(false);
            } else {
                maybeFullCheckpoint(false);
            }
            progress?.(`Story lore scan: ${completed} complete, ${failed} failed, ${candidateCount} candidate facts, ${pendingEntryCount} pending entries.`, Math.min(98, 8 + Math.round(((completed + failed) / queuedChunks.length) * 88)));
            return result;
        });

        await consolidationChain;
        await scheduleConsolidation(true);

        const rejected = results.filter(r => r.status === 'rejected').length;
        const totalFailed = failed + rejected;
        const status = totalFailed === queuedChunks.length ? 'failed' : totalFailed > 0 ? 'partial' : 'complete';
        flushLoreBulkFullCheckpoint(batchId, currentBatchPatch({
            status,
            completedAt: Date.now(),
            summaries: summaries.slice(-20),
        }));
        patchPendingLoreMeta({
            bulkBatchId: batchId,
            generationMode: profile.mode === 'bootstrap' ? 'bulk-bootstrap' : 'bulk-incremental',
            completedChunkCount: completed,
            failedChunkCount: totalFailed,
            chunkCount: allChunks.length,
            rawEntryCount: candidateCount,
            normalizedEntryCount: candidateCount,
            droppedDuplicateCount: duplicateDrops,
            droppedQualityCount: qualityDrops,
            routedSimilarCount,
            sourceMessageCount: plan.sourceMessageCount,
            chunkSize: plan.chunkSize,
            targetEntryCount: profile.targetTotal,
            summary: `${profile.mode === 'bootstrap' ? 'Bootstrap' : 'Incremental'} story lore scan messages ${plan.startIndex}-${plan.endIndex}`,
        }, { syncPrompt: false, full: true });

        recordLoreAttempt(contextKey, {
            status: status === 'failed' ? 'failed_bulk_scan' : 'pending',
            lastSource: source,
            validEntryCount: pendingEntryCount,
            rawEntryCount: candidateCount,
            droppedDuplicateCount: duplicateDrops,
            droppedQualityCount: qualityDrops,
            routedSimilarCount,
            generationMode: profile.mode === 'bootstrap' ? 'bulk-bootstrap' : 'bulk-incremental',
            targetEntryCount: profile.targetTotal,
            lastError: status === 'failed' ? `All queued chunks failed (${totalFailed})` : '',
        }, { increment: false, syncPrompt: false });
        progress?.(`Story lore scan ${status}: ${completed} chunks complete, ${totalFailed} failed, ${candidateCount} candidate facts, ${pendingEntryCount} Pending Review entries.`, 100);
        return {
            status,
            batchId,
            contextKey,
            plan,
            totalChunks: allChunks.length,
            queuedChunks: queuedChunks.length,
            skippedChunks,
            completedChunkCount: completed,
            failedChunkCount: totalFailed,
            candidateCount,
            pendingEntryCount,
            droppedDuplicateCount: duplicateDrops,
            droppedQualityCount: qualityDrops,
            routedSimilarCount,
        };
    } catch (e) {
        const batchId = getState()?.loreBulkGeneration?.activeBatchId || '';
        if (batchId) flushLoreBulkFullCheckpoint(batchId, { status: isAbortError(e) ? 'cancelled' : 'failed', error: e?.message || String(e || '') });
        if (isAbortError(e)) {
            progress?.('Story lore scan cancelled by user.', 0);
            return { status: 'cancelled', error: 'Cancelled by user' };
        }
        console.error(`${LOG_PREFIX} Bulk lore generation failed:`, e);
        progress?.(`Story lore scan failed: ${e.message || e}`, 100);
        return { status: 'failed_exception', error: e.message || String(e || '') };
    } finally {
        _generationRunning = false;
    }
}

/**
 * Compatibility entrypoint for every story-lore generation caller.
 * Manual callers use the user's scan UI configuration. Automatic callers are
 * constrained to recent, stale-only incremental scans so they cannot start a
 * large backfill unexpectedly.
 *
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Structured lore scan result
 */
export async function runStoryLoreScan(options = {}) {
    const force = options.force !== undefined ? !!options.force : options.source !== 'auto';
    const source = options.source || (force ? 'manual' : 'auto');
    const automationSafe = options.automationSafe !== undefined ? !!options.automationSafe : source === 'auto' || !force;

    return await runBulkLoreGeneration({
        ...options,
        force,
        source,
        automationSafe,
        scanModeOverride: options.scanModeOverride || (automationSafe ? 'recent' : undefined),
        rescanModeOverride: options.rescanModeOverride || (automationSafe ? 'skip_unchanged' : undefined),
        generationModeOverride: options.generationModeOverride || (automationSafe ? 'incremental' : undefined),
    });
}

export const __bulkLoreTestHooks = {
    stableStringHash,
    normalizeScanMessage,
    buildLoreBulkScanPlan,
    parseBulkCandidateResponse,
    getBulkCandidateParseFailure,
    candidateFactToLoreEntry,
    classifyGeneratedLoreValue,
    applyGeneratedLoreQualityRouting,
    buildCompactLoreIndexForGeneration,
    runWithConcurrency,
};

// ── Fluent pipeline: detect + generate ──────────────────────────────────────────

/**
 * Runs the full lore pipeline: detect context, then generate entries.
 * Both steps are guarded. Skips generation if detection fails.
 * @returns {Promise<{ detected: Object|null, generated: Object[] }>}
 */
export const __contextDetectionTestHooks = {
    buildContextBriefRepairPrompt,
    normalizeDetectedContextBrief,
    inferContextBriefLocallyFromMessages,
    buildLoreContextFromContextBrief,
    buildResolverContextFromContextBrief,
    buildContextBriefFromLoreContext,
    hasUsableContextBrief,
};

export async function runLorePipeline(options = {}) {
    const detected = await runLoreContextDetection(options);
    const generated = detected
        ? await runStoryLoreScan({ ...options, force: false, source: 'auto', automationSafe: true })
        : null;
    return { detected, generated };
}

// ── Guard state export (for debugging) ──────────────────────────────────────────

export function isDetectionRunning() {
    return _detectionRunning;
}

export function isGenerationRunning() {
    return _generationRunning;
}
