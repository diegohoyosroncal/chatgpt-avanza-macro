import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');

test('4.9 candidate keeps stable established-chat route identity',()=>{
  assert.ok(source.includes('const pathKey = location.hostname + location.pathname;'));
  assert.ok(source.includes("if (/(?:^|\\/)c\\/[A-Za-z0-9_-]{12,}(?:\\/|$)/.test(location.pathname)) return pathKey;"));
});

test('4.9 candidate preserves generic inactive-owner gates',()=>{
  assert.match(source,/INACTIVE_PROCESS_STATUSES = new Set\(\['ARCHIVED','ARCHIVED_READ_ONLY','FROZEN','DISABLED'\]\)/);
  assert.match(source,/function isInactiveProcess\(id\)/);
  assert.match(source,/LOCKED_PROCESS_IDS\.has\(id\) \|\| isInactiveProcess\(id\)/);
});

test('conflicting visible owners fail closed',()=>{
  assert.match(source,/state\.blocker='PROCESS_ID_CONFLICT'/);
  assert.match(source,/if \(state\.blocker==='PROCESS_ID_CONFLICT' \|\| state\.blocker==='PROCESS_ID_UNRESOLVED'\) return false;/);
});

test('unanswered AVANZA cycle blocks a second synthetic send',()=>{
  assert.match(source,/function unansweredMacroCycle\(\)/);
  assert.match(source,/if \(unansweredMacroCycle\(\)\) return false;/);
  assert.match(source,/Ya hay un AVANZA sin respuesta en este chat; no duplico envíos/);
});

test('manual AVANZAR cannot reactivate inactive owners',()=>{
  assert.match(source,/no se reactiva desde AVANZAR/);
});

test('one-shot bootstrap returns canonical adoption path without inheriting provisional numbers',()=>{
  const a=source.indexOf('      const wasProvisional=provisionalProcessId();');
  const b=source.indexOf('      const previousObjective = state.objective;',a);
  assert.ok(a>0&&b>a,'canonical owner adoption source exists');
  const state={processId:'CHAT-TEMP',objective:'unknown chat',lastPercent:90,
    lastDenominator:10,lastNumerator:9,lastDelta:0,blocker:''};
  const projects={'CHAT-TEMP':{id:'CHAT-TEMP'}};
  const receipt={processId:'AVANZA-MACRO'};
  new Function('state','projects','receipt','provisionalProcessId',source.slice(a,b))(
    state,projects,receipt,()=>/^CHAT-/.test(state.processId));
  assert.equal(state.processId,'AVANZA-MACRO');
  assert.equal(state.lastPercent,null);
  assert.equal(state.lastDenominator,null);
  assert.equal(state.objective,'');
  assert.equal(projects['CHAT-TEMP'],undefined);
});

test('identity conflict remains blocking and terminal guard halts retry',()=>{
  assert.match(source,/state\.processId!==receipt\.processId \? 'PROCESS_ID_CONFLICT'/);
  assert.match(source,/pause\('PROCESS_ID_CONFLICT: recibos de propietarios distintos/);
  assert.match(source,/pause\('PROCESS_ID pendiente: identificación sin recibo canónico/);
  assert.match(source,/function provisionalProcessId/);
  assert.match(source,/if \(provisionalProcessId\(\)\) \{/);
  assert.match(source,/state\.autoConsented=false;/);
});
