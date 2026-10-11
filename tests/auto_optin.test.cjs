'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','avanza_macro_maestro_v4.user.js'),'utf8');
const boot='  initChannel();\n  if (document.readyState';
assert.ok(src.includes(boot),'recognized no-side-effect boot gate');
function harness(oldPrefs) {
  const body=src.slice(0,src.indexOf(boot))+
    "  window.__qa={readControl,projectMode,shouldAutoStart,getControl:()=>control,setControl:c=>{control=c},setProcess:id=>{state.processId=id}};\n})();";
  const store={};
  if(oldPrefs)store['avanza-v4-control-center-v1']=JSON.stringify(oldPrefs);
  const fakeStorage={getItem:key=>store[key]??null,setItem:(key,value)=>{store[key]=value},removeItem:key=>{delete store[key]}};
  const document={getElementById:()=>null,querySelectorAll:()=>[],hidden:false,readyState:'loading',addEventListener:()=>{}};
  const window={addEventListener:()=>{},removeEventListener:()=>{},innerWidth:1280,innerHeight:800};
  const globals={window,document,localStorage:fakeStorage,sessionStorage:{...fakeStorage,getItem:()=>null},
    location:{hostname:'chatgpt.com',pathname:'/c/test',search:''},
    crypto:{randomUUID:()=>'test-owner'},console};
  vm.runInNewContext(body,globals,{timeout:2000});
  return window.__qa;
}
test('metadata and installed version are unique and update from main',()=>{
  assert.match(src,/\/\/ @version\s+4\.3\.1/);
  assert.match(src,/const INSTALLED_VERSION = '4\.3\.1-explicit-auto'/);
  assert.match(src,/\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/diegohoyosroncal\/chatgpt-avanza-macro\/main\/avanza_macro_maestro_v4\.user\.js/);
  assert.match(src,/\/\/ @noframes/);
});
test('the visual panel still auto-mounts across web chats',()=>{
  assert.match(src,/function mount\(\)/);
  assert.match(src,/function ensurePanelVisible\(\)/);
  assert.match(src,/function observe\(\)/);
  assert.match(src,/@match\s+https:\/\/chatgpt\.com\/\*/);
});
test('first-run install is manual AUTO and hidden-tab OFF',()=>{
  const qa=harness(), control=qa.readControl();
  assert.equal(control.modules.auto,false);
  assert.equal(control.modules.background,false);
  assert.equal(control.backgroundAuto,false);
  assert.equal(control.backgroundOptIn,false);
  assert.equal(control.autoRunOptIn,false);
  assert.equal(qa.projectMode('any-new-project').auto,false);
});
test('legacy preferences with previously true defaults do NOT authorize automatic sends',()=>{
  const qa=harness({modules:{engine:true,auto:true},backgroundAuto:true,
    projectModes:{'ANY-PROJECT':{enabled:true,auto:true}}});
  const prefs=qa.readControl();
  assert.equal(prefs.autoRunOptIn,false);
  assert.equal(prefs.backgroundOptIn,false);
  qa.setProcess('ANY-PROJECT');
  assert.equal(qa.shouldAutoStart(),false);
});
test('explicit opt-in is necessary in addition to global and project switches',()=>{
  const qa=harness();qa.setProcess('P0');
  const baseline=qa.getControl();
  qa.setControl({...baseline,modules:{...baseline.modules,auto:true},
    projectModes:{P0:{enabled:true,auto:true}},autoRunOptIn:false});
  assert.equal(qa.shouldAutoStart(),false);
});
test('AUTO and background have different, explicit click handlers',()=>{
  assert.match(src,/if\(name==='auto'\)\s*\{/);
  assert.match(src,/control\.autoRunOptIn=moduleOn\('auto'\)/);
  assert.match(src,/if\(name==='background'\)\s*\{/);
  assert.match(src,/control\.backgroundOptIn=moduleOn\('background'\)/);
  assert.match(src,/data-module="background"/);
});
test('hidden-tab sending requires separately consented background mode',()=>{
  assert.match(src,/control\.backgroundAuto===true && control\.backgroundOptIn===true/g);
  const matches=src.match(/control\.backgroundAuto===true && control\.backgroundOptIn===true/g)||[];
  assert.equal(matches.length,2);
});
test('unrelated process objectives and safety boundaries remain untouched',()=>{
  for(const required of ['function buildMessage(', 'function renewLease(', 'function acquireLease(', 'if (draft(c))',
    'function renderGame()', 'function renderProjects()', 'function applyAura()',
    'function maybeAutoStart()', 'function checkConflicts()']) {
    assert.ok(src.includes(required),'missing '+required);
  }
  assert.doesNotMatch(src,/\bfetch\s*\(|GM_xmlhttpRequest\s*\(/);
});
