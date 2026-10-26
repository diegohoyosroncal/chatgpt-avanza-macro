import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const between=(a,b)=>{
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert.ok(start>=0 && end>start,'Source function missing: '+a);
  return source.slice(start,end);
};
const statuses=['ARCHIVED','ARCHIVED_READ_ONLY','FROZEN','DISABLED'];
const set=new Set(statuses);

test('retired owners cannot be demoted by stale assistant snapshots',()=>{
  const body=between('  function upsertProjectSnapshot() {','  function freshState() {');
  const fn=new Function('projects','state','LOCKED_PROCESS_IDS','isInactiveProcess','projectKey','saveProjects','chatKey',body+'upsertProjectSnapshot();');
  for(const status of [...statuses,'CONTINUE']){
    const projects={X:{id:'X',status}};
    const state={processId:'X',lastStatus:'CONTINUE',lastPercent:null,lastDelta:null,lastUpdated:'today'};
    let saves=0;
    fn(projects,state,new Set(),id=>set.has(projects[id]?.status),()=>state.processId,()=>{saves++},'/c/x');
    assert.equal(saves,status==='CONTINUE'?1:0,status);
    assert.equal(projects.X.status,status);
  }
});

test('BroadcastChannel cannot revive a locally retired owner',()=>{
  const body=between('  function initChannel() {','  state = recoverState();');
  class FakeBC { constructor(){this.onmessage=null;}close(){} }
  const run=new Function('BroadcastChannel','moduleOn','CHANNEL_NAME','TAB_OWNER','projects','control','learning','PROJECTS_KEY','localStorage','renderProjects','renderModules','renderGame','applyAura','LOCKED_PROCESS_IDS','isInactiveProcess',
    'let channel=null;'+body+\`
    initChannel();
    channel.onmessage({data:{source:'sibling',type:'projects',projects:{
      X:{id:'X',status:'CONTINUE'},NEW:{id:'NEW',status:'CONTINUE'},
      'BTS-LIMA':{id:'BTS-LIMA',status:'CONTINUE'}
    }}});
    return projects;\`);
  for(const status of [...statuses,'CONTINUE']){
    const projects={X:{id:'X',status},'BTS-LIMA':{id:'BTS-LIMA',status:'ARCHIVED'}};
    let persisted='';
    const out=run(FakeBC,()=>true,'test','self',projects,{}, {},'registry',
      {setItem:(_key,value)=>{persisted=value}},()=>{},()=>{},()=>{},()=>{},
      new Set(['BTS-LIMA']),id=>set.has(projects[id]?.status));
    assert.equal(out.X.status,status);
    assert.equal(out['BTS-LIMA'].status,'ARCHIVED');
    assert.equal(out.NEW.status,'CONTINUE');
    assert.equal(JSON.parse(persisted).X.status,status);
  }
});

test('unknown POR-RECUPERAR is provisional, never a canonical owner',()=>{
  const body=between('  function provisionalProcessId(', '  function now() {');
  const fn=new Function('state',body+'return provisionalProcessId;')({processId:''});
  assert.equal(fn('POR-RECUPERAR'),true);
  assert.equal(fn('CHAT-ABC'),true);
  assert.equal(fn('AVANZA-MACRO'),false);
  assert.match(source,/const canonicalReceipt=Boolean\(receipt.processId && !provisionalProcessId\(receipt.processId\)\)/);
});
