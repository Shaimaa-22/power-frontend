import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestApi } from '../public/admin-api.js';
import { element, imageUrl } from '../public/admin-dom.js';

test('admin API rejects every failing status, including upload failures, and malformed successes', async t => {
  let status=200; let unauthorized=0;
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:'safe error'}),{status,headers:{'Content-Type':'application/json'}}));
  for(status of [400,401,403,404,409,413,422,429,500]) {
    await assert.rejects(requestApi('/api/items',{},()=>unauthorized++),error=>error.status===status);
  }
  assert.equal(unauthorized,1);
  globalThis.fetch=async()=>new Response('<html>not JSON</html>',{status:200});
  await assert.rejects(requestApi('/api/items'),/غير صالحة/);
});

test('admin database text stays literal and image filenames cannot become remote/HTML URLs', t => {
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,className:'',textContent:''})};
  t.after(()=>{globalThis.document=previous;});
  const payload='<img src=x onerror=alert(1)>';
  assert.equal(element('span','',payload).textContent,payload);
  assert.equal(imageUrl('https://api.example','https://evil.example/a.png'),null);
  assert.equal(imageUrl('https://api.example','../x'),null);
  assert.match(imageUrl('https://api.example','a" onerror="x.png'),/^https:\/\/api\.example\/images\/a%22/);
  const script=readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
  assert.doesNotMatch(script,/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
});
