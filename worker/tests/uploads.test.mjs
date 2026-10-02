import test from 'node:test';
import assert from 'node:assert/strict';
import { readLimitedBody } from '../src/lib/http.js';
import { validateImage, MAX_IMAGE_BYTES } from '../src/lib/images.js';
import { runCleanup } from '../src/lib/cleanup.js';
import { conditionalStatus } from '../src/lib/conditional.js';
import { app } from '../src/index.js';
import { signToken } from '../src/lib/auth.js';
import { fixture, png, schema, migration } from './helpers.mjs';
import { DatabaseSync } from 'node:sqlite';
import { getStorage } from '../src/lib/storage.js';

test('body limit counts bytes with missing or false Content-Length and cancels input', async () => {
  for (const declared of [null, '1']) {
    let cancelled = false;
    const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(8)); }, cancel() { cancelled=true; } });
    const request = new Request('https://test.invalid', { method:'POST', body:stream, duplex:'half', headers: declared ? {'Content-Length':declared}:{} });
    await assert.rejects(readLimitedBody(request, 10), error => error.status===413);
    assert.equal(cancelled, true);
  }
  assert.equal((await readLimitedBody(new Request('https://test.invalid', { method:'POST', body:'ok' }), 10)).length, 2);
});

test('image signatures accept PNG and reject spoofed types, SVG and oversized images', async () => {
  assert.equal(await validateImage(new File([png], 'a.png', {type:'image/png'})), null);
  assert.notEqual(await validateImage(new File(['<script>alert(1)</script>'], 'a.png', {type:'image/png'})), null);
  assert.notEqual(await validateImage(new File([png], 'a.jpg', {type:'image/jpeg'})), null);
  assert.notEqual(await validateImage(new File(['<svg/>'], 'a.svg', {type:'image/svg+xml'})), null);
  assert.notEqual(await validateImage(new File([new Uint8Array(MAX_IMAGE_BYTES+1)], 'a.png', {type:'image/png'})), null);
});

test('uploads use UUID names, commit atomically, reject stale edits and cascade cleanup', async t => {
  const f = fixture(t); const admin = await f.seed(); const token = await signToken(f.env, admin);
  const calls=[];
  t.mock.method(globalThis, 'fetch', async request => { calls.push(request.method); return new Response(null,{status:200}); });
  f.sqlite.exec("INSERT INTO categories(service_id,name_ar,name_en,name_he) VALUES (1,'a','e','h')");
  const form = () => { const b=new FormData(); for(const [k,v] of Object.entries({category_id:'1',title_ar:'a',title_en:'e',title_he:'h'})) b.append(k,v); b.append('image',new File([png],'image.png',{type:'image/png'}));return b; };
  const response = await app.request('/api/items',{method:'POST',headers:{Authorization:'Bearer '+token},body:form()},f.env,f.ctx);
  assert.equal(response.status,201); const item=await response.json();
  assert.match(item.image_url,/^[a-f0-9-]{36}\.png$/); assert.equal(item.image_storage,'b2');
  await f.flush(); assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup').get().n,0);
  const edit=form(); edit.append('version','0');
  assert.equal((await app.request('/api/items/'+item.id,{method:'PUT',headers:{Authorization:'Bearer '+token},body:edit},f.env,f.ctx)).status,200);
  await f.flush();
  const stale=form();stale.append('version','0');
  assert.equal((await app.request('/api/items/'+item.id,{method:'PUT',headers:{Authorization:'Bearer '+token},body:stale},f.env,f.ctx)).status,409);
  assert.equal((await app.request('/api/categories/1',{method:'DELETE',headers:{Authorization:'Bearer '+token}},f.env,f.ctx)).status,200);
  await f.flush(); assert.equal(f.sqlite.prepare('SELECT count(*) n FROM items').get().n,0);
  assert.equal(calls.filter(method=>method==='PUT').length,2); assert.equal(calls.filter(method=>method==='DELETE').length,2);
});

