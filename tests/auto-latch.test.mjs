import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const section=(first,last)=>{
  const a=source.indexOf(first),b=source.indexOf(last,a);
  assert.ok(a>=0&&b>a,'missing source section '+first);
  return source.slice(a,b);
};

test('complete user script parses without side effects',()=>{
  assert.doesNotThrow(()=>new Function(source));
});

function makeAuto(input={},env={}){
  const state={autoConsented:false,inFlightTicket:'',parkFingerprint:'',parkSince:0,retryAfter:0,stalled:4,missingReceipts:2,lastPercent:40,lastStatus:'',processId:'',...input};
  let saves=0;
  const fn=new Function('state','moduleOn','checkConflicts','isGenerating','discoverVisibleProjects','projectKey','projectMode','learningFor','draft','findComposer','EXIT','lastVisibleAssistantFingerprint','pageBaselineAssistantFingerprint','fallbackProcessId','routeSettleUntil','routeHadGeneration','saveState','now',section('  function shouldAutoStart() {','  function maybeAutoStart() {')+'return shouldAutoStart;')(
    state,()=>true,()=>false,()=>false,()=>{ if(state.projectId&&!state.processId) state.processId=state.projectId; },()=>state.projectId||state.processId||'',()=>({enabled:true,auto:true}),
    ()=>null,()=>'',()=>null,new Set(['VERIFIED_COMPLETE','NO_SAFE_ACTION','HUMAN_GATE_PROVEN']),()=>state.newFingerprint||'old',env.pageBaseline??'old',()=> 'CHAT-TEST',env.routeSettleUntil??0,false,()=>{saves++;},()=>Date.now());
  return {start:fn(),state,saves};
}
test('AUTO resumes recognized processes and bootstraps only after a new assistant response',()=>{
  assert.equal(makeAuto().start,false); // old untagged chat merely opened
  const fresh=makeAuto({newFingerprint:'new'},{pageBaseline:'old'});
  assert.equal(fresh.start,true);
  assert.equal(fresh.state.processId,'CHAT-TEST');
  assert.equal(fresh.state.autoConsented,true);
  assert.equal(makeAuto({processId:'BUSINESS'}).start,true);
  assert.equal(makeAuto({projectId:'BUSINESS'}).start,true);
  assert.equal(makeAuto({autoConsented:true}).start,true);
});
test('pending unique ticket blocks duplicate action on reload',()=>{
  assert.equal(makeAuto({autoConsented:true,inFlightTicket:'AVZ4-unique'}).start,false);
  assert.ok(source.indexOf('state.inFlightTicket=ticket')<source.indexOf('liveSend.click();'));
  assert.match(source,/restoreOutstanding\(\)/);
});
test('legacy parked chats migrate back into continuity and deep review rotates strategy',()=>{
  const woke=makeAuto({processId:'BUSINESS',parkFingerprint:'old'});
  assert.equal(woke.start,true);
  assert.equal(woke.state.parkFingerprint,'');
  assert.equal(woke.saves,1);
  assert.match(source,/state\.stalled > MAX_STALLED_CYCLES/);
  assert.match(source,/ROTAR_CAPACIDAD_Y_REABRIR_UNIVERSO/);
  assert.doesNotMatch(section('  async function tick() {','  function toggle() {'),/parkUnproductiveLoop\(\)/);
});
test('completion remains terminal while recognized unfinished processes resume',()=>{
  assert.equal(makeAuto({autoConsented:true,lastStatus:'VERIFIED_COMPLETE'}).start,false);
  assert.equal(makeAuto({processId:'BUSINESS'}).start,true);
});
test('domain-specific learning instructions do not leak to business chats',()=>{
  const sourcePart=section('  function buildMessage(ticket, step) {','  function setStatus(');
  const message=(learning)=>new Function('state','strategy','MARK','RECEIPT','looksLearningProcess','MAX_STALLED_CYCLES',sourcePart+'return buildMessage;')(
    {processId:'',stalled:4,missingReceipts:0,lastPercent:null,lastDenominator:null,lastDelta:null},()=> 'REVISAR_RUTA_Y_CAMBIAR_ESTRATEGIA','AVANZA','AVANZA_CICLO_ID:',()=>learning,6)('TEST',1);
  assert.doesNotMatch(message(false),/LEARN QUEST:|CFI\/APRENDIZAJE:/);
  assert.match(message(true),/LEARN QUEST:/);
  assert.match(message(false),/NO reemplaza objetivo/);
  assert.match(message(false),/AUDITORÍA DE ESTANCAMIENTO:/);
});
test('continuity separates chat resumption from scheduled tasks',()=>{
  assert.match(source,/continuidad conversacional ≠ tareas programadas ≠ ejecución externa/);
  assert.match(source,/Tasks únicamente para un evento realmente futuro\/periódico\/condicional/);
  assert.doesNotMatch(section('  async function tick() {','  function toggle() {'),/parkUnproductiveLoop\(\)/);
  assert.doesNotMatch(source,/USER_INTERRUPTED[^\n]*autoConsented=false/);
});

test('only one active chat writer and no shell/network API introduced',()=>{
  assert.match(source,/function acquireLease\(\)/);
  assert.match(source,/return SESSION_PREFIX \+ chatKey/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/GM_xmlhttpRequest/);
  assert.match(source,/button\.textContent = active \? '■  AUTO ACTIVO · DETENER'/);
});

test('boot snapshots the current assistant so opening an old untagged chat stays passive',()=>{
  assert.match(source,/pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint\(\);/);
  assert.match(source,/latestFingerprint !== pageBaselineAssistantFingerprint/);
  assert.match(source,/state\.processId = fallbackProcessId\(\)/);
});

test('SPA route settle suppresses accidental bootstrap while navigating old chats',()=>{
  const settling=makeAuto({newFingerprint:'new'},{pageBaseline:'old',routeSettleUntil:Date.now()+100000});
  assert.equal(settling.start,false);
  assert.match(source,/routeSettleUntil = now\(\) \+ 1000/);
  assert.match(source,/pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint\(\)/);
});
