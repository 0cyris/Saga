/**
 * Story Maker provider pipeline.
 */

import { sendLoreRequest } from '../providers/lore-llm-client.js';
import {
    assertLoreResponseText,
    createLoreJsonInvalidDiagnostic,
    LORE_RESPONSE_ERROR_CODES,
} from '../providers/lore-response-normalizer.js';
import {
    getStoryOpenerTargetLength,
    normalizeStoryOpenerFailure,
    normalizeStoryOpenerSession,
    normalizeStoryOpenerString,
} from './story-opener-state.js';

const STORY_OPENER_PROVIDER_KIND = 'lore';

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value = [], limit = 80) {
    const input = Array.isArray(value) ? value : [value];
    const out = [];
    const seen = new Set();
    for (const raw of input.flat(Infinity)) {
        if (raw && typeof raw === 'object') continue;
        const text = String(raw || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

function compactPromptJson(value) {
    return JSON.stringify(value, null, 2);
}

function stripReasoningBlocks(text = '') {
    return String(text || '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
}

function stripMarkdownFence(text = '') {
    const clean = stripReasoningBlocks(text).trim();
    const fenced = clean.match(/^```(?:json|text|markdown)?\s*([\s\S]*?)\s*```$/i);
    return (fenced ? fenced[1] : clean).trim();
}

function extractBalancedJsonObject(text = '') {
    const clean = stripMarkdownFence(text);
    const start = clean.indexOf('{');
    if (start < 0) return '';
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = start; index < clean.length; index += 1) {
        const char = clean[index];
        if (escape) {
            escape = false;
            continue;
        }
        if (char === '\\') {
            escape = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return clean.slice(start, index + 1);
        }
    }
    return clean.slice(start);
}

function repairCommonJson(text = '') {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/“|”/g, '"')
        .replace(/‘|’/g, "'")
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
}

export function parseStoryOpenerJsonResponse(text = '') {
    const candidates = [
        stripMarkdownFence(text),
        extractBalancedJsonObject(text),
        repairCommonJson(extractBalancedJsonObject(text)),
    ].filter(Boolean);
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (isPlainObject(parsed)) return { ok: true, value: parsed, repaired: candidate !== candidates[0] };
        } catch (error) {
            lastError = error;
        }
    }
    return {
        ok: false,
        error: lastError?.message || 'Model response was not valid JSON.',
        diagnostic: createLoreJsonInvalidDiagnostic(lastError?.message || 'Model response was not valid JSON.', {
            sample: String(text || '').slice(0, 600),
        }),
    };
}

async function repairStoryOpenerJsonWithProvider(rawText = '', schemaName = 'Story Maker JSON', options = {}) {
    const system = `You repair malformed Saga ${schemaName} responses.
Return valid JSON only. Preserve every usable field. Do not add facts that were not present.`;
    const user = `Repair this malformed response into valid JSON for ${schemaName}.

Malformed response:
${rawText}`;
    const response = await sendLoreRequest(system, user, {
        providerKind: STORY_OPENER_PROVIDER_KIND,
        maxTokens: options.maxTokens || 2048,
        prefill: '{',
        signal: options.signal,
        onProgress: options.onProgress,
    });
    const text = assertLoreResponseText(response, {
        providerTitle: 'Reasoning',
        maxTokens: options.maxTokens || 2048,
    });
    return parseStoryOpenerJsonResponse(`{${String(text || '').replace(/^\s*\{/, '')}`);
}