test('D1 cleanup persists large cascades, processes only ten, retries failures and skips live references', async t => {
  const f=fixture(t);
  f.sqlite.exec("INSERT INTO categories(service_id,name_ar,name_en,name_he) VALUES (1,'a','e','h')");
  const insert=f.sqlite.prepare("INSERT INTO items(category_id,title_ar,title_en,title_he,image_url) VALUES (1,'a','e','h',?)");
  for(let i=0;i<30;i++)insert.run('old-'+i+'.png');
  f.sqlite.exec('DELETE FROM categories WHERE id=1');
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup').get().n,30);
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status:200});});
  assert.equal(await runCleanup(f.env),10);assert.equal(calls,10);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup').get().n,20);
  globalThis.fetch=async()=>new Response(null,{status:500});
  await runCleanup(f.env);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup').get().n,20);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup WHERE attempts=1 AND lease IS NULL').get().n,10);
});

test('migration preserves existing hashes/content and cleanup never deletes a live image', async t => {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec(schema);
  db.exec("INSERT INTO admins(email,password_hash) VALUES ('legacy@example.com','unchanged'); INSERT INTO categories(service_id,name_ar,name_en,name_he) VALUES(1,'a','e','h'); INSERT INTO items(category_id,title_ar,title_en,title_he,image_url) VALUES(1,'a','e','h','old.png');");
  db.exec(migration);
  assert.equal(db.prepare('SELECT password_hash FROM admins').get().password_hash,'unchanged');
  assert.equal(db.prepare('SELECT image_url FROM items').get().image_url,'old.png');
  const f=fixture(t);
  f.sqlite.exec("INSERT INTO categories(service_id,name_ar,name_en,name_he) VALUES(1,'a','e','h'); INSERT INTO items(category_id,title_ar,title_en,title_he,image_url) VALUES(1,'a','e','h','live.png'); INSERT INTO image_cleanup(filename,storage_driver) VALUES('live.png','b2');");
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('Must not delete live image');});
  await runCleanup(f.env);assert.equal(calls,0);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM image_cleanup').get().n,0);
});

test('R2 stays optional; its deletes are chunked and no conditional failure is mislabeled 304', async () => {
  const chunks=[];
  const storage=getStorage({STORAGE_DRIVER:'r2',IMAGES:{delete:async keys=>chunks.push(keys.length)}});
  await storage.delete(Array.from({length:2001},(_,i)=>String(i)));
  assert.deepEqual(chunks,[1000,1000,1]);
  assert.throws(()=>getStorage({STORAGE_DRIVER:'typo'}));
});

test('security migration is deliberately one-shot; repeated ALTER fails without losing existing rows', async t => {
  const f=fixture(t);await f.seed();
  assert.throws(()=>f.sqlite.exec(migration),/duplicate column name.*token_version/i);
  assert.equal(f.sqlite.prepare('SELECT count(*) n FROM admins').get().n,1);
  const triggers=f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(r=>r.name).sort();
  assert.deepEqual(triggers,['admins_revoke_sessions','items_cleanup_delete','items_cleanup_update']);
});

test('conditional request precedence produces 304 or 412 correctly', () => {
  const meta=new Headers({etag:'"v1"','last-modified':'Wed, 01 Jan 2025 00:00:00 GMT'});
  const status=h=>conditionalStatus(new Headers(h),meta);
  assert.equal(status({'if-none-match':'W/"v1"'}),304);
  assert.equal(status({'if-match':'"other"','if-none-match':'"v1"'}),412);
  assert.equal(status({'if-match':'W/"v1"'}),412);
  assert.equal(status({'if-unmodified-since':'Tue, 01 Jan 2019 00:00:00 GMT'}),412);
  assert.equal(status({'if-modified-since':'Thu, 01 Jan 2026 00:00:00 GMT'}),304);
  assert.equal(status({'if-none-match':'"other"','if-modified-since':'Thu, 01 Jan 2026 00:00:00 GMT'}),200);
});
