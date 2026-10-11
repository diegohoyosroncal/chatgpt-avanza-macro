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

function makeAuto(input={}){
  const state={autoConsented:false,inFlightTicket:'',parkFingerprint:'',parkSince:0,stalled:4,missingReceipts:2,lastPercent:40,lastStatus:'',...input};
  let saves=0;
  const fn=new Function('state','control','moduleOn','checkConflicts','isGenerating','discoverVisibleProjects','projectKey','projectMode','learningFor','draft','findComposer','EXIT','lastVisibleAssistantFingerprint','saveState',section('  function shouldAutoStart() {','  function maybeAutoStart() {')+'return shouldAutoStart;')(
    state,{autoRunOptIn:true},()=>true,()=>false,()=>false,()=>{},()=>state.projectId||'',()=>({enabled:true,auto:true}),
    ()=>null,()=>'',()=>null,new Set(['VERIFIED_COMPLETE','NO_SAFE_ACTION','HUMAN_GATE_PROVEN']),()=>state.newFingerprint||'old',()=>{saves++;});
  return {start:fn(),state,saves};
}
test('AUTO requires per-chat activation; no global unsolicited sending',()=>{
  assert.equal(makeAuto().start,false);
  assert.equal(makeAuto({autoConsented:true}).start,true);
  assert.equal(makeAuto({autoConsented:true,projectId:'BUSINESS'}).start,true);
  assert.equal(makeAuto({autoConsented:false,projectId:'BUSINESS'}).start,false);
});
test('pending unique ticket blocks duplicate action on reload',()=>{
  assert.equal(makeAuto({autoConsented:true,inFlightTicket:'AVZ4-unique'}).start,false);
  assert.ok(source.indexOf('state.inFlightTicket=ticket')<source.indexOf('liveSend.click();'));
  assert.match(source,/restoreOutstanding\(\)/);
});
test('deep review precedes idle park; changed evidence reopens the gate',()=>{
  assert.equal(makeAuto({autoConsented:true,parkFingerprint:'old'}).start,false);
  const woke=makeAuto({autoConsented:true,parkFingerprint:'old',newFingerprint:'changed'});
  assert.equal(woke.start,true);
  assert.equal(woke.state.parkFingerprint,'');
  assert.equal(woke.saves,1);
  assert.match(source,/state\.stalled > MAX_STALLED_CYCLES/);
  assert.match(source,/state\.lastStrategy === 'AUDITORIA_PROFUNDA_CREAR_O_SUSTITUIR_CAPACIDAD'/);
  assert.match(source,/parkUnproductiveLoop\(\)/);
});
test('completion is terminal but a previously untagged chat may run',()=>{
  assert.equal(makeAuto({autoConsented:true,lastStatus:'VERIFIED_COMPLETE'}).start,false);
  assert.equal(makeAuto({autoConsented:true,projectId:''}).start,true);
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
test('only one active chat writer and no shell/network API introduced',()=>{
  assert.match(source,/function acquireLease\(\)/);
  assert.match(source,/return SESSION_PREFIX \+ chatKey/);
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/GM_xmlhttpRequest/);
  assert.match(source,/button\.textContent = active \? '■  AUTO ACTIVO · DETENER'/);
});


test('fresh profiles and old implicit AUTO preferences remain OFF',()=>{
  const body=section('  function normalizeControl(raw) {','  function readControl() {');
  const normalize=new Function(body+'return normalizeControl;')();
  const first=normalize(null);
  assert.equal(first.modules.auto,false);
  assert.equal(first.modules.background,false);
  assert.equal(first.backgroundAuto,false);
  const old=normalize({modules:{auto:true,engine:true},backgroundAuto:true,
    projectModes:{'ECON':{enabled:true,auto:true}}});
  assert.equal(old.modules.auto,false);
  assert.equal(old.modules.background,false);
  assert.equal(old.projectModes.ECON.auto,false);
  assert.equal(old.autoRunOptIn,false);
  const explicit=normalize({autoRunOptIn:true,backgroundOptIn:true,
    backgroundAuto:true,modules:{auto:true,background:true},
    projectModes:{ECON:{enabled:true,auto:true}}});
  assert.equal(explicit.modules.auto,true);
  assert.equal(explicit.backgroundAuto,true);
  assert.equal(explicit.projectModes.ECON.auto,true);
});
test('study UI classifier does not reframe a business accounting goal',()=>{
  const sourcePart=section('  function looksLearningProcess() {','  function setLearning(');
  assert.ok(source.includes('function looksLearningProcess()'));
  assert.match(source,/if\(!looksLearningProcess\(\)\)/);
  assert.match(source,/id=projectKey\(\)/);
  assert.doesNotMatch(sourcePart,/\|CONTABIL\|NIC/);
});
test('all browser AUTO send paths honor explicit consent',()=>{
  assert.match(source,/control\.autoRunOptIn!==true/);
  assert.match(source,/state\.autoConsented!==true/);
  assert.match(source,/control\.backgroundOptIn===true/);
  assert.match(source,/data-module="background"/);
  assert.match(source,/if\(looksLearningProcess\(\)&&L\?\.status==='AWAITING_USER'\)/);
});
