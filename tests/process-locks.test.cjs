'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');
function slice(start,end){const i=source.indexOf(start),j=source.indexOf(end,i+start.length);assert.ok(i>=0, 'missing '+start);assert.ok(j>i, 'missing '+end);return source.slice(i,j);}
test('new source parses as JavaScript without running a browser',()=>assert.doesNotThrow(()=>new vm.Script(source)));
test('archived BTS and frozen AUGMENTED are distinctly locked',()=>{
  assert.match(source,/LOCKED_PROCESS_IDS = new Set\(\['BTS-LIMA','AUGMENTED-LEARNING'\]\)/);
  assert.match(source,/id === 'AUGMENTED-LEARNING' \? 'FROZEN' : 'ARCHIVED'/);
});
test('read + save persist canonical archived and frozen status',()=>{
  assert.match(slice('function readProjects()','function saveProjects()'),/status:lockedStatus\(id\)/);
  assert.match(slice('function saveProjects()','function safeId('),/status:lockedStatus\(id\)/);
});
test('individual project mode cannot reenable locked process',()=>{
  assert.match(slice('function setProjectMode(','function seedProjects()'),/if \(!id \|\| LOCKED_PROCESS_IDS.has\(id\)\) return;/);
});
test('manual button cannot arm an archived or frozen process',()=>{
  const b=slice('function toggle()','// PASSIVE, READ-ONLY');
  assert.match(b,/if \(LOCKED_PROCESS_IDS.has\(id\)\)/);
  assert.ok(b.indexOf('LOCKED_PROCESS_IDS.has(id)') < b.indexOf('state.autoConsented=true'));
});
test('send path checks lock before composer mutation',()=>{
  const b=slice('async function deliver(step)','async function tick()');
  assert.match(b,/if \(LOCKED_PROCESS_IDS.has\(projectKey\(\)\)\)/);
  assert.ok(b.indexOf('LOCKED_PROCESS_IDS.has(projectKey())') < b.indexOf('fillComposer('));
});
test('tick checks lock before next send',()=>{
  const b=slice('async function tick()','function toggle()');
  assert.match(b,/if \(LOCKED_PROCESS_IDS.has\(projectKey\(\)\)\)/);
  assert.ok(b.indexOf('LOCKED_PROCESS_IDS.has(projectKey())') < b.indexOf('await deliver('));
});
test('existing button/send layout assertions remain compatible',()=>{
  assert.match(source,/function toggle\(\) \{\s*syncRoute\(\);\s*if \(checkConflicts\(\)\) return;/);
  assert.match(source,/async function deliver\(step\) \{\s*if \(checkConflicts\(\) \|\| !moduleOn\('engine'\)\) return;/);
});
