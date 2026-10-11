'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');
const boot='  initChannel();\n  if (document.readyState';
assert.ok(src.includes(boot),'safe boot boundary');
function makeSession(pathname,store){
  const body=src.slice(0,src.indexOf(boot))+
    '  window.__QA={state,saveState,projectMode,chooseRoute,projects};\n})();';
  const win={addEventListener:()=>{},removeEventListener:()=>{},innerWidth:900,innerHeight:800};
  const doc={documentElement:{getAttribute:()=>null,setAttribute:()=>{}},getElementById:()=>null,
    querySelectorAll:()=>[],addEventListener:()=>{},readyState:'loading'};
  const mem=new Map(),sessionStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
  vm.runInNewContext(body,{document:doc,window:win,localStorage:store,sessionStorage,
    location:{hostname:'chatgpt.com',pathname,search:''},crypto:{randomUUID:()=>pathname},console}, {timeout:2000});
  return win.__QA;
}
function makeStore(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('old chat preserves its own process and progress while a new chat starts empty',()=>{
  const store=makeStore();
  const a=makeSession('/c/old',store);
  a.state.processId='ACCOUNTING-OLD';a.state.lastPercent=40;a.state.lastNumerator=2;a.state.lastDenominator=5;
  a.state.stalled=3;a.saveState();
  const b=makeSession('/c/new',store);
  assert.equal(b.state.processId,'');
  assert.equal(b.state.lastPercent,null);
  assert.equal(b.projects['ACCOUNTING-OLD'].current_pct,40);
  assert.equal(b.projectMode('ACCOUNTING-OLD').auto,false);
});
test('new chat saves distinct process without contaminating the old chat',()=>{
  const store=makeStore();
  const a=makeSession('/c/old',store);
  a.state.processId='OLD';a.state.lastPercent=40;a.state.lastNumerator=2;a.state.lastDenominator=5;a.state.stalled=3;a.saveState();
  const b=makeSession('/c/new',store);
  b.state.processId='NEW';b.state.lastPercent=20;b.state.lastNumerator=1;b.state.lastDenominator=5;b.saveState();
  const returned=makeSession('/c/old',store);
  assert.equal(returned.state.processId,'OLD');
  assert.equal(returned.state.lastPercent,40);
  assert.equal(returned.state.lastNumerator,2);
  assert.equal(returned.state.stalled,3);
  assert.equal(returned.projects.NEW.current_pct,20);
  assert.equal(returned.chooseRoute(returned.state).mode,'DESTRABAR_CAMBIANDO_ESTRATEGIA');
});
test('rerunning AVANZA preserves stalled history rather than resetting the strategy',()=>{
  assert.doesNotMatch(src,/state\.stalled=0; state\.missingReceipts=0;/);
  assert.match(src,/Manual reactivation must NOT erase/);
});
test('chat-specific decision field and provenance guard are present',()=>{
  assert.match(src,/data-value="decision"/);
  assert.match(src,/function chooseRoute\(signals = \{\}\)/);
  assert.match(src,/COLA→ENTREGA→ACCIÓN→EFECTO/);
  assert.doesNotMatch(src,/GM_xmlhttpRequest|\bfetch\s*\(/);
});
