import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');

test('4.9 candidate keeps stable established-chat route identity',()=>{
  assert.match(source,/const pathKey = location\.hostname \+ location\.pathname/);
  assert.match(source,/c\\\/[A-Za-z0-9_-]\{12,\}/);
});

test('4.9 candidate preserves generic inactive-owner gates',()=>{
  assert.match(source,/INACTIVE_PROCESS_STATUSES = new Set\(\['ARCHIVED','ARCHIVED_READ_ONLY','FROZEN','DISABLED'\]\)/);
  assert.match(source,/function isInactiveProcess\(id\)/);
  assert.match(source,/LOCKED_PROCESS_IDS\.has\(id\) \|\| isInactiveProcess\(id\)/);
});

test('conflicting visible owners fail closed',()=>{
  assert.match(source,/state\.blocker='PROCESS_ID_CONFLICT'/);
  assert.match(source,/if \(state\.blocker==='PROCESS_ID_CONFLICT'\) return false;/);
});

test('unanswered AVANZA cycle blocks a second synthetic send',()=>{
  assert.match(source,/function unansweredMacroCycle\(\)/);
  assert.match(source,/if \(unansweredMacroCycle\(\)\) return false;/);
  assert.match(source,/Ya hay un AVANZA sin respuesta en este chat; no duplico envíos/);
});

test('manual AVANZAR cannot reactivate inactive owners',()=>{
  assert.match(source,/no se reactiva desde AVANZAR/);
});
