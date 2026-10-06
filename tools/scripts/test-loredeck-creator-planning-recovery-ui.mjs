import assert from 'node:assert/strict';
import { configureLoredeckCreatorPanel, createLoredeckCreatorPlanningCard } from '../../src/loredecks/loredeck-creator-panel.js';

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.disabled = false;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); },
      remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
    };
  }
  set textContent(text) { this.text = String(text); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName.toLowerCase() === selector) ? [child] : [],
      ...child.querySelectorAll(selector),
    ]);
  }
  async click() {
    assert.equal(this.disabled, false);
    for (const handler of this.listeners.click || []) handler({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
  }
}
globalThis.document = { createElement: tag => new Element(tag) };

const batches = ['stranded', 'pending', 'accepted'].map(id => ({ id, label: id, approvedTitleCount: 1 }));
const cached = {
  jobId: 'recovery-project', generatedPackId: 'recovery-pack', brief: { title: 'Recovery' },
  planningBatchQueuedIds: batches.map(batch => batch.id), planningBatchAcceptedIds: ['accepted'],
  titleDrafts: batches.map(batch => ({ titleId: batch.id, title: batch.id, creatorTitleBatchId: batch.id })),
  approvedTitleDraftIds: batches.map(batch => batch.id),
};
const pack = {
  packId: cached.generatedPackId, type: 'generated', manifestData: { id: cached.generatedPackId },
  pendingChanges: [{ source: 'loredeck_creator', targetKind: 'tag', preview: { creatorPlanningBatch: { id: 'pending' } } }],
};
const draftCalls = [];
configureLoredeckCreatorPanel({
  getLoredeckCreatorBriefCache: () => cached,
  getLoredeckCreatorPlanningBatchRows: () => batches,
  getLoredeckCreatorPlanningQueuedBatchIds: () => new Set(cached.planningBatchQueuedIds),
  getLoredeckCreatorPlanningAcceptedBatchIds: () => new Set(cached.planningBatchAcceptedIds),
  getLoredeckCreatorPlanningPendingBatchIds: current => new Set((current.pendingChanges || []).map(change => change.preview.creatorPlanningBatch.id)),
  getLoredeckCreatorNextPlanningBatch: () => null,
  getLoredeckCreatorApprovedTitleIds: () => new Set(cached.approvedTitleDraftIds),
  getLoredeckDefinition: () => pack,
  countLoredeckCreatorPlanningPendingChanges: () => pack.pendingChanges.length,
  handleLoredeckCreatorPlanningDraft: async options => { draftCalls.push(options); },
});

const card = createLoredeckCreatorPlanningCard(cached.brief, cached);
const rows = card.querySelectorAll('.saga-loredeck-creator-title-batch-row');
const recovery = rows[0].querySelectorAll('button').find(button => button.textContent === 'Re-plan This Set');
assert.ok(recovery, 'A queued batch whose proposals disappeared must offer targeted regeneration.');
assert.equal(rows[1].querySelectorAll('button').some(button => button.textContent === 'Re-plan This Set'), false);
assert.equal(rows[2].querySelectorAll('button').some(button => button.textContent === 'Re-plan This Set'), false);
assert.ok(rows[1].textContent.includes('Awaiting Review'));
assert.ok(rows[2].textContent.includes('Accepted'));
await recovery.click();
assert.equal(draftCalls[0].targetPlanningBatch.id, 'stranded');
assert.equal(draftCalls[0].replan, true);

const primaryRecovery = card.querySelectorAll('button').find(button => button.textContent === 'Re-plan Context and Tags');
assert.ok(primaryRecovery, 'The main Context Plan action must offer recovery instead of declaring stranded sets complete.');
await primaryRecovery.click();
assert.equal(draftCalls[1].targetPlanningBatch.id, 'stranded');
assert.equal(draftCalls[1].replan, true);

delete pack.manifestData;
const loadingCard = createLoredeckCreatorPlanningCard(cached.brief, cached);
assert.equal(loadingCard.querySelectorAll('button').some(button => button.textContent.startsWith('Re-plan')), false, 'Do not classify unloaded payloads as lost proposals.');

console.log('Deck Maker planning recovery UI tests passed.');