function normalizeProviderFailure(error = {}, stage = '') {
    const details = isPlainObject(error.details) ? error.details : {};
    const code = normalizeStoryOpenerString(error.code || details.code || '', 160)
        || (error.name === 'LoreJsonParseError' ? 'json_invalid' : 'provider_request_failed');
    let recovery = 'Check the Reasoning Provider settings and retry.';
    if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT || /token/i.test(String(error?.message || ''))) {
        recovery = 'Increase Reasoning Provider Max Tokens or reduce opener scope, then retry this stage.';
    } else if (code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY) {
        recovery = 'Increase max tokens, lower reasoning effort, or use a non-thinking model for visible output.';
    } else if (code === 'json_invalid') {
        recovery = 'Retry this stage. Saga will try to repair malformed JSON first.';
    } else if (/configuration|api key|provider/i.test(String(error?.message || ''))) {
        recovery = 'Review Reasoning Provider configuration in Settings.';
    }
    return normalizeStoryOpenerFailure({
        code,
        stage,
        message: error?.message || String(error || 'Story Maker generation failed.'),
        recovery,
        providerTitle: details.providerTitle || 'Reasoning',
        finishReason: details.finishReason || '',
        maxTokens: details.maxTokens || 0,
        details,
    });
}

function normalizeBrief(value = {}, packet = {}, controls = {}) {
    const raw = isPlainObject(value) ? value : {};
    const targetLength = getStoryOpenerTargetLength(raw.targetLength || controls.targetLength).id;
    const brief = {
        schemaVersion: 1,
        fandoms: uniqueStrings(raw.fandoms || packet.fandoms, 12),
        context: normalizeStoryOpenerString(raw.context || packet.context || controls.context, 2000),
        proseStyle: normalizeStoryOpenerString(raw.proseStyle || controls.proseStyle, 1200),
        openingShape: normalizeStoryOpenerString(raw.openingShape || controls.openingShape, 180),
        characterFocus: normalizeStoryOpenerString(raw.characterFocus || controls.characterFocus, 800),
        pov: normalizeStoryOpenerString(raw.pov || controls.pov, 160),
        tense: normalizeStoryOpenerString(raw.tense || controls.tense, 120),
        targetLength,
        premise: normalizeStoryOpenerString(raw.premise || raw.prompt || controls.userPrompt, 1400),
        styleGuidance: normalizeStoryOpenerString(raw.styleGuidance, 1600),
        lengthGuidance: normalizeStoryOpenerString(raw.lengthGuidance, 900),
        scenePlan: uniqueStrings(raw.scenePlan || raw.beats, 16).slice(0, 12),
        mustInclude: uniqueStrings(raw.mustInclude || raw.include, 32),
        freshEmphasis: uniqueStrings(raw.freshEmphasis || raw.fresh, 20),
        mustAvoid: uniqueStrings(raw.mustAvoid || raw.avoid, 32),
        variantAngles: uniqueStrings(raw.variantAngles || raw.angles, 6),
    };
    const requiredMissing = [];
    for (const key of ['premise', 'styleGuidance']) {
        if (!brief[key]) requiredMissing.push(key);
    }
    if (!brief.scenePlan.length) requiredMissing.push('scenePlan');
    if (!brief.mustInclude.length && (packet.mustUse || []).length) requiredMissing.push('mustInclude');
    return {
        ok: requiredMissing.length === 0,
        brief,
        missing: requiredMissing,
    };
}

function applyFactRefinement(packet = {}, refinement = null) {
    if (!refinement || !isPlainObject(refinement)) return packet;
    const allowedById = new Map([...(packet.mustUse || []), ...(packet.supporting || [])].map(fact => [fact.id, fact]));
    const avoidById = new Map((packet.mustAvoid || []).map(fact => [fact.id, fact]));
    const selectedIds = uniqueStrings(refinement.selectedFactIds, 40);
    const freshIds = uniqueStrings(refinement.freshFactIds, 20);
    const avoidIds = uniqueStrings(refinement.mustAvoidIds, 40);
    const selectedFacts = selectedIds.map(id => allowedById.get(id)).filter(Boolean);
    const freshFacts = freshIds.map(id => allowedById.get(id)).filter(Boolean);
    const avoidFacts = avoidIds.map(id => avoidById.get(id)).filter(Boolean);
    return {
        ...packet,
        mustUse: selectedFacts.length ? selectedFacts : packet.mustUse,
        fresh: freshFacts.length ? freshFacts : packet.fresh,
        mustAvoid: avoidFacts.length ? avoidFacts : packet.mustAvoid,
        providerRefinement: {
            selectedFactIds: selectedFacts.map(fact => fact.id),
            freshFactIds: freshFacts.map(fact => fact.id),
            mustAvoidIds: avoidFacts.map(fact => fact.id),
            rationale: normalizeStoryOpenerString(refinement.rationale, 900),
        },
    };
}

