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
  const document={readyState:'loading',addEventListener(){}};
  const window={addEventListener(){},removeEventListener(){},innerWidth:400,innerHeight:750};
  const localStorage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v},removeItem:k=>{delete mem[k]}};
  const snippet=source.slice(0,source.indexOf(boot))+
    "  window.__PROBE={isProvisionalProcessId,buildMessage,parseReceipt,setState:(x)=>{state={...freshState(),...x}},getState:()=>state};\n})();";
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
  assert.match(source,/const wasProvisional = isProvisionalProcessId\(\);/);
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

function domCycleProbe(messages){
  const begin=source.indexOf('  function unansweredMacroCycle() {');
  const end=source.indexOf('  async function claimAndSend(',begin);
  assert.ok(begin>0&&end>begin);
  const document={
    querySelectorAll:()=>messages.map(([role,body])=>({
      getAttribute:k=>k==='data-message-author-role'?role:null,
      innerText:body,
      textContent:body
    }))
  };
  return new Function('document',source.slice(begin,end)+'return unansweredMacroCycle();')(document);
}
test('pending visible AVANZA request blocks concurrent request',()=>{
  assert.equal(domCycleProbe([['user','AVANZA_CICLO_ID: AVZ4-100-1']]),'AVZ4-100-1');
});
test('assistant answer releases prior visible AVANZA request',()=>{
  assert.equal(domCycleProbe([['user','AVANZA_CICLO_ID: AVZ4-100-1'],['assistant','Respuesta terminada']]),'');
});
test('only newest unanswered macro is relevant, even after prior answer',()=>{
  assert.equal(domCycleProbe([['user','AVANZA_CICLO_ID: AVZ4-100-1'],['assistant','Terminado'],['user','AVANZA_CICLO_ID: AVZ4-200-1']]),'AVZ4-200-1');
});
test('unrelated user text does not create a macro wait condition',()=>{
  assert.equal(domCycleProbe([['user','actualiza las ventas'],['assistant','Bien'],['user','sigue']]),'');
});
test('two unanswered macro tickets reveal the latest, not a new permission',()=>{
  assert.equal(domCycleProbe([['user','AVANZA_CICLO_ID: AVZ4-100-1'],['user','AVANZA_CICLO_ID: AVZ4-104-1']]),'AVZ4-104-1');
});
test('other user message cannot clear an outstanding macro ticket',()=>{
  assert.equal(domCycleProbe([['user','AVANZA_CICLO_ID: AVZ4-100-1'],['user','.']]),'AVZ4-100-1');
});
test('DOM pending-cycle guard protects automatic and manual send paths',()=>{
  const auto=source.slice(source.indexOf('  function shouldAutoStart() {'),source.indexOf('  function maybeAutoStart() {'));
  const manual=source.slice(source.indexOf('  function toggle() {'),source.indexOf('  // PASSIVE, READ-ONLY'));
  const deliver=source.slice(source.indexOf('  async function deliver('),source.indexOf('  async function tick() {'));
  const send=source.slice(source.indexOf('  async function claimAndSend('),source.indexOf('  async function deliver('));
  assert.match(auto,/unansweredMacroCycle\(\)/);
  assert.match(manual,/unansweredMacroCycle\(\)/);
  assert.match(deliver,/unansweredMacroCycle\(\)/);
  assert.match(send,/unansweredMacroCycle\(\)/);
  assert.match(deliver,/clearOwnUnsentDraft\(c,message\)/);
});

