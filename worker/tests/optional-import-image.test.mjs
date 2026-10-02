import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const start=source.indexOf('      importRows.forEach(row => {',source.indexOf('// ربط كل منتج بصورة صفه الحقيقي'));
const validation=source.slice(start,source.indexOf('      renderImportPreview();',start));
test('Excel permits source products without photos and still rejects invalid supplied photos',()=>{
 assert.ok(start>0);
 const rows=[2,3,4,5].map(rowNumber=>({rowNumber,errors:[]}));
 const images=new Map([[3,{file:{size:100,type:'image/png'}}],[4,{file:{size:6*1024*1024,type:'image/png'}}],[5,{file:{size:100,type:'text/html'}}]]);
 vm.runInNewContext(validation,{importRows:rows,excelImages:images});
 assert.equal(rows[0].image,null);assert.deepEqual(rows[0].errors,[]);
 assert.deepEqual(rows[1].errors,[]);assert.equal(rows[2].errors.length,1);assert.equal(rows[3].errors.length,1);
});
