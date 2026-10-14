import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const section=(a,b)=>{
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert.ok(start>=0 && end>start,'missing '+a);
  return source.slice(start,end);
};
const keyBody=section('  function currentChatKey() {','  function storageKey() {');
const recoveryBody=section('  function recoverState() {','  function saveState() {');
function route(pathname,search='') {
  const location={hostname:'chatgpt.com',pathname,search};
  return new Function('location',keyBody+'return currentChatKey();')(location);
}
function restore(pathname,search,stored) {
  const location={hostname:'chatgpt.com',pathname,search};
  const chatKey=route(pathname,search),memory={...stored};
  const localStorage={getItem:key=>memory[key]||null};
  const sessionStorage={getItem:()=>null};
  const freshState=()=>({processId:'',cycles:0,totalSent:0,autoConsented:false});
  const storageKey=()=> 'avanza-v4-meta:'+chatKey;
  const fn=new Function('localStorage','sessionStorage','storageKey','SESSION_PREFIX','location','freshState',
    recoveryBody+'return recoverState();');
  return fn(localStorage,sessionStorage,storageKey,'avanza-v4-meta:',location,freshState);
}
const id='a0f1c234-1234-4ace-8990-ffffffffffff';

test('existing conversation keeps one identity when model/UI query changes',()=>{
  assert.equal(route('/c/'+id,'?model=gpt-6'),route('/c/'+id,'?model=gpt-5'));
  assert.equal(route('/c/'+id,'?utm_source=abc'),'chatgpt.com/c/'+id);
  assert.notEqual(route('/c/'+id),route('/c/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'));
});
test('new unnamed chats keep query-scoped compatibility',()=>{
  assert.notEqual(route('/','?temp=1'),route('/','?temp=2'));
});
test('exact old key migrates canonical owner and cycles without any fabricated metric',()=>{
  const path='/c/'+id,legacy='avanza-v4-meta:chatgpt.com'+path+'?model=gpt-6';
  const x=restore(path,'?model=gpt-6',{
    [legacy]:JSON.stringify({processId:'DIEGO-CHAT-DIPLOMACY',cycles:7,totalSent:7,
      autoConsented:true,lastPercent:null,lastDenominator:null}),
  });
  assert.equal(x.processId,'DIEGO-CHAT-DIPLOMACY');
  assert.equal(x.cycles,7);
  assert.equal(x.totalSent,7);
  assert.equal(x.lastPercent,null);
  assert.equal(x.autoConsented,true);
});
test('canonical key wins if both old and current states are present',()=>{
  const path='/c/'+id,stable='avanza-v4-meta:chatgpt.com'+path;
  const old=stable+'?model=gpt-6';
  const x=restore(path,'?model=gpt-6',{
    [stable]:JSON.stringify({processId:'DIEGO-CHAT-DIPLOMACY',cycles:9}),
    [old]:JSON.stringify({processId:'DIEGO-CHAT-DIPLOMACY',cycles:1}),
  });
  assert.equal(x.cycles,9);
});
test('different chat route cannot inherit another chat snapshot',()=>{
  const path='/c/'+id,foreign='avanza-v4-meta:chatgpt.com/c/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee?model=gpt-6';
  const x=restore(path,'?model=gpt-6',{[foreign]:JSON.stringify({processId:'OTHER',cycles:99})});
  assert.equal(x.processId,'');
  assert.equal(x.cycles,0);
});
test('invalid old state does not become trusted progress',()=>{
  const path='/c/'+id,old='avanza-v4-meta:chatgpt.com'+path+'?model=gpt-6';
  const x=restore(path,'?model=gpt-6',{[old]:'INVALID_JSON'});
  assert.equal(x.processId,'');
  assert.equal(x.cycles,0);
});
