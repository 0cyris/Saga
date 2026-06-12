import assert from 'node:assert/strict';
import {
  LORE_RESPONSE_ERROR_CODES,
  LORE_PARSE_ERROR_CODES,
  annotateLoreJsonInvalidError,
  assertLoreResponseText,
  collectLoreResponseFinishReasons,
  createLoreJsonInvalidDiagnostic,
  createLoreResponseError,
  describeLoreResponse,
  extractLoreContentText,
  extractLoreResponseReasoning,
  extractLoreResponseText,
  getLoreResponseFailure,
  isLoreResponseTokenLimitFinishReason,
} from '../../src/providers/lore-response-normalizer.js';

const jsonText = '{"summary":"ok","proposals":[]}';

assert.equal(extractLoreResponseText({
  choices: [{ message: { content: jsonText }, finish_reason: 'stop' }],
}), jsonText);

assert.equal(extractLoreResponseText({
  message: { content: jsonText },
}), jsonText);

assert.equal(extractLoreResponseText({
  content: [{ type: 'text', text: '{"summary":"' }, { type: 'text', text: 'ok"}' }],
}), '{"summary":"ok"}');

assert.equal(extractLoreResponseText({
  text: jsonText,
}), jsonText);

assert.equal(extractLoreResponseText({
  summary: 'direct Saga-shaped object',
  clarifyingQuestions: [],
  proposals: [],
}), '{"summary":"direct Saga-shaped object","clarifyingQuestions":[],"proposals":[]}');

assert.equal(extractLoreContentText([
  { type: 'text', text: 'alpha' },
  { content: [{ text: ' beta' }, { value: ' gamma' }] },
]), 'alpha beta gamma');

const reasoningOnly = {
  choices: [{
    message: {
      content: '',
      reasoning: 'hidden reasoning preview',
    },
    finish_reason: 'stop',
  }],
};
assert.equal(extractLoreResponseText(reasoningOnly), '');
assert.equal(extractLoreResponseReasoning(reasoningOnly), 'hidden reasoning preview');
const reasoningFailure = getLoreResponseFailure(reasoningOnly, { providerTitle: 'Lore', retried: true });
assert.equal(reasoningFailure.code, LORE_RESPONSE_ERROR_CODES.REASONING_ONLY);
assert.equal(reasoningFailure.reasoningPreview, 'hidden reasoning preview');
assert.match(reasoningFailure.message, /reasoning-only output/);

const tokenLimited = {
  choices: [{
    message: { content: '{"summary":"partial"' },
    finish_reason: 'length',
  }],
};
assert.deepEqual(collectLoreResponseFinishReasons(tokenLimited), ['length']);
assert.equal(isLoreResponseTokenLimitFinishReason('length'), true);
assert.equal(isLoreResponseTokenLimitFinishReason('max_completion_tokens'), true);
assert.equal(isLoreResponseTokenLimitFinishReason('stop'), false);
const tokenFailure = getLoreResponseFailure(tokenLimited, { providerTitle: 'Lore', maxTokens: 2048 });
assert.equal(tokenFailure.code, LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT);
assert.equal(tokenFailure.finishReason, 'length');
assert.match(tokenFailure.message, /max 2048/);
const tokenError = createLoreResponseError(tokenFailure);
assert.equal(tokenError.name, 'LoreResponseError');
assert.equal(tokenError.code, LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT);
assert.equal(tokenError.details.finishReason, 'length');
assert.throws(
  () => assertLoreResponseText(tokenLimited, { providerTitle: 'Lore', maxTokens: 2048 }),
  error => error?.code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT,
);

const described = describeLoreResponse(tokenLimited, { sampleLimit: 12 });
assert.equal(described.resultType, 'object');
assert.equal(described.finishReason, 'length');
assert.equal(described.visibleContentLength, 20);
assert.equal(described.sample, '{"summary":"');
assert.equal(assertLoreResponseText({ choices: [{ message: { content: jsonText } }] }, { providerTitle: 'Lore' }), jsonText);
assert.equal(getLoreResponseFailure('', { providerTitle: 'Lore' }).code, LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT);
const parseDiagnostic = createLoreJsonInvalidDiagnostic('Fixture parser failed.', { visibleContentLength: 10 });
assert.equal(parseDiagnostic.code, LORE_PARSE_ERROR_CODES.JSON_INVALID);
assert.equal(parseDiagnostic.visibleContentLength, 10);
const parseError = annotateLoreJsonInvalidError(new SyntaxError('Unexpected end of JSON input'), 'Fixture parser failed.');
assert.equal(parseError.name, 'SyntaxError');
assert.equal(parseError.code, LORE_PARSE_ERROR_CODES.JSON_INVALID);

console.log('Lore response normalizer tests passed.');
