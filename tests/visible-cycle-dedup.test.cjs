'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');

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

