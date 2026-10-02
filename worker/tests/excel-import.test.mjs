import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolveImportService } from '../public/admin-import-service.js';

const source = readFileSync(new URL('../public/admin.js', import.meta.url), 'utf8');
function parser(currentServiceSlug = 'solar-energy') {
  const context = vm.createContext({ resolveImportService, currentServiceSlug,
    SERVICES: ['industrial-electricity', 'residential-electricity', 'solar-energy', 'iot-smart-solutions'].map(slug => ({ slug })) });
  vm.runInContext(source.slice(source.indexOf('const COLUMN_ALIASES'), source.indexOf('function renderImportPreview')), context);
  return context.normalizeImportRow;
}
const product = {
  'الخدمة في الموقع': 'الكهرباء المنزلية', 'الخدمة - عربي': 'الكهرباء المنزلية',
  'Service - English': 'Residential Electrical', 'שירות - עברית': 'חשמל ביתי',
  'الفئة - عربي': 'الإطارات والحوامل', 'Category - English': 'Frames & Supports', 'קטגוריה - עברית': 'מסגרות ותושבות',
  'اسم المنتج - عربي': 'إطار مفرد', 'Product Name - English': 'Single Frame', 'שם המוצר - עברית': 'מסגרת',
};

test('workbook multilingual service columns route each row independently of the selected tab', () => {
  const normalize = parser();
  const residential = normalize(product, 5);
  assert.equal(residential.service_slug, 'residential-electricity');
  assert.equal(residential.errors.length, 0);
  assert.equal(residential.category_en, 'Frames & Supports');
  assert.equal(residential.rowNumber, 5);
  const industrial = normalize({ ...product, 'الخدمة في الموقع': 'الكهرباء الصناعية',
    'الخدمة - عربي': 'الكهرباء الصناعية', 'Service - English': 'Industrial Electrical', 'שירות - עברית': 'חשמל תעשייתי' }, 102);
  assert.equal(industrial.service_slug, 'industrial-electricity');
  assert.equal(industrial.errors.length, 0);
});

test('all four slugs and individual translated columns resolve; blank columns do not mask values', () => {
  for (const slug of ['industrial-electricity', 'residential-electricity', 'solar-energy', 'iot-smart-solutions']) {
    assert.equal(resolveImportService({ service_slug: slug }).slug, slug);
  }
  assert.equal(resolveImportService({ service_slug: '', 'الخدمة في الموقع': ' الكهرباء المنزلية ' }).slug, 'residential-electricity');
  assert.equal(resolveImportService({ 'Service - English': 'Industrial Electrical' }).slug, 'industrial-electricity');
  assert.equal(resolveImportService({ 'שירות - עברית': 'חשמל ביתי' }).slug, 'residential-electricity');
});

test('missing, unknown or contradictory service values block import instead of selecting the open service', () => {
  for (const row of [{}, { service: 'unknown' }, { service_slug: 'solar-energy', 'الخدمة في الموقع': 'الكهرباء المنزلية' }]) {
    assert.ok(resolveImportService(row).error);
    assert.equal(resolveImportService(row).slug, '');
  }
  const row = parser()({ title_ar: 'منتج' }, 7);
  assert.equal(row.service_slug, '');
  assert.ok(row.errors.length);
});

test('same category name in different services produces separate category IDs and cached lookups', async () => {
  const calls = [];
  const context = vm.createContext({
    API_BASE: '', serviceIdBySlug: { 'residential-electricity': 2, 'industrial-electricity': 1 },
    authHeaders: () => ({}), responseRows: async () => [],
    apiFetch: async (url, options) => {
      calls.push({ url, options });
      return { json: async () => ({ id: JSON.parse(options.body).service_id * 10 }) };
    },
  });
  vm.runInContext(source.slice(source.indexOf('async function ensureImportCategory('), source.indexOf("$('confirmImportBtn').onclick")), context);
  const cache = new Map();
  const row = { category_ar: 'مشترك', category_en: 'Shared', category_he: 'משותף', service_slug: 'residential-electricity' };
  assert.equal(await context.ensureImportCategory(row, cache), 20);
  assert.equal(await context.ensureImportCategory({ ...row, service_slug: 'industrial-electricity' }, cache), 10);
  assert.equal(await context.ensureImportCategory(row, cache), 20);
  assert.equal(calls.length, 4);
});

// Optional private workbook extraction: exercise the actual normalizer without publishing source data in fixtures.
if (process.env.POWER_IMPORT_ROWS) test('the supplied 98-product workbook keeps all categories and image row associations', () => {
  const data = JSON.parse(readFileSync(process.env.POWER_IMPORT_ROWS, 'utf8'));
  const normalize = parser();
  const rows = data.rows.map(entry => normalize(entry.data, entry.rowNumber));
  assert.equal(rows.length, 98);
  assert.equal(rows.filter(row => row.service_slug === 'residential-electricity').length, 89);
  assert.equal(rows.filter(row => row.service_slug === 'industrial-electricity').length, 9);
  assert.equal(new Set(rows.map(row => `${row.service_slug}/${row.category_ar}`)).size, 13);
  for (const row of rows) {
    assert.equal(row.errors.length, 0, `Excel row ${row.rowNumber}: ${row.errors.join(', ')}`);
    assert.equal(data.imageRows.filter(number => number === row.rowNumber).length, 1);
  }
});
