import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Regression: a process can have a known ID without a defensible percentage.
// The UI may not replace DIEGO-CHAT-DIPLOMACY with "POR RECUPERAR".
const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const get=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0 && b>a,'source block missing '+start);
  return source.slice(a,b);
};
const safeId=value=>String(value||'').replace(/[^A-Za-z0-9._:-]/g,'-').replace(/-+/g,'-').slice(0,96);
const parseReceipt=new Function('safeId',
  get('  function parseReceipt(s) {','  function strategy() {')+'return parseReceipt;')(safeId);
const discoverBody=get('  function discoverVisibleProjects() {',
  '  function latestVisibleReceipt() {');

function check(texts,initial='',autoConsented=false) {
  const state={processId:initial,objective:'',autoConsented,lastPercent:null,
    lastNumerator:null,lastDenominator:null,lastDelta:null,lastStatus:''};
  const projects=initial?{[initial]:{id:initial}}:{};
  let saves=0;
  const document={querySelectorAll:()=>texts.map(innerText=>({innerText}))};
  const fn=new Function('document','parseReceipt','isProvisionalProcessId',
    'safeId','projects','state','saveState','localStorage','PROJECTS_KEY',
    'renderProjects','hydrateVisibleReportedProgress','lastPassiveProgressScan',
    'Date','chatKey',discoverBody+'discoverVisibleProjects();return {state,projects};');
  const result=fn(document,parseReceipt,(id=state.processId)=>/^CHAT-[A-Z0-9]+$/.test(id),
    safeId,projects,state,()=>{saves++;},{setItem(){}},
    'test-projects',()=>{},()=>{},0,Date,'chatgpt.com/c/actual');
  return {...result,saves};
}
test('full userscript compiles',()=>assert.doesNotThrow(()=>new Function(source)));
test('recover process identity from explicitly labeled undeterminable header',()=>{
  const {state}=check(['🧩 PROCESO DIEGO-CHAT-DIPLOMACY | 📈 AVANCE NO DETERMINABLE']);
  assert.equal(state.processId,'DIEGO-CHAT-DIPLOMACY');
  assert.equal(state.lastPercent,null);
  assert.equal(state.lastDenominator,null);
});
test('numeric header retains its existing metrics',()=>{
  const {state}=check(['🧩 PROCESO CFI-E2-2026-10-16 | 📈 AVANCE 15.8%→15.8% | 3/19 gates | Δ 0 pp']);
  assert.equal(state.processId,'CFI-E2-2026-10-16');
  assert.equal(state.lastPercent,15.8);
  assert.equal(state.lastNumerator,3);
  assert.equal(state.lastDenominator,19);
});
test('two different process headers must not auto-claim the chat',()=>{
  const {state}=check([
    '🧩 PROCESO DIEGO-CHAT-DIPLOMACY | 📈 AVANCE NO DETERMINABLE',
    '🧩 PROCESO CFI-E2-2026-10-16 | 📈 AVANCE NO DETERMINABLE']);
  assert.equal(state.processId,'');
});
test('canonical receipt alone recovers identity without fabricated metric',()=>{
  const {state}=check([
    'AVANZA_CONTROL: {"status":"CONTINUE","process_id":"DIEGO-CHAT-DIPLOMACY","current_pct":null,"denominator":null,"delta_pp":null}']);
  assert.equal(state.processId,'DIEGO-CHAT-DIPLOMACY');
  assert.equal(state.lastPercent,null);
});
test('canonical receipt conflicting with header does not rebind',()=>{
  const {state}=check([
    '🧩 PROCESO CFI-E2-2026-10-16 | 📈 AVANCE NO DETERMINABLE',
    'AVANZA_CONTROL: {"status":"CONTINUE","process_id":"DIEGO-CHAT-DIPLOMACY","current_pct":null,"denominator":null,"delta_pp":null}']);
  assert.equal(state.processId,'');
});
test('provisional CHAT-* label is replaced without leaving a phantom project',()=>{
  const {state,projects}=check(
    ['🧩 PROCESO DIEGO-CHAT-DIPLOMACY | 📈 AVANCE NO DETERMINABLE'],'CHAT-TEST');
  assert.equal(state.processId,'DIEGO-CHAT-DIPLOMACY');
  assert.equal(projects['CHAT-TEST'],undefined);
});
test('ordinary assistant prose does not invent an owner',()=>{
  const {state}=check(['El país se llama Cashlandia; todavía no tiene un porcentaje verificable.']);
  assert.equal(state.processId,'');
});

test('recovered identity is durably persisted once',()=>{
  const {state,saves}=check(['🧩 PROCESO CROSS-CHAT-LEARNING | 📈 AVANCE NO DETERMINABLE']);
  assert.equal(state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(saves,1);
});
test('a pre-existing canonical owner rejects a foreign header and disarms AUTO',()=>{
  const {state,saves}=check(['🧩 PROCESO WRONG-OTHER | 📈 AVANCE NO DETERMINABLE'],'CROSS-CHAT-LEARNING',true);
  assert.equal(state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(state.blocker,'PROCESS_ID_CONFLICT');
  assert.equal(state.autoConsented,false);
  assert.equal(saves,1);
});
test('a matching known owner preserves AUTO with no unnecessary writes',()=>{
  const {state,saves}=check(['🧩 PROCESO CROSS-CHAT-LEARNING | 📈 AVANCE NO DETERMINABLE'],'CROSS-CHAT-LEARNING',true);
  assert.equal(state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(state.blocker,undefined);
  assert.equal(state.autoConsented,true);
  assert.equal(saves,0);
});
test('multiple visible owners block a previously known AUTO owner',()=>{
  const {state,saves}=check([
    '🧩 PROCESO CROSS-CHAT-LEARNING | 📈 AVANCE NO DETERMINABLE',
    '🧩 PROCESO WRONG-OTHER | 📈 AVANCE NO DETERMINABLE'
  ],'CROSS-CHAT-LEARNING',true);
  assert.equal(state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(state.blocker,'PROCESS_ID_CONFLICT');
  assert.equal(state.autoConsented,false);
  assert.equal(saves,1);
});
