'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');

function slice(start,end){
  const i=source.indexOf(start), j=source.indexOf(end,i+start.length);
  assert.ok(i>=0,'missing '+start);
  assert.ok(j>i,'missing '+end);
  return source.slice(i,j);
}

function run(messages){
  let state={processId:'',blocker:'PROCESS_ID_UNRESOLVED',lastUpdated:'',objective:'',lastPercent:null,lastDenominator:null,lastNumerator:null,lastDelta:null};
  let saves=0;
  const document={querySelectorAll:()=>messages.map(text=>({innerText:text,textContent:text}))};
  const parseReceipt=text=>{
    const m=String(text).match(/AVANZA_CONTROL:\s*(\{[^\n]*\})/i);
    if(!m) return null;
    const p=JSON.parse(m[1]);
    return {processId:p.process_id||'',objective:p.objective||'',denominator:p.denominator??null,percent:p.current_pct??null,numerator:p.numerator??null,delta:p.delta_pp??null};
  };
  const isProvisionalProcessId=id=>/^CHAT-[A-Z0-9]+$/.test(String(id||''));
  const needsIdentityBootstrap=()=>!state.processId||isProvisionalProcessId(state.processId);
  const saveState=()=>{saves++};
  const code=
    slice('  function visibleCanonicalReceiptConsensus() {','  function rehydrateCanonicalIdentityFromVisibleReceipt() {')+
    slice('  function rehydrateCanonicalIdentityFromVisibleReceipt() {','  function shouldAutoStart() {')+
    'return rehydrateCanonicalIdentityFromVisibleReceipt;';
  const fn=new Function('document','parseReceipt','isProvisionalProcessId','needsIdentityBootstrap','state','saveState',code)(
    document,parseReceipt,isProvisionalProcessId,needsIdentityBootstrap,state,saveState
  );
  return {receipt:fn(),state,saves};
}

const receipt=id=>'AVANZA_CONTROL: '+JSON.stringify({status:'CONTINUE',process_id:id,objective:id,current_pct:60,numerator:3,denominator:5,delta_pp:0});

test('one canonical receipt rehydrates its process id',()=>{
  const r=run([receipt('CROSS-CHAT-LEARNING')]);
  assert.equal(r.state.processId,'CROSS-CHAT-LEARNING');
  assert.equal(r.state.blocker,'');
  assert.equal(r.saves,1);
});

test('two contradictory canonical receipts fail closed without owner adoption',()=>{
  const r=run([receipt('PROCESS-A'),receipt('PROCESS-B')]);
  assert.equal(r.receipt,null);
  assert.equal(r.state.processId,'');
  assert.equal(r.state.blocker,'PROCESS_ID_CONFLICT');
  assert.equal(r.saves,1);
});
