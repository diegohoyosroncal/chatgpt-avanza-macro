'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');
const boot="  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded'";
assert.ok(source.includes(boot));
function harness(){
  const mem={};
  const nodes=[];
  const node=(role,text)=>({
    getAttribute:key=>key==='data-message-author-role'?role:null,
    textContent:text,
    innerText:text,
    isConnected:true,
    getBoundingClientRect:()=>({width:10,height:10}),
  });
  const document={
    readyState:'loading',
    addEventListener(){},
    querySelectorAll(sel){
      if(sel==='[data-message-author-role]') return nodes;
      if(sel==='[data-message-author-role="assistant"]') return nodes.filter(x=>x.getAttribute('data-message-author-role')==='assistant');
      if(sel==='[data-message-author-role="user"]') return nodes.filter(x=>x.getAttribute('data-message-author-role')==='user');
      return [];
    },
    querySelector(sel){ return this.querySelectorAll(sel)[0]||null; },
  };
  const window={addEventListener(){},removeEventListener(){},innerWidth:400,innerHeight:750};
  const localStorage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v},removeItem:k=>{delete mem[k]}};
  const snippet=source.slice(0,source.indexOf(boot))+
    "  window.__PROBE={isProvisionalProcessId,buildMessage,parseReceipt,assistantAfter,rehydrateCanonicalIdentityFromVisibleReceipt,setMessages:(xs)=>{nodes.splice(0,nodes.length,...xs.map(x=>node(x.role,x.text)))},setState:(x)=>{state={...freshState(),...x}},getState:()=>state};\n})();";
  vm.runInNewContext(snippet,{document,window,localStorage,sessionStorage:localStorage,location:{hostname:'chatgpt.com',pathname:'/c/example',search:''},console,JSON,Math,Number,String,Date,RegExp,Set,Object,crypto:{randomUUID:()=>'test'}},{timeout:2000});
  return window.__PROBE;
}
test('detects provisional CHAT token only, not canonical or empty process',()=>{
  const p=harness();
  assert.equal(p.isProvisionalProcessId('CHAT-123ABC'),true);
  assert.equal(p.isProvisionalProcessId('BTS-LIMA'),false);
  assert.equal(p.isProvisionalProcessId('AUGMENTED-LEARNING'),false);
  assert.equal(p.isProvisionalProcessId(''),false);
});
test('unrecognized chat sends identity-only bootstrap, not full execution macro',()=>{
  const p=harness();
  p.setState({processId:'CHAT-ABC123'});
  const message=p.buildMessage('T-1',1);
  assert.match(message,/IDENTIFICACIÓN DE OBJETIVO/);
  assert.match(message,/NO ejecutes acciones externas/);
  assert.match(message,/process_id vacío/);
  assert.match(message,/AVANZA_CONTROL/);
  assert.doesNotMatch(message,/CONTRATO OPERADOR TOTAL/);
  assert.doesNotMatch(message,/DECIDE TÚ la mejor acción/);
});
test('canonical known processes preserve full adaptive macro',()=>{
  const p=harness();
  p.setState({processId:'AVANZA-MACRO'});
  assert.match(p.buildMessage('T-2',2),/CONTRATO OPERADOR TOTAL/);
});
test('metadata parser can return canonical owner identity from bootstrap reply',()=>{
  const p=harness();
  const m=p.parseReceipt('AVANZA_CONTROL: {"status":"CONTINUE","process_id":"AVANZA-MACRO","objective":"Mantener continuidad","current_pct":null,"denominator":null}');
  assert.equal(m.processId,'AVANZA-MACRO');
  assert.equal(m.percent,null);
});
test('canonical adoption clears provisional objective and denominator before progress',()=>{
  assert.match(source,/const wasProvisional = needsIdentityBootstrap\(\);/);
  assert.match(source,/if \(wasProvisional && canonicalReceipt\) \{[\s\S]*?state.processId=receipt.processId;[\s\S]*?state.objective='';[\s\S]*?state.lastDenominator=null;/);
  assert.match(source,/delete projects\[provisionalId\]/);
});
test('ambiguous bootstrap must stop instead of sending another unknown cycle',()=>{
  assert.match(source,/if \(wasProvisional && !canonicalReceipt\) \{[\s\S]*?state.blocker='PROCESS_ID_UNRESOLVED'/);
  assert.match(source,/if \(state.blocker==='PROCESS_ID_UNRESOLVED'\) return false;/);
  assert.match(source,/pause\('Identificación de objetivo pendiente; no enviaré más ciclos sin PROCESS_ID canónico.'/);
});
test('fixed owner restrictions are independently enforced after rebind',()=>{
  assert.match(source,/LOCKED_PROCESS_IDS = new Set\(\['BTS-LIMA','AUGMENTED-LEARNING'\]\)/);
  assert.match(source,/if \(LOCKED_PROCESS_IDS.has\(projectKey\(\)\)\)/);
});

test('empty-owner manual cycle requests identity only and cannot execute the full macro',()=>{
  const p=harness();
  p.setState({processId:''});
  const msg=p.buildMessage('T-EMPTY',1);
  assert.match(msg,/IDENTIFICACIÓN DE OBJETIVO/);
  assert.match(msg,/NO ejecutes acciones externas/);
  assert.doesNotMatch(msg,/CONTRATO OPERADOR TOTAL/);
  assert.doesNotMatch(msg,/CONTROL ADAPTATIVO/);
});
test('unknown owner without a parseable receipt cannot cause a blind retry',()=>{
  assert.match(source,/function needsIdentityBootstrap\(\) \{ return !projectKey\(\) \|\| isProvisionalProcessId\(\); \}/);
  assert.match(source,/if \(!receipt && needsIdentityBootstrap\(\)\) \{[\s\S]*?state.blocker='PROCESS_ID_UNRESOLVED';[\s\S]*?pause\('Identificación de objetivo sin recibo:/);
});


test('assistant reply before a user follow-up is not discarded as interruption',()=>{
  assert.match(source,/const nextUser = after\.findIndex\([\s\S]*?const bounded = nextUser >= 0 \? after\.slice\(0, nextUser\) : after;[\s\S]*?if \(assistants\.length\)/);
  assert.match(source,/return nextUser >= 0 \? '<<USER_INTERRUPTED>>' : '';/);
});

test('visible canonical receipt rehydrates identity before auto or manual cycle',()=>{
  assert.match(source,/function rehydrateCanonicalIdentityFromVisibleReceipt\(\)/);
  assert.match(source,/if\(needsIdentityBootstrap\(\)\) \{[\s\S]*?state\.processId=receipt\.processId;[\s\S]*?saveState\(\);/);
  assert.doesNotMatch(source,/function rehydrateCanonicalIdentityFromVisibleReceipt\(\)[\s\S]*?state\.autoConsented\s*=\s*true;/);
  assert.match(source,/const visibleReceipt=rehydrateCanonicalIdentityFromVisibleReceipt\(\);/);
  assert.match(source,/function toggle\(\) \{[\s\S]*?rehydrateCanonicalIdentityFromVisibleReceipt\(\);[\s\S]*?const id=projectKey\(\);/);
});


test('functional: receipt reply survives a later user follow-up',()=>{
  const p=harness();
  p.setMessages([
    {role:'user',text:'MACRO ticket T-RACE'},
    {role:'assistant',text:'ok\nAVANZA_CONTROL: {"status":"CONTINUE","process_id":"CROSS-CHAT-LEARNING","objective":"Persist identity","previous_pct":40,"current_pct":40,"delta_pp":0,"numerator":2,"denominator":5,"evidence":"receipt","blocker":"","next_action":"canary"}'},
    {role:'user',text:'another macro arrived before poller consumed reply'}
  ]);
  const reply=p.assistantAfter('T-RACE');
  assert.match(reply,/process_id":"CROSS-CHAT-LEARNING"/);
  assert.notEqual(reply,'<<USER_INTERRUPTED>>');
});

test('functional: visible canonical receipt rehydrates empty owner',()=>{
  const p=harness();
  p.setState({processId:'',blocker:'PROCESS_ID_UNRESOLVED',autoConsented:false});
  p.setMessages([
    {role:'assistant',text:'AVANZA_CONTROL: {"status":"CONTINUE","process_id":"CROSS-CHAT-LEARNING","objective":"Persist identity","previous_pct":40,"current_pct":40,"delta_pp":0,"numerator":2,"denominator":5,"evidence":"receipt","blocker":"","next_action":"canary"}'}
  ]);
  const receipt=p.rehydrateCanonicalIdentityFromVisibleReceipt();
  const state=p.getState();
  assert.equal(receipt.processId,'CROSS-CHAT-LEARNING');
  assert.equal(state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(state.autoConsented,false);
  assert.equal(state.blocker,'');
  assert.equal(state.lastPercent,40);
  assert.equal(state.lastDenominator,5);
});


test('branch build identity is distinguishable from main 4.8.0',()=>{
  assert.match(source,/\/\/ @version\s+4\.8\.1/);
  assert.match(source,/const INSTALLED_VERSION = '4\.8\.1-cross-chat-rehydrate-pr28';/);
  assert.doesNotMatch(source,/const INSTALLED_VERSION = '4\.8\.0-universal-fixed-point';/);
});


test('rehydration preserves explicit manual consent state',()=>{
  const p=harness();
  p.setState({processId:'',blocker:'PROCESS_ID_UNRESOLVED',autoConsented:false});
  p.setMessages([
    {role:'assistant',text:'AVANZA_CONTROL: {"status":"CONTINUE","process_id":"CROSS-CHAT-LEARNING","objective":"Persist identity","previous_pct":40,"current_pct":40,"delta_pp":0,"numerator":2,"denominator":5,"evidence":"receipt","blocker":"","next_action":"canary"}'}
  ]);
  p.rehydrateCanonicalIdentityFromVisibleReceipt();
  assert.equal(p.getState().processId,'CROSS-CHAT-LEARNING');
  assert.equal(p.getState().autoConsented,false);
});