export async function refineStoryOpenerFacts(packet = {}, controls = {}, options = {}) {
    const candidates = [...(packet.mustUse || []), ...(packet.supporting || [])];
    if (!candidates.length || candidates.length <= 18) {
        return { ok: true, packet, skipped: true };
    }
    const system = `You are Saga's Story Maker source selector.
Choose the facts that matter most for one opening scene. Return JSON only.`;
    const user = `Select the highest-value facts for the opener. Use only IDs from the candidate lists.

Return exactly this JSON shape:
{
  "selectedFactIds": ["id"],
  "freshFactIds": ["id"],
  "mustAvoidIds": ["id"],
  "rationale": "one short explanation"
}

Story controls:
${compactPromptJson(controls)}

Context Packet candidates:
${compactPromptJson({
    context: packet.context,
    fandoms: packet.fandoms,
    mustUse: candidates.slice(0, 60).map(fact => ({ id: fact.id, title: fact.title, fact: fact.fact, sourceType: fact.sourceType, score: fact.score, temporalRole: fact.temporalRole, lifecycleStatus: fact.lifecycleStatus })),
    mustAvoid: (packet.mustAvoid || []).slice(0, 45).map(fact => ({ id: fact.id, title: fact.title, fact: fact.fact, lifecycleStatus: fact.lifecycleStatus, reason: fact.lifecycleReason })),
})}`;
    try {
        const response = await sendLoreRequest(system, user, {
            providerKind: STORY_OPENER_PROVIDER_KIND,
            maxTokens: options.maxTokens || 2048,
            prefill: '{',
            signal: options.signal,
            onProgress: options.onProgress,
        });
        const text = assertLoreResponseText(response, {
            providerTitle: 'Reasoning',
            maxTokens: options.maxTokens || 2048,
        });
        let parsed = parseStoryOpenerJsonResponse(text);
        if (!parsed.ok && options.repair !== false) {
            parsed = await repairStoryOpenerJsonWithProvider(text, 'Story Maker Fact Refinement', options);
        }
        if (!parsed.ok) throw new Error(parsed.error || 'Fact refinement JSON could not be parsed.');
        return { ok: true, packet: applyFactRefinement(packet, parsed.value), refinement: parsed.value };
    } catch (error) {
        return {
            ok: false,
            packet,
            failure: normalizeProviderFailure(error, 'context_packet'),
        };
    }
}

function buildBriefPrompt(session = {}, packet = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const controls = normalized.controls;
    const target = getStoryOpenerTargetLength(controls.targetLength);
    const system = `You are Saga's Story Maker prompt architect.
Create a precise writing brief for a later model call. Return JSON only.
Use only the supplied Context Packet facts. Do not introduce unsupported facts.
Respect mustAvoid as hard exclusions. The prose style should evoke fandom-era conventions without copying any passage.`;
    const user = `Build a fantastic opener-writing brief.

Return exactly this JSON shape:
{
  "fandoms": ["fandom"],
  "context": "story position",
  "premise": "what the opener should accomplish",
  "proseStyle": "style instruction",
  "openingShape": "shape instruction",
  "characterFocus": "optional focus",
  "pov": "point of view",
  "tense": "tense",
  "targetLength": "hook|scene|chapter",
  "styleGuidance": "concrete prose guidance",
  "lengthGuidance": "pacing guidance",
  "scenePlan": ["beat"],
  "mustInclude": ["fact summary"],
  "freshEmphasis": ["fresh fact summary"],
  "mustAvoid": ["exclusion"],
  "variantAngles": ["direct/default", "minor alternate angle", "minor alternate angle"]
}

Controls:
${compactPromptJson({
    userPrompt: controls.userPrompt,
    context: controls.context,
    proseStyle: controls.proseStyle,
    openingShape: controls.openingShape,
    characterFocus: controls.characterFocus,
    pov: controls.pov,
    tense: controls.tense,
    targetLength: target,
})}

Context Packet:
${compactPromptJson({
    context: packet.context,
    contextState: packet.contextState,
    fandoms: packet.fandoms,
    fresh: packet.fresh,
    mustUse: packet.mustUse,
    supporting: packet.supporting,
    mustAvoid: packet.mustAvoid,
})}`;
    return { system, user };
}

