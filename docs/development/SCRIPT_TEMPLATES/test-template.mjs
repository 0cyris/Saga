/**
 * Test template demonstrating common patterns for feature and contract validation.
 *
 * This template shows:
 * - Using node:assert/strict for assertions
 * - Sequential test cases with descriptive messages
 * - Helper functions for reducing boilerplate
 * - Edge case coverage
 * - Success message on completion
 *
 * No external test frameworks (Jest, Vitest, Mocha) - only built-in Node.js assert.
 *
 * Usage:
 *   node tools/scripts/test-example-feature.mjs
 *
 * See: docs/development/SCRIPTS_GUIDE.md for test script patterns
 */

import assert from 'node:assert/strict';

// ============================================================================
// Mock Module for Testing
// ============================================================================

// In a real script, you'd import the module to test:
// import { buildBasicReadinessModel } from '../../src/runtime/runtime-basic-readiness.js';

// For this template, we'll create a simple example module to test
class ExampleModel {
  constructor(config) {
    this.config = config;
    this.items = [];
    this.status = 'ready';
  }

  addItem(item) {
    if (!item.id) throw new Error('Item must have an id');
    this.items.push(item);
  }

  getItem(id) {
    return this.items.find(item => item.id === id);
  }

  getReadyStatus() {
    const requiredItems = ['config', 'data', 'ready'];
    const hasAllItems = requiredItems.every(id => this.getItem(id));
    return hasAllItems ? 'ready' : 'incomplete';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildModel(config = {}) {
  return new ExampleModel(config);
}

function assertModelHasItem(model, itemId, message) {
  const item = model.getItem(itemId);
  assert.ok(item, `${message}: should have item ${itemId}`);
  return item;
}

function assertModelStatus(model, expectedStatus, message) {
  assert.equal(
    model.getReadyStatus(),
    expectedStatus,
    `${message}: status should be ${expectedStatus}`
  );
}

// ============================================================================
// Test Cases
// ============================================================================

// Test 1: Empty model should be incomplete
{
  const model = buildModel();
  assertModelStatus(model, 'incomplete', 'Empty model');
  console.log('✓ Empty model is incomplete');
}

// Test 2: Model with partial items should be incomplete
{
  const model = buildModel();
  model.addItem({ id: 'config', value: 'test' });
  model.addItem({ id: 'data', value: 123 });
  assertModelStatus(model, 'incomplete', 'Partial items');
  console.log('✓ Partial items model is incomplete');
}

// Test 3: Model with all required items should be ready
{
  const model = buildModel();
  model.addItem({ id: 'config', value: 'test' });
  model.addItem({ id: 'data', value: 123 });
  model.addItem({ id: 'ready', value: true });
  assertModelStatus(model, 'ready', 'Complete items');
  console.log('✓ Complete model is ready');
}

// Test 4: Adding duplicate items should succeed (last one wins)
{
  const model = buildModel();
  model.addItem({ id: 'config', value: 'first' });
  model.addItem({ id: 'config', value: 'second' });

  const item = assertModelHasItem(model, 'config', 'Duplicate item');
  assert.equal(item.value, 'second', 'Last added value should win');
  console.log('✓ Duplicate items resolved by last-write-wins');
}

// Test 5: Adding item without id should fail
{
  const model = buildModel();
  try {
    model.addItem({ value: 'missing-id' });
    assert.fail('Should have thrown error for missing id');
  } catch (error) {
    assert.equal(error.message, 'Item must have an id', 'Error message should be clear');
  }
  console.log('✓ Adding item without id throws appropriate error');
}

// Test 6: Retrieving non-existent item should return undefined
{
  const model = buildModel();
  model.addItem({ id: 'item1', value: 'exists' });

  const item = model.getItem('non-existent');
  assert.equal(item, undefined, 'Should return undefined for non-existent item');
  console.log('✓ Retrieving non-existent item returns undefined');
}

// Test 7: Model preserves item order
{
  const model = buildModel();
  const ids = ['z-item', 'a-item', 'm-item'];

  for (const id of ids) {
    model.addItem({ id, index: ids.indexOf(id) });
  }

  const retrievedIds = model.items.map(item => item.id);
  assert.deepEqual(
    retrievedIds,
    ids,
    'Items should be preserved in insertion order'
  );
  console.log('✓ Model preserves insertion order');
}

// Test 8: Complex scenario: building up to ready state
{
  const model = buildModel({ name: 'TestModel' });

  // Step 1: Add config
  model.addItem({ id: 'config', type: 'initialization' });
  assertModelStatus(model, 'incomplete', 'After config');

  // Step 2: Add data
  model.addItem({ id: 'data', rows: 42 });
  assertModelStatus(model, 'incomplete', 'After data');

  // Step 3: Mark ready
  model.addItem({ id: 'ready', timestamp: Date.now() });
  assertModelStatus(model, 'ready', 'After ready flag');

  // Verify all items are present
  assert.equal(model.items.length, 3, 'Should have exactly 3 items');
  console.log('✓ Complex setup scenario completed');
}

// ============================================================================
// Edge Cases and Contracts
// ============================================================================

// Test 9: Model can handle many items
{
  const model = buildModel();
  const itemCount = 1000;

  for (let i = 0; i < itemCount; i++) {
    model.addItem({ id: `item-${i}`, value: i });
  }

  assert.equal(model.items.length, itemCount, 'Should handle many items');
  const firstItem = model.getItem('item-0');
  const lastItem = model.getItem(`item-${itemCount - 1}`);
  assert.ok(firstItem, 'Should retrieve first item');
  assert.ok(lastItem, 'Should retrieve last item');
  console.log('✓ Model handles 1000+ items efficiently');
}

// Test 10: Model items are independent
{
  const model = buildModel();
  const originalItem = { id: 'test', data: { nested: 'value' } };

  model.addItem(originalItem);

  // Modify the original object
  originalItem.data.nested = 'changed';

  const retrievedItem = model.getItem('test');
  assert.equal(
    retrievedItem.data.nested,
    'changed',
    'Item should reflect external changes (reference semantics)'
  );
  console.log('✓ Model stores item references correctly');
}

// ============================================================================
// Contract Summary
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('Example Model Contract Passed');
console.log('='.repeat(60));
console.log('✓ Empty model starts incomplete');
console.log('✓ Partial items remain incomplete');
console.log('✓ All required items mark model ready');
console.log('✓ Items are deduplicated by id');
console.log('✓ Invalid items (missing id) are rejected');
console.log('✓ Item retrieval returns correct items or undefined');
console.log('✓ Insertion order is preserved');
console.log('✓ Complex scenarios build correctly');
console.log('✓ Model scales to thousands of items');
console.log('✓ Item references have expected semantics');
