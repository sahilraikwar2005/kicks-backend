import test from 'node:test';
import assert from 'node:assert/strict';
import {
  colorKey,
  comboKey,
  dedupeColors,
  distinctColors,
  distinctSizes,
  normalizeColorName,
  orderMatrixRows,
  sizeKey,
  syncMatrixRows,
} from '../kicks-frontend/src/utils/variantMatrix.js';

const makeRow = (size, color) => ({ size, color, stock: 0 });

test('color normalization collapses case and whitespace variants', () => {
  assert.equal(normalizeColorName('  BLACK  '), 'BLACK');
  assert.equal(colorKey('Black'), colorKey('black'));
  assert.equal(colorKey(' BLACK '), colorKey('black'));
  assert.equal(sizeKey('UK 5'), sizeKey('uk 5'));
  assert.equal(comboKey('UK 5', 'Black'), comboKey('uk 5', 'BLACK'));
  assert.notEqual(comboKey('UK 5', 'Black'), comboKey('UK 5', 'White'));
});

test('dedupeColors keeps first casing and drops empties', () => {
  assert.deepEqual(dedupeColors(['Black', 'black', ' BLACK ', '', 'White', 'white']), ['Black', 'White']);
  assert.deepEqual(dedupeColors([]), []);
  assert.deepEqual(dedupeColors(null), []);
});

test('syncMatrixRows builds the full Size x Color matrix', () => {
  const rows = syncMatrixRows({ rows: [], sizes: ['UK 5', 'UK 6', 'UK 7'], colors: ['Black', 'White'], makeRow });
  assert.equal(rows.length, 6);
  const combos = new Set(rows.map((row) => comboKey(row.size, row.color)));
  assert.equal(combos.size, 6);
  assert.ok(combos.has(comboKey('UK 5', 'White')));
  assert.ok(combos.has(comboKey('UK 7', 'Black')));
});

test('syncMatrixRows preserves existing rows and adds only missing combos', () => {
  const existing = [
    { size: 'UK 5', color: 'Black', stock: 6 },
    { size: 'UK 6', color: 'Black', stock: 5 },
  ];
  const rows = syncMatrixRows({ rows: existing, sizes: ['UK 5', 'UK 6'], colors: ['Black', 'White'], makeRow });
  assert.equal(rows.length, 4);
  assert.equal(rows.find((row) => comboKey(row.size, row.color) === comboKey('UK 5', 'Black')).stock, 6);
  assert.equal(rows.find((row) => comboKey(row.size, row.color) === comboKey('UK 6', 'Black')).stock, 5);
  assert.equal(rows.find((row) => comboKey(row.size, row.color) === comboKey('UK 5', 'White')).stock, 0);
  // Idempotent: syncing again adds nothing.
  assert.equal(syncMatrixRows({ rows, sizes: ['UK 5', 'UK 6'], colors: ['Black', 'White'], makeRow }).length, 4);
});

test('syncMatrixRows treats same color different casing as one combination', () => {
  const rows = syncMatrixRows({
    rows: [{ size: 'UK 5', color: 'Black', stock: 6 }],
    sizes: ['UK 5'],
    colors: ['black'],
    makeRow,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].stock, 6);
});

test('distinct helpers read sizes and colors from rows', () => {
  const rows = [
    { size: 'UK 5', color: 'Black' },
    { size: 'UK 5', color: 'White' },
    { size: 'UK 6', color: 'Black' },
  ];
  assert.deepEqual(distinctSizes(rows), ['UK 5', 'UK 6']);
  assert.deepEqual(distinctColors(rows), ['Black', 'White']);
});

test('orderMatrixRows sorts by size order then color order', () => {
  const rows = [
    { size: 'UK 6', color: 'White' },
    { size: 'UK 5', color: 'White' },
    { size: 'UK 5', color: 'Black' },
  ];
  const ordered = orderMatrixRows(rows, ['UK 5', 'UK 6', 'UK 7'], ['Black', 'White']);
  assert.deepEqual(ordered.map((row) => `${row.size}/${row.color}`), ['UK 5/Black', 'UK 5/White', 'UK 6/White']);
});
