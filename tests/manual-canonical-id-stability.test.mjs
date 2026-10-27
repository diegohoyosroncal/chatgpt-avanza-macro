import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const start=source.indexOf('  function shouldAutoStart() {');
const end=source.indexOf('  function maybeAutoStart() {',start);
assert.ok(start>=0 && end>start,'Unable to extract true shouldAutoStart');
const actualFn=source.slice(start,end);

function probe(initial,receipt=null) {
  const state={processId:initial.id,autoConsented:initial.auto,objective:initial.objective||'',
    blocker:'',inFlightTicket:'',retryAfter:0,lastPercent:null};
  let saves=0, fallbackMinted=0;
  const testHarness=new Function('state','saveState','receipt','mint',`
    let routeSettleUntil=0, routeHadGeneration=false, pageBaselineAssistantFingerprint='';
    const now=()=>Date.now(), discoverVisibleProjects=()=>{},
      latestVisibleReceipt=()=>receipt,terminalEligible=()=>false,EXIT=new Set(),
      isGenerating=()=>false,lastVisibleAssistantFingerprint=()=> 'ASSISTANT_TEXT',
      document={querySelector:()=>({})},fallbackProcessId=mint,
      provisionalProcessId=(id=state.processId)=>!id || /^CHAT-[A-Z0-9]+$/.test(String(id)) || /^POR-RECUPERAR$/i.test(String(id)),
      unansweredMacroCycle=()=>false,moduleOn=()=>true,checkConflicts=()=>false,
      projectKey=()=>state.processId,LOCKED_PROCESS_IDS=new Set(),
      isInactiveProcess=()=>false,projectMode=()=>({enabled:true,auto:true}),
      learningFor=()=>null,draft=()=>'',findComposer=()=>null;
    ${actualFn}
    return shouldAutoStart();`);
  const ready=testHarness(state,()=>saves++,receipt,()=>{fallbackMinted++;return 'CHAT-MINTED';});
  return {state,ready,saves,fallbackMinted};
}

test('canonical identity survives MANUAL/OFF without any storage rewrite',()=>{
  const p=probe({id:'AVANZA-MACRO',auto:false,objective:'Objetivo válido'});
  assert.equal(p.state.processId,'AVANZA-MACRO');
  assert.equal(p.state.objective,'Objetivo válido');
  assert.equal(p.ready,false);
  assert.equal(p.saves,0);
  assert.equal(p.fallbackMinted,0);
});

test('consented canonical owner remains eligible; no spurious fallback',()=>{
  const p=probe({id:'AVANZA-MACRO',auto:true});
  assert.equal(p.state.processId,'AVANZA-MACRO');
  assert.equal(p.ready,true);
  assert.equal(p.fallbackMinted,0);
});

test('unknown owner may mint a provisional identity once, without AUTO',()=>{
  const p=probe({id:'',auto:false});
  assert.equal(p.state.processId,'CHAT-MINTED');
  assert.equal(p.state.autoConsented,false);
  assert.equal(p.ready,false);
  assert.equal(p.saves,1);
  assert.equal(p.fallbackMinted,1);
});

test('existing CHAT-* owner cannot be reminted every timer tick',()=>{
  const p=probe({id:'CHAT-EXISTING',auto:false});
  assert.equal(p.state.processId,'CHAT-EXISTING');
  assert.equal(p.saves,0);
  assert.equal(p.fallbackMinted,0);
});

test('POR-RECUPERAR is converted only to a provisional identity',()=>{
  const p=probe({id:'POR-RECUPERAR',auto:false});
  assert.equal(p.state.processId,'CHAT-MINTED');
  assert.equal(p.state.autoConsented,false);
  assert.equal(p.saves,1);
});

test('foreign visible receipt must not replace an already-known manual owner',()=>{
  const p=probe({id:'AVANZA-MACRO',auto:false},
    {status:'CONTINUE',processId:'ANOTHER-OWNER',percent:null});
  assert.equal(p.state.processId,'AVANZA-MACRO');
  assert.equal(p.fallbackMinted,0);
});