export async function buildStoryOpenerBrief(session = {}, packet = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const refined = await refineStoryOpenerFacts(packet, normalized.controls, options);
    const effectivePacket = refined.packet || packet;
    const { system, user } = buildBriefPrompt(normalized, effectivePacket);
    try {
        const response = await sendLoreRequest(system, user, {
            providerKind: STORY_OPENER_PROVIDER_KIND,
            maxTokens: options.maxTokens || 4096,
            prefill: '{',
            signal: options.signal,
            onProgress: options.onProgress,
        });
        const text = assertLoreResponseText(response, {
            providerTitle: 'Reasoning',
            maxTokens: options.maxTokens || 4096,
        });
        let parsed = parseStoryOpenerJsonResponse(text);
        let repairAttempted = false;
        if (!parsed.ok && options.repair !== false) {
            repairAttempted = true;
            parsed = await repairStoryOpenerJsonWithProvider(text, 'Story Maker Brief', options);
        }
        if (!parsed.ok) {
            const failure = normalizeStoryOpenerFailure({
                code: 'json_invalid',
                stage: 'opener_brief',
                message: parsed.error || 'Opener Brief response was not valid JSON.',
                recovery: 'Retry Build Opener Brief. If this repeats, increase Reasoning Provider Max Tokens.',
                details: parsed.diagnostic,
            });
            return { ok: false, packet: effectivePacket, failure, rawText: text, repairAttempted };
        }
        const normalizedBrief = normalizeBrief(parsed.value, effectivePacket, normalized.controls);
        if (!normalizedBrief.ok) {
            return {
                ok: false,
                packet: effectivePacket,
                rawText: text,
                repairAttempted,
                failure: normalizeStoryOpenerFailure({
                    code: 'stage_contract_failed',
                    stage: 'opener_brief',
                    message: `Opener Brief JSON omitted required fields: ${normalizedBrief.missing.join(', ')}.`,
                    recovery: 'Retry with a smaller Context Packet or simplify the opener prompt.',
                    details: { missing: normalizedBrief.missing, parsed: parsed.value },
                }),
            };
        }
        return {
            ok: true,
            packet: effectivePacket,
            brief: normalizedBrief.brief,
            rawText: text,
            repairAttempted,
            refinement: refined.refinement || null,
            refinementFailure: refined.failure || null,
        };
    } catch (error) {
        return {
            ok: false,
            packet: effectivePacket,
            failure: normalizeProviderFailure(error, 'opener_brief'),
        };
    }
}

function getTargetLengthGuidance(targetLength = 'scene') {
    if (targetLength === 'hook') return 'Write a compact opener: one scene entry, one strong hook, minimal exposition.';
    if (targetLength === 'chapter') return 'Write a fuller opener: room for atmosphere, character interiority, and two or three scene beats.';
    return 'Write a balanced opener: enough setup and character grounding for a strong first reply without turning into a full chapter.';
}

function buildOpenerPrompt(session = {}, packet = {}, brief = {}, variantIndex = 0, revisionPrompt = '') {
    const normalized = normalizeStoryOpenerSession(session);
    const controls = normalized.controls;
    const selectedAngle = brief.variantAngles?.[variantIndex] || (variantIndex === 0 ? 'direct/default opener' : `minor variation ${variantIndex + 1}`);
    const previous = normalizeStoryOpenerString(normalized.variants.find(variant => variant.id === normalized.selectedVariantId)?.text || normalized.variants[0]?.text || '', 12000);
    const system = `You are Saga's Story Maker writer.
Write only the finished opener prose. Do not include analysis, labels, markdown, JSON, commentary, or title text.
Respect all exclusions. Use only supplied facts. The style may evoke fandom-era prose conventions, but do not copy or quote canon prose.`;
    const user = `Write the opener from this brief.

Variant angle: ${selectedAngle}
Revision instruction: ${revisionPrompt || 'None'}

Length guidance: ${brief.lengthGuidance || getTargetLengthGuidance(controls.targetLength)}

Brief:
${compactPromptJson(brief)}

Hard exclusions:
${compactPromptJson(brief.mustAvoid?.length ? brief.mustAvoid : (packet.mustAvoid || []).map(fact => fact.fact || fact.title))}

Previous opener to revise, if any:
${previous || 'None'}

Output plain opener prose only.`;
    return { system, user };
}

