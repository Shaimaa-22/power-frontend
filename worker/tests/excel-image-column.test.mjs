import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function normalizedKey('),source.indexOf('function cell('))+source.slice(source.indexOf('function excelImageColumn('),source.indexOf('async function extractExcelImages(')),context);
test('image heading determines its column across new and legacy Excel templates',()=>{
 assert.equal(context.excelImageColumn(['الصورة','الرقم','اسم المنتج - عربي']),0);
 assert.equal(context.excelImageColumn(['#','الصورة','الرقم']),1);
 assert.equal(context.excelImageColumn(['SKU','Name',' PHOTO ']),2);
 assert.equal(context.excelImageColumn(['SKU','תמונה']),1);
 assert.equal(context.excelImageColumn(['SKU','Name']),1);
});

test('Excel used ranges after A1 retain absolute image column and row coordinates',()=>{
 const start=source.indexOf('      const rows =',source.indexOf('// نقرأ الشيت كمصفوفة'));
 assert.ok(start>0);
 const readRows=source.slice(start,source.indexOf('      if (!rows.length)',start));
 let options;
 vm.runInNewContext(readRows,{sheet:{'!ref':'B5:S103'},XLSX:{utils:{decode_range:()=>({s:{r:4,c:1},e:{r:102,c:18}}),sheet_to_json:(_sheet,opts)=>{options=opts;return [];}}}});
 assert.equal(options.range.s.r,0);
 assert.equal(options.range.s.c,0);
 assert.equal(options.range.e.r,102);
 assert.equal(options.range.e.c,18);
});
