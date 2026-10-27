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
  const fn=new Function('state','moduleOn','checkConflicts','isGenerating','discoverVisibleProjects','projectKey','projectMode','learningFor','draft','findComposer','EXIT','lastVisibleAssistantFingerprint','pageBaselineAssistantFingerprint','fallbackProcessId','routeSettleUntil','routeHadGeneration','saveState','now','latestVisibleReceipt','document','LOCKED_PROCESS_IDS','terminalEligible','unansweredMacroCycle','isInactiveProcess','provisionalProcessId',section('  function shouldAutoStart() {','  function maybeAutoStart() {')+'return shouldAutoStart;')(
    state,()=>true,()=>false,()=>false,()=>{ if(state.projectId&&!state.processId) state.processId=state.projectId; },()=>state.projectId||state.processId||'',()=>({enabled:true,auto:true}),
    ()=>null,()=>'',()=>null,new Set(['VERIFIED_COMPLETE','NO_SAFE_ACTION','HUMAN_GATE_PROVEN']),()=>state.newFingerprint||'old',env.pageBaseline??'old',()=> 'CHAT-TEST',env.routeSettleUntil??0,false,()=>{saves++;},()=>Date.now(),()=>env.visibleReceipt||null,{querySelector:()=>env.hasConversation===false?null:{}},new Set(['BTS-LIMA']),(receipt)=>Boolean(receipt && receipt.status==='VERIFIED_COMPLETE' && receipt.percent>=100 && receipt.completionVerified===true && Boolean(receipt.evidence?.trim())),()=>'',()=>false,()=>!state.processId||/^CHAT-/.test(state.processId));
  return {start:fn(),state,saves};
}
test('unidentified and unconsented chats never AUTO-start; recognized explicit consent resumes',()=>{
  const old=makeAuto();
  assert.equal(old.start,false);
  assert.equal(old.state.processId,'CHAT-TEST');
  assert.equal(old.state.autoConsented,false);
  const fresh=makeAuto({newFingerprint:'new'},{pageBaseline:'old'});
  assert.equal(fresh.start,false);
  assert.equal(fresh.state.processId,'CHAT-TEST');
  assert.equal(makeAuto({processId:'BUSINESS'}).start,false);
  assert.equal(makeAuto({projectId:'BUSINESS'}).start,false);
  assert.equal(makeAuto({autoConsented:true}).start,false);
  assert.equal(makeAuto({processId:'BUSINESS',autoConsented:true}).start,true);
  assert.equal(makeAuto({}, {hasConversation:false}).start,false);
  assert.match(source,/auto:false,progress:true/);
  assert.match(source,/backgroundAuto:false/);
  assert.match(source,/auto:row.auto===true/);
});
test('pending unique ticket blocks duplicate action on reload',()=>{
  assert.equal(makeAuto({autoConsented:true,inFlightTicket:'AVZ4-unique'}).start,false);
  assert.ok(source.indexOf('state.inFlightTicket=ticket')<source.indexOf('liveSend.click();'));
  assert.match(source,/restoreOutstanding\(\)/);
});
test('legacy parked chats migrate back into continuity and deep review rotates strategy',()=>{
  const woke=makeAuto({processId:'BUSINESS',autoConsented:true,parkFingerprint:'old'});
  assert.equal(woke.start,true);
  assert.equal(woke.state.parkFingerprint,'');
  assert.equal(woke.saves,1);
  assert.match(source,/state\.stalled > MAX_STALLED_CYCLES/);
  assert.match(source,/ROTAR_CAPACIDAD_Y_REABRIR_UNIVERSO/);
  assert.doesNotMatch(section('  async function tick() {','  function toggle() {'),/parkUnproductiveLoop\(\)/);
});
test('completion and archived projects remain terminal while recognized unfinished processes resume',()=>{
  assert.equal(makeAuto({processId:'BUSINESS',autoConsented:true,lastStatus:'VERIFIED_COMPLETE',lastPercent:40}).start,true); // unverified title alone is not completion
  assert.equal(makeAuto({processId:'BUSINESS',autoConsented:true,lastStatus:'VERIFIED_COMPLETE',lastPercent:100}).start,false);
  assert.equal(makeAuto({processId:'BUSINESS'}).start,false);
  assert.equal(makeAuto({processId:'BTS-LIMA',autoConsented:true}).start,false);
  assert.equal(makeAuto({}, {visibleReceipt:{status:'VERIFIED_COMPLETE',percent:100,evidence:'provider receipt',completionVerified:true}}).start,false);
});
test('unknown owner receives identity-only bootstrap; known owners retain specialized instructions',()=>{
  const sourcePart=section('  function buildMessage(ticket, step) {','  function setStatus(');
  const message=(learning,id)=>{
    const state={processId:id,stalled:4,missingReceipts:0,lastPercent:null,lastDenominator:null,lastDelta:null};
    const fn=new Function('state','strategy','MARK','RECEIPT','looksLearningProcess',
      'MAX_STALLED_CYCLES','INSTALLED_VERSION','provisionalProcessId',
      sourcePart+'return buildMessage;');
    return fn(state,()=> 'REVISAR_RUTA_Y_CAMBIAR_ESTRATEGIA',
      'AVANZA','AVANZA_CICLO_ID:',()=>learning,6,'4.9.1-test',
      ()=>!state.processId||/^CHAT-[A-Z0-9]+$/.test(state.processId))('TEST',1);
  };
  const unknown=message(false,'CHAT-TEST');
  assert.match(unknown,/RECUPERAR PROCESS_ID/);
  assert.match(unknown,/AVANZA_CONTROL/);
  assert.doesNotMatch(unknown,/CONTRATO OPERADOR TOTAL|LEARN QUEST:/);
  const business=message(false,'AR-TRACKER-MARKETPLACE');
  const learning=message(true,'CFI-E2-2026-10-16');
  assert.doesNotMatch(business,/LEARN QUEST:|CFI\/APRENDIZAJE:/);
  assert.match(learning,/LEARN QUEST:/);
  assert.match(business,/NO reemplaza objetivo/);
  assert.match(business,/AUDITORÍA DE ESTANCAMIENTO:/);
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

test('boot snapshots route state but existing unfinished chats no longer require a fresh assistant response',()=>{
  assert.match(source,/pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint\(\);/);
  assert.match(source,/Universal fixed-point bootstrap/);
  assert.match(source,/if \(!continuityArmed && provisionalProcessId\(\)\)/);
  assert.match(source,/state\.processId = fallbackProcessId\(\)/);
  assert.doesNotMatch(section('  function shouldAutoStart() {','  function maybeAutoStart() {'),/state\.processId = visibleReceipt\?\.processId \|\| fallbackProcessId\(\)/);
  assert.doesNotMatch(section('  function shouldAutoStart() {','  function maybeAutoStart() {'),/latestFingerprint !== pageBaselineAssistantFingerprint/);
});

test('SPA route settle prevents sends before the new route is stable',()=>{
  const settling=makeAuto({newFingerprint:'new'},{pageBaseline:'old',routeSettleUntil:Date.now()+100000});
  assert.equal(settling.start,false);
  assert.match(source,/routeSettleUntil = now\(\) \+ 1000/);
  assert.match(source,/pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint\(\)/);
});

test('terminal declarations are challenged once before any permanent stop',()=>{
  assert.match(source,/Terminal candidato: exijo segunda reauditoría/);
  assert.match(source,/SOFT_TERMINAL_ROTATE_FRONTIER/);
  assert.match(source,/terminalConfirmations/);
  assert.match(source,/state\.lastStatus = 'CONTINUE'/);
});
