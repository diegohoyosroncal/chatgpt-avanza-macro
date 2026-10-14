'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');
const boot="  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded'";
assert.ok(source.includes(boot),'bootstrap insertion point changed');

function harness(initialStatus='CONTINUE') {
  const memory={'avanza-v4-project-registry-v1':JSON.stringify({'EXTRA-OWNER':{id:'EXTRA-OWNER',status:initialStatus}})};
  const storage={getItem:key=>memory[key]||null,setItem:(key,val)=>{memory[key]=val},removeItem:key=>{delete memory[key]}};
  const document={readyState:'loading',addEventListener(){}};
  const window={addEventListener(){},removeEventListener(){},innerWidth:390,innerHeight:800};
  const snippet=source.slice(0,source.indexOf(boot))+
    "  window.__GATES={isInactiveProcess,projectMode,setProjectStatus:(id,status)=>{projects[id]={...(projects[id]||{}),status}},currentProjects:()=>projects};\n})();";
  vm.runInNewContext(snippet,{
    document,window,localStorage:storage,sessionStorage:storage,
    location:{hostname:'chatgpt.com',pathname:'/c/canonical-extra',search:''},
    console,JSON,Math,Number,String,Date,RegExp,Set,Object,crypto:{randomUUID:()=>'test'}
  },{timeout:2500});
  return window.__GATES;
}

test('arbitrary ARCHIVED, ARCHIVED_READ_ONLY, FROZEN, DISABLED owners are blocked',()=>{
  for(const status of ['ARCHIVED','ARCHIVED_READ_ONLY','FROZEN','DISABLED',' frozen ']){
    const p=harness(status);
    assert.equal(p.isInactiveProcess('EXTRA-OWNER'),true,status);
    assert.equal(p.projectMode('EXTRA-OWNER').enabled,false,status);
    assert.equal(p.projectMode('EXTRA-OWNER').auto,false,status);
  }
});
test('regular owners remain eligible; status changes take effect immediately',()=>{
  const p=harness('CONTINUE');
  assert.equal(p.isInactiveProcess('EXTRA-OWNER'),false);
  assert.equal(p.projectMode('EXTRA-OWNER').auto,true);
  p.setProjectStatus('EXTRA-OWNER','FROZEN');
  assert.equal(p.projectMode('EXTRA-OWNER').auto,false);
  assert.equal(p.isInactiveProcess(''),false);
});
test('historical hard-coded IDs remain blocked independently',()=>{
  const p=harness('CONTINUE');
  for(const id of ['BTS-LIMA','AUGMENTED-LEARNING']){
    assert.equal(p.projectMode(id).enabled,false,id);
  }
});
function part(begin,end) {
  const i=source.indexOf(begin),j=source.indexOf(end,i+begin.length);
  assert.ok(i>=0&&j>i,'slice '+begin);
  return source.slice(i,j);
}
test('AUTO, button, tick and delivery all enforce persisted inactive status',()=>{
  for(const [a,b] of [
    ['function shouldAutoStart()','function maybeAutoStart()'],
    ['function toggle()','// PASSIVE, READ-ONLY'],
    ['async function tick()','function toggle()'],
    ['async function deliver(step)','async function tick()'],
    ['function setProjectMode(','function seedProjects()']
  ]) {
    assert.match(part(a,b),/isInactiveProcess\(/,a);
  }
});
test('a stale assistant reply cannot replace a retired owner snapshot',()=>{
  assert.match(part('function upsertProjectSnapshot()','function freshState()'),/if \(isInactiveProcess\(id\)\) return;/);
});
test('BroadcastChannel preserves retired status and reasserts fixed locks',()=>{
  const b=part('function initChannel()','state = recoverState()');
  assert.match(b,/const inactive=Object\.entries\(projects\)\.filter/);
  assert.match(b,/status:old\.status/);
  assert.match(b,/status:lockedStatus\(id\)/);
});
