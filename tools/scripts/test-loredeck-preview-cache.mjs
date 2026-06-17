import assert from 'node:assert/strict';
import {
  createLoredeckPreviewCacheController,
} from '../../src/runtime/loredeck-preview-cache.js';

{
  const controller = createLoredeckPreviewCacheController();

  assert.equal(controller.getManifestPreview('missing'), null);
  assert.deepEqual(controller.setManifestPreview(' pack-one ', { manifest: { id: 'pack-one' }, health: { status: 'ok' } }), {
    manifest: { id: 'pack-one' },
    health: { status: 'ok' },
  });
  assert.deepEqual(controller.getManifestPreview('pack-one').manifest, { id: 'pack-one' });
  assert.deepEqual(controller.getManifestHealth('pack-one'), { status: 'ok' });
  assert.equal(controller.deleteManifestPreview('pack-one'), true);
  assert.equal(controller.getManifestPreview('pack-one'), null);
}

{
  const controller = createLoredeckPreviewCacheController();
  controller.setEntryPreview('pack-one', { entries: [{ id: 'entry-one' }] });
  controller.setTimelineRegistry('pack-one', { sourceRegistry: { anchors: { start: {} } } });
  controller.setTagRegistry('pack-one', { sourceRegistry: { tags: { hero: {} } } });

  assert.deepEqual(controller.getEntryPreview('pack-one').entries, [{ id: 'entry-one' }]);
  assert.deepEqual(Object.keys(controller.getTimelineRegistry('pack-one').sourceRegistry.anchors), ['start']);
  assert.deepEqual(Object.keys(controller.getTagRegistry('pack-one').sourceRegistry.tags), ['hero']);

  assert.equal(controller.deleteEntryPreview('pack-one'), true);
  assert.equal(controller.deleteTimelineRegistry('pack-one'), true);
  assert.equal(controller.deleteTagRegistry('pack-one'), true);
  assert.equal(controller.getEntryPreview('pack-one'), null);
  assert.equal(controller.getTimelineRegistry('pack-one'), null);
  assert.equal(controller.getTagRegistry('pack-one'), null);
}

{
  const clearedDrafts = [];
  const controller = createLoredeckPreviewCacheController({
    clearDraftCache: packId => clearedDrafts.push(packId),
  });
  controller.setManifestPreview('pack-one', { manifest: {} });
  controller.setEntryPreview('pack-one', { entries: [] });
  controller.setTimelineRegistry('pack-one', { sourceRegistry: {} });
  controller.setTagRegistry('pack-one', { sourceRegistry: {} });

  assert.equal(controller.clearPackCaches('pack-one', { clearDraftCache: true }), true);
  assert.equal(controller.getManifestPreview('pack-one'), null);
  assert.equal(controller.getEntryPreview('pack-one'), null);
  assert.equal(controller.getTimelineRegistry('pack-one'), null);
  assert.equal(controller.getTagRegistry('pack-one'), null);
  assert.deepEqual(clearedDrafts, ['pack-one']);

  assert.equal(controller.clearPackCaches('pack-one'), false);
  assert.equal(controller.clearPackCaches('', { clearDraftCache: true }), false);
  assert.deepEqual(clearedDrafts, ['pack-one']);
}

console.log('Loredeck preview cache controller tests passed.');
