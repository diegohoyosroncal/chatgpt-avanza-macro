'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');

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
    'lastPassiveProgressScan','hydrateVisibleReportedProgress','chatKey',
    source.slice(a,b)+'return discoverVisibleProjects;')(
    doc,state,projects,x=>String(x||'').replace(/[^A-Za-z0-9._:-]/g,'-'),parseReceipt,
    (id=state.processId)=>/^CHAT-[A-Z0-9]+$/.test(String(id||'')),
    ()=>{persisted++;savedIdentity=state.processId},
    {setItem(){}},'TEST',()=>{},Date.now(),()=>{},'chatgpt.com/c/example'
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
