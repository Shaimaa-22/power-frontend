import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesProduct } from '../src/lib/product-search.js';

test('product search matches multilingual names, partial names and unordered words', () => {
  const product = { title_ar: 'إطار أبيض LIPER', title_en: 'White Frame LIPER', title_he: 'מסגרת לבנה' };
  for (const query of ['اطار', 'أَبْيَض', '  WHITE  liper ', 'liper frame', 'מסגרת']) {
    assert.ok(matchesProduct(product, query), query);
  }
  assert.equal(matchesProduct(product, 'solar'), false);
  assert.equal(matchesProduct(product, 'white solar'), false);
  assert.equal(matchesProduct({}, 'frame'), false);
  assert.equal(matchesProduct(product, '   '), true);
});
