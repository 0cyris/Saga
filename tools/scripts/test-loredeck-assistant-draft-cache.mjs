import assert from 'node:assert/strict';
import {
  createLoredeckAssistantDraftCacheController,
} from '../../src/runtime/loredeck-assistant-draft-cache.js';

const getDraftChanges = record => Array.isArray(record?.draftChanges)
  ? record.draftChanges.filter(change => change?.changeId)
  : [];

{
  const controller = createLoredeckAssistantDraftCacheController({
    getDraftChanges,
    countQualityWarnings: changes => changes.filter(change => change.warning).length,
  });

  assert.deepEqual(controller.getRecord('missing-pack'), {});
  assert.deepEqual(controller.setRecord(' pack-one ', { draftChanges: [{ changeId: 'a' }] }), { draftChanges: [{ changeId: 'a' }] });
  assert.deepEqual(controller.getRecord('pack-one'), { draftChanges: [{ changeId: 'a' }] });
  assert.equal(controller.deleteRecord(' pack-one '), true);
  assert.deepEqual(controller.getRecord('pack-one'), {});
}

{
  const controller = createLoredeckAssistantDraftCacheController({ getDraftChanges });
  const record = {
    draftChanges: [{ changeId: 'a' }, { changeId: 'b' }],
  };
  assert.deepEqual([...controller.getSelectedDraftIds(record)], ['a', 'b'], 'Missing selection should default to every draft.');
  assert.deepEqual(
    [...controller.getSelectedDraftIds({ ...record, selectedDraftChangeIds: ['b', 'missing', 'b', ''] })],
    ['b'],
    'Explicit selection should be deduped and limited to valid draft ids.',
  );
}

{
  const controller = createLoredeckAssistantDraftCacheController({
    getDraftChanges,
    countQualityWarnings: changes => changes.filter(change => change.warning).length,
  });
  controller.setRecord('pack-one', {
    draftChanges: [{ changeId: 'a' }, { changeId: 'b', warning: true }],
  });

  const selected = controller.setDraftSelection('pack-one', 'a', false);
  assert.deepEqual(selected.selectedDraftChangeIds, ['b']);
  assert.equal(selected.qualityWarningCount, 1);

  const cleared = controller.setDraftSelectionBulk('pack-one', 'none');
  assert.deepEqual(cleared.selectedDraftChangeIds, []);

  const all = controller.setDraftSelectionBulk('pack-one', 'all');
  assert.deepEqual(all.selectedDraftChangeIds, ['a', 'b']);
}

{
  const controller = createLoredeckAssistantDraftCacheController({
    getDraftChanges,
    countQualityWarnings: changes => changes.length,
  });
  controller.setRecord('pack-one', {
    draftChanges: [{ changeId: 'a' }],
    selectedDraftChangeIds: ['a'],
  });

  const emptied = controller.updateRecord('pack-one', current => ({
    ...current,
    draftChanges: [],
    selectedDraftChangeIds: ['a'],
  }));
  assert.equal(Object.prototype.hasOwnProperty.call(emptied, 'draftChanges'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(emptied, 'selectedDraftChangeIds'), false);
  assert.equal(emptied.qualityWarningCount, 0);
}

console.log('Loredeck assistant draft cache controller tests passed.');