function normalizeOpenerText(text = '') {
    const clean = stripMarkdownFence(text)
        .replace(/^["']([\s\S]*)["']$/m, '$1')
        .trim();
    if (!clean) return '';
    if (/^\s*\{[\s\S]*\}\s*$/.test(clean)) return '';
    if (/^(here(?:'s| is)|sure[,!]|certainly[,!])/i.test(clean)) {
        return clean.replace(/^(here(?:'s| is)[^:\n]*:|sure[,!]\s*|certainly[,!]\s*)/i, '').trim();
    }
    return clean;
}

export async function writeStoryOpenerVariant(session = {}, packet = {}, brief = {}, variantIndex = 0, options = {}) {
    const revisionPrompt = normalizeStoryOpenerString(options.revisionPrompt, 5000);
    const { system, user } = buildOpenerPrompt(session, packet, brief, variantIndex, revisionPrompt);
    try {
        const response = await sendLoreRequest(system, user, {
            providerKind: STORY_OPENER_PROVIDER_KIND,
            maxTokens: options.maxTokens || 4096,
            signal: options.signal,
            onProgress: options.onProgress,
        });
        const rawText = assertLoreResponseText(response, {
            providerTitle: 'Reasoning',
            maxTokens: options.maxTokens || 4096,
        });
        const text = normalizeOpenerText(rawText);
        if (!text) {
            return {
                ok: false,
                rawText,
                failure: normalizeStoryOpenerFailure({
                    code: 'opener_empty_or_rejected',
                    stage: 'draft_variants',
                    message: 'Reasoning Provider returned no usable plain opener text.',
                    recovery: 'Retry Draft Variants; if repeated, lower Target Length or simplify Prose Style.',
                }),
            };
        }
        return {
            ok: true,
            variant: {
                id: `variant-${Date.now().toString(36)}-${variantIndex + 1}`,
                label: `Variant ${String.fromCharCode(65 + variantIndex)}`,
                text,
                prompt: user,
                createdAt: Date.now(),
                status: 'draft',
            },
            rawText,
        };
    } catch (error) {
        return {
            ok: false,
            failure: normalizeProviderFailure(error, 'draft_variants'),
        };
    }
}

export async function writeStoryOpenerVariants(session = {}, packet = {}, brief = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const count = normalized.controls.variantsEnabled ? 3 : 1;
    const tasks = Array.from({ length: count }, (_, index) => writeStoryOpenerVariant(normalized, packet, brief, index, options));
    const results = await Promise.all(tasks);
    const variants = results
        .map((result, index) => result.ok ? ({ ...result.variant, id: `variant-${Date.now().toString(36)}-${index + 1}` }) : null)
        .filter(Boolean);
    const failures = results
        .filter(result => !result.ok)
        .map(result => result.failure)
        .filter(Boolean);
    if (!variants.length) {
        return {
            ok: false,
            variants,
            failures,
            failure: failures[0] || normalizeStoryOpenerFailure({
                code: 'opener_empty_or_rejected',
                stage: 'draft_variants',
                message: 'No opener variants were usable.',
                recovery: 'Retry Draft Variants or simplify the opener controls.',
            }),
        };
    }
    return { ok: true, variants, failures };
}

export const __storyOpenerGenerationTestHooks = Object.freeze({
    parseStoryOpenerJsonResponse,
    normalizeOpenerText,
    normalizeBrief,
});
