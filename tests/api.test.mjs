import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveApiBase, resolveBuildApiBase, PRODUCTION_API_ORIGIN } from '../src/api/base.js';
import { createApi } from '../src/api/http-client.js';
import { loadServiceContent } from '../src/api/service-content.js';
import { safeDecode } from '../src/lib/url.js';

test('production requires an HTTPS origin; local dev uses the Worker port',()=>{
  assert.equal(resolveApiBase('',true),'http://localhost:8787');
  assert.equal(resolveApiBase('https://api.example.com/'),'https://api.example.com');
  for(const value of ['', 'http://api.example.com','https://localhost:8787','https://api.example.com/api','https://user:password@api.example.com','https://api.example.com?x=1'])assert.throws(()=>resolveApiBase(value));
});

test('production build pins the real Worker; Preview requires explicit mode',()=>{
  const preview='https://power-preview-20260924.power-elec.workers.dev';
  assert.equal(resolveBuildApiBase(PRODUCTION_API_ORIGIN),PRODUCTION_API_ORIGIN);
  assert.equal(resolveBuildApiBase(preview,'preview'),preview);
  for(const value of [preview,'https://api.example.invalid','http://localhost:8787',''])assert.throws(()=>resolveBuildApiBase(value));
  assert.throws(()=>resolveBuildApiBase(preview,'prodution'));
});

test('API rejects failures, HTML fallback, malformed JSON and malformed row shapes',async()=>{
  for(const status of [400,401,403,404,409,413,422,500]){
    const api=createApi('https://api.example',async()=>new Response('{}',{status,headers:{'Content-Type':'application/json'}}));
    await assert.rejects(api.categoriesByService('solar-energy'),new RegExp(String(status)));
  }
  for(const [body,type] of [['<html/>','text/html'],['{','application/json'],['{}','application/json'],['[{}]','application/json']]){
    const api=createApi('https://api.example',async()=>new Response(body,{headers:{'Content-Type':type}}));
    await assert.rejects(api.categoriesByService('solar-energy'));
  }
  const offline=createApi('https://api.example',async()=>{throw new TypeError('offline');});
  await assert.rejects(offline.categoriesByService('x'),/offline/);
});

test('API builds paths once and accepts empty collections',async()=>{
  let requested;
  const api=createApi('https://api.example',async url=>{requested=url;return new Response('[]',{headers:{'Content-Type':'application/json'}});});
  assert.deepEqual(await api.categoriesByService('solar-energy'),[]);
  assert.equal(requested,'https://api.example/api/categories/service/solar-energy');
  assert.equal(api.imageUrl('name with space.png'),'https://api.example/images/name%20with%20space.png');
});

test('partial category failures retain successful data and concurrency stays bounded',async()=>{
  let active=0,max=0;
  const api={categoriesByService:async()=>Array.from({length:8},(_,i)=>({id:i+1})),itemsByCategory:async id=>{
    max=Math.max(max,++active);await new Promise(resolve=>setTimeout(resolve,2));active--;
    if(id===2)throw new Error('network');return [{id}];
  }};
  const result=await loadServiceContent(api,'solar');
  assert.equal(result.partial,true);assert.equal(result.categories[1].loadError,true);
  assert.equal(result.categories[0].items[0].id,1);assert.equal(result.categories.length,8);assert.ok(max<=3);
});

test('empty services stay empty; cancelled requests do not become partial data',async()=>{
  assert.deepEqual(await loadServiceContent({categoriesByService:async()=>[]},'empty'),{categories:[],partial:false});
  const c=new AbortController();c.abort();
  await assert.rejects(loadServiceContent({categoriesByService:async()=>[{id:1}]},'x',c.signal));
});

test('malformed URL encoding cannot throw and Pages SPA fallback remains present',()=>{
  assert.equal(safeDecode('%E0%A4%A'),null);assert.equal(safeDecode('%ZZ'),null);
  assert.equal(safeDecode('solar-energy'),'solar-energy');
  const redirects=readFileSync(new URL('../public/_redirects',import.meta.url),'utf8');
  assert.match(redirects,/\/\*\s+\/index\.html\s+200/);
});
