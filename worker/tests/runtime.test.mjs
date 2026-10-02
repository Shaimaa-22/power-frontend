import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
// These runtime tools are already pinned by Wrangler; no additional test framework.
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { schema, migration, png, testPassword } from './helpers.mjs';
import { hashPassword } from '../src/lib/password.js';

test('real workerd: migration, 100k PBKDF2 login/reset, D1, B2 mock, assets, cache and rate-limit binding', { timeout: 120000 }, async t => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const bundle = await build({ absWorkingDir: root, entryPoints:['src/index.js'], bundle:true, write:false,
    format:'esm', platform:'browser', conditions:['workerd','worker','browser'], logLevel:'silent' });
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name:'power-api', modules:true, script:bundle.outputFiles[0].text, compatibilityDate:'2025-09-01',
    d1Databases:['DB'], assets:{directory:fileURLToPath(new URL('../public',import.meta.url)),routerConfig:{has_user_worker:true}},
    bindings:{JWT_SECRET:crypto.randomUUID()+crypto.randomUUID(),PBKDF2_ITERATIONS:'100000',STORAGE_DRIVER:'b2',
      B2_ENDPOINT:'s3.example.invalid',B2_REGION:'test',B2_BUCKET_NAME:'test',B2_KEY_ID:'test-only',B2_APPLICATION_KEY:'test-only'},
    ratelimits:{AUTH_RATE_LIMITER:{namespace_id:'10051001',simple:{limit:10,period:60}}},
    // No outbound request can reach a real B2 bucket in this test.
    outboundService: async request => {
      assert.equal(new URL(request.url).hostname,'s3.example.invalid');
      if(request.method==='GET')return new Response(png,{headers:{'Content-Type':'image/png',ETag:'"fixture"','Last-Modified':'Wed, 01 Jan 2025 00:00:00 GMT'}});
      return new Response(null,{status:200});
    },
  }] }));
  t.after(()=>mf.dispose());
  const {DB}=await mf.getBindings('power-api');
  const statements=(schema+'\n'+migration).replace(/^\s*--.*$/gm,'').split(/;\s*(?=(?:CREATE|ALTER|INSERT)\b)/i).map(s=>s.trim()).filter(Boolean);
  for(const sql of statements) await DB.prepare(sql).run();
  await DB.prepare('INSERT INTO admins(email,password_hash) VALUES (?,?)').bind('runtime@example.com',await hashPassword(testPassword)).run();
  const request=(path,init={})=>mf.dispatchFetch('http://localhost'+path,init);
  const login=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'runtime@example.com',password:testPassword})});
  assert.equal(login.status,200);const {token}=await login.json();
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  assert.equal((await request('/api/admins',{headers})).status,200);
  const category=await request('/api/categories',{method:'POST',headers,body:JSON.stringify({service_id:1,name_ar:'a',name_en:'e',name_he:'h'})});
  assert.equal(category.status,201);
  const categoryRow = await category.json();
  for (const [name,mime] of [['valid.jpg','image/jpeg'],['valid.png','image/png'],['valid.webp','image/webp'],['valid.gif','image/gif'],['valid.avif','image/avif'],['truncated.jpg','image/jpeg']]) {
    const form = new FormData();
    for (const [key,value] of Object.entries({category_id:String(categoryRow.id),title_ar:'a',title_en:'e',title_he:'h'})) form.append(key,value);
    const bytes = name === 'truncated.jpg' ? new Uint8Array([255,216,255]) : readFileSync(new URL('./fixtures/'+name,import.meta.url));
    form.append('image',new File([bytes],name,{type:mime}));
    // Node and Miniflare have distinct FormData implementations. Send actual HTTP bytes.
    const encoded = new Request('http://localhost/api/items',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
    const uploaded = await request('/api/items',{method:'POST',headers:Object.fromEntries(encoded.headers),body:await encoded.arrayBuffer()});
    assert.equal(uploaded.status,name==='truncated.jpg'?400:201,name);
  }
  const asset=await request('/admin');assert.equal(asset.status,200);assert.match(await asset.text(),/admin\.js/);
  assert.equal(asset.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await request('/admin-api.js')).status,200);
  const image=await request('/images/fixture.png?ignored=1');assert.equal(image.status,200);await image.arrayBuffer();
  const notModified=await request('/images/fixture.png',{headers:{'If-None-Match':'"fixture"'}});assert.equal(notModified.status,304);
  const precondition=await request('/images/fixture.png',{headers:{'If-Match':'"wrong"'}});assert.equal(precondition.status,412);
  const reset=await request('/api/auth/password',{method:'POST',headers,body:JSON.stringify({current_password:testPassword,new_password:'new local test passphrase'})});
  assert.equal(reset.status,200);assert.equal((await request('/api/admins',{headers})).status,401);
  let throttled=false;
  for(let i=0;i<12;i++){
    const r=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'runtime@example.com',password:'wrong'})});
    if(r.status===429){throttled=true;break;}assert.equal(r.status,401);
  }
  assert.equal(throttled,true);
});
