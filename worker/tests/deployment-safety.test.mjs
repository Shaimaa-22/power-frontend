import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('ambiguous remote scripts invoke a local refusal, with no Wrangler subprocess',()=>{
  for(const name of ['deploy','db:init:remote','db:migrate:remote'])assert.equal(pkg.scripts[name],'node scripts/require-explicit-target.mjs');
  const guard=fileURLToPath(new URL('../scripts/require-explicit-target.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[guard],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/Ambiguous remote command disabled/);
});

test('explicit commands pin the config and resource name without executing them',()=>{
  assert.equal(pkg.scripts['deploy:production'],'wrangler deploy --config wrangler.jsonc --name power-api');
  assert.equal(pkg.scripts['deploy:preview'],'wrangler deploy --config wrangler.preview.jsonc --name power-preview-20260924');
  assert.equal(pkg.scripts['db:migrate:production'],'wrangler d1 migrations apply power-db --remote --config wrangler.jsonc');
  assert.equal(pkg.scripts['db:migrate:preview'],'wrangler d1 migrations apply power-preview-20260924-db --remote --config wrangler.preview.jsonc');
});