function visibleRecovery(messages,initial={}){
  const a=source.indexOf('  function discoverVisibleProjects() {');
  const b=source.indexOf('  function latestVisibleReceipt() {',a);
  assert.ok(a>=0&&b>a);
  const state={processId:'',objective:'',lastPercent:null,lastNumerator:null,lastDenominator:null,lastDelta:null,lastStatus:'',...initial};
  const projects={};
  let persisted=0, savedIdentity='';
  const doc={querySelectorAll:()=>messages.map(t=>({innerText:t,textContent:t}))};
  const parseReceipt=(text)=>{
    const match=text.match(/AVANZA_CONTROL:\s*(\{[^\n]*\})/);
    if(!match) return null;
    const m=JSON.parse(match[1]);
    return {processId:m.process_id||'',objective:m.objective||'',numerator:m.numerator??null,denominator:m.denominator??null,percent:m.current_pct??null,delta:m.delta_pp??null,status:m.status||'CONTINUE'};
  };
  const fn=new Function('document','state','projects','safeId','parseReceipt',
    'isProvisionalProcessId','saveState','localStorage','PROJECTS_KEY','renderProjects',
    'lastPassiveProgressScan','hydrateVisibleReportedProgress',
    source.slice(a,b)+'return discoverVisibleProjects;')(
    doc,state,projects,x=>String(x||'').replace(/[^A-Za-z0-9._:-]/g,'-'),parseReceipt,
    id=>/^CHAT-[A-Z0-9]+$/.test(String(id||'')),
    ()=>{persisted++;savedIdentity=state.processId},
    {setItem(){}},'TEST',()=>{},Date.now(),()=>{}
  );
  fn();
  return {state,projects,persisted,savedIdentity};
}
const row=(id='AVANZA-MACRO')=>`🧩 PROCESO ${id} | 📈 AVANCE 66,67%→66,67% | 4/6 gates | Δ 0 pp`;
const receipt=(id='AVANZA-MACRO',current=66.67,n=4,d=6)=>
  'AVANZA_CONTROL: '+JSON.stringify({status:'CONTINUE',process_id:id,
    objective:'Continuidad por chat',current_pct:current,numerator:n,denominator:d,delta_pp:0});
test('recovered header identity is persisted immediately rather than memory only',()=>{
  const r=visibleRecovery([row()]);
  assert.equal(r.state.processId,'AVANZA-MACRO');
  assert.equal(r.savedIdentity,'AVANZA-MACRO');
  assert.equal(r.persisted,1);
  assert.equal(r.state.lastDenominator,6);
});
test('canonical JSON receipt alone can recover and persist process id',()=>{
  const r=visibleRecovery([receipt()]);
  assert.equal(r.state.processId,'AVANZA-MACRO');
  assert.equal(r.persisted,1);
  assert.equal(r.state.lastPercent,66.67);
  assert.equal(r.state.objective,'Continuidad por chat');
});
test('header and JSON receipt disagreement blocks automatic binding',()=>{
  const r=visibleRecovery([row('BTS-LIMA'),receipt('AVANZA-MACRO')]);
  assert.equal(r.state.processId,'');
  assert.equal(r.persisted,0);
});
test('two distinct canonical receipts block automatic binding',()=>{
  const r=visibleRecovery([receipt('AVANZA-MACRO'),receipt('BTS-LIMA')]);
  assert.equal(r.state.processId,'');
  assert.equal(r.persisted,0);
});
test('provisional owner is replaced by visible canonical receipt without new send',()=>{
  const r=visibleRecovery([receipt()],{processId:'CHAT-ABC123',lastDenominator:19});
  assert.equal(r.state.processId,'AVANZA-MACRO');
  assert.equal(r.state.lastDenominator,6);
  assert.equal(r.savedIdentity,'AVANZA-MACRO');
});
test('conflicting or invalid numerical receipt never inflates progress',()=>{
  const r=visibleRecovery([receipt('AVANZA-MACRO',100,4,6)]);
  assert.equal(r.state.processId,'AVANZA-MACRO');
  assert.equal(r.state.lastPercent,null);
  assert.equal(r.state.lastNumerator,null);
  assert.equal(r.state.lastProof,'ASISTENTE_VISIBLE_NO_PRUEBA_PRIMARIA');
});
test('without canonical evidence, do not guess a PROCESS_ID',()=>{
  const r=visibleRecovery(['Conversación sin meta ni identificador']);
  assert.equal(r.state.processId,'');
  assert.equal(r.persisted,0);
});
