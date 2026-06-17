export function isLoredeckCreatorParsedArtifactUsable(parsed = null, artifactKey = '') {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    if (artifactKey && parsed[artifactKey]) return true;
    return Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0;
}

export function hasLoredeckCreatorClarifyingQuestions(parsed = null) {
    return Array.isArray(parsed?.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0;
}

export function createLoredeckCreatorStageValidationFailure(code = 'creator_stage_contract_failed', message = 'Deck Maker response did not match the expected stage contract.') {
    return {
        ok: false,
        code,
        message,
    };
}

export function validateLoredeckCreatorArtifactResult(parsed = null, artifactKey = '', label = 'artifact') {
    if (isLoredeckCreatorParsedArtifactUsable(parsed, artifactKey)) return true;
    return createLoredeckCreatorStageValidationFailure(
        `creator_${artifactKey || 'artifact'}_missing`,
        `Valid JSON returned no usable Deck Maker ${label}.`
    );
}

export function isLoredeckCreatorParsedTitlePassUsable(parsed = null) {
    return !!parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && ((Array.isArray(parsed.titleDrafts) && parsed.titleDrafts.length > 0)
            || hasLoredeckCreatorClarifyingQuestions(parsed));
}

export function validateLoredeckCreatorTitlePassResult(parsed = null) {
    if (isLoredeckCreatorParsedTitlePassUsable(parsed)) return true;
    return createLoredeckCreatorStageValidationFailure(
        'creator_title_pass_no_title_drafts',
        'Valid JSON returned no usable Deck Maker title drafts.'
    );
}

const LOREDECK_CREATOR_PLANNING_ACTIONS = new Set([
    'upsert_tag_definition',
    'upsert_timeline_anchor',
    'upsert_timeline_window',
]);

export function isLoredeckCreatorPlanningProposal(proposal = {}) {
    return LOREDECK_CREATOR_PLANNING_ACTIONS.has(String(proposal?.action || '').trim());
}

export function isLoredeckCreatorParsedPlanningUsable(parsed = null) {
    return validateLoredeckCreatorPlanningResult(parsed) === true;
}

export function validateLoredeckCreatorPlanningResult(parsed = null) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return createLoredeckCreatorStageValidationFailure(
            'creator_planning_invalid_result',
            'Deck Maker Context and Tag planning returned no usable JSON object.'
        );
    }
    if (hasLoredeckCreatorClarifyingQuestions(parsed)) return true;
    const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    if (proposals.some(isLoredeckCreatorPlanningProposal)) return true;
    if (proposals.length) {
        return createLoredeckCreatorStageValidationFailure(
            'creator_planning_no_supported_actions',
            'Valid JSON returned no supported Context or Tag planning proposals.'
        );
    }
    return createLoredeckCreatorStageValidationFailure(
        'creator_planning_no_proposals',
        'Valid JSON returned no Context or Tag planning proposals.'
    );
}

export function isLoredeckCreatorEntryDraftProposal(proposal = {}) {
    return String(proposal?.action || '').trim() === 'upsert_entry';
}

export function isLoredeckCreatorParsedEntryDraftUsable(parsed = null) {
    return validateLoredeckCreatorEntryDraftResult(parsed) === true;
}

export function validateLoredeckCreatorEntryDraftResult(parsed = null) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return createLoredeckCreatorStageValidationFailure(
            'creator_entry_draft_invalid_result',
            'Deck Maker Lorecard drafting returned no usable JSON object.'
        );
    }
    if (hasLoredeckCreatorClarifyingQuestions(parsed)) return true;
    const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    if (proposals.some(isLoredeckCreatorEntryDraftProposal)) return true;
    if (proposals.length) {
        return createLoredeckCreatorStageValidationFailure(
            'creator_entry_draft_no_supported_actions',
            'Valid JSON returned no supported Deck Maker Lorecard draft proposals.'
        );
    }
    return createLoredeckCreatorStageValidationFailure(
        'creator_entry_draft_no_proposals',
        'Valid JSON returned no Deck Maker Lorecard draft proposals.'
    );
}
