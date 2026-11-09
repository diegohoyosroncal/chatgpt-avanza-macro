import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../avanza_macro_maestro_v4.user.js', import.meta.url), 'utf8');

// Syntax gate.
new Function(source);

const mustContain = [
  '@version      4.9.2',
  "4.9.2-identity-once-pr30",
  'function terminalEligible(receipt)',
  'route_classes_tried',
  'independent_frontiers_exhausted',
  'build_gap_assessed',
  'SOFT_TERMINAL_ROTATE_FRONTIER',
  'TERMINAL_REJECTED_REOPEN_UNIVERSE',
];
for (const needle of mustContain) assert.ok(source.includes(needle), 'missing: ' + needle);

const mustNotContain = [
  "if (visibleReceipt && EXIT.has(visibleReceipt.status)) return false;",
  "if(state.lastStatus&&EXIT.has(state.lastStatus)) return false;",
  "if(stopReason&&/HUMAN_GATE|NO_SAFE_ACTION|completado/i.test(stopReason)) return;",
];
for (const needle of mustNotContain) assert.ok(!source.includes(needle), 'regression: ' + needle);

console.log('continuity_terminal_guard: PASS');


// Regression: partial assistant commentary is not a completion receipt. A
// second AVANZA ticket cannot be injected by clearing the first ticket early.
{
  const begin=source.indexOf('  function unansweredMacroCycle() {');
  const end=source.indexOf('  async function claimAndSend(',begin);
  assert.ok(begin>=0 && end>begin,'missing unanswered cycle guard');
  const fn=new Function('document','parseReceipt',source.slice(begin,end)+'return unansweredMacroCycle;');
  const n=(role,content)=>({
    getAttribute:k=>k==='data-message-author-role'?role:null,
    innerText:content,textContent:content
  });
  const parseReceipt=txt=>{try{return JSON.parse(txt.slice(txt.indexOf('{')))}catch{return null}};
  const get=nodes=>fn({querySelectorAll:()=>nodes},parseReceipt)();
  const first=n('user','AVANZA_CICLO_ID: AVZ4-1794191265252-1');
  const second=n('user','AVANZA_CICLO_ID: AVZ4-1794191268553-1');
  const partial=n('assistant','Revisando navegador remoto; herramientas en curso.');
  const complete=n('assistant','Efecto verificado.\nAVANZA_CONTROL: {"status":"CONTINUE","process_id":"CROSS-CHAT-LEARNING"}');
  assert.equal(get([first,partial]),'AVZ4-1794191265252-1');
  assert.equal(get([first,partial,second]),'AVZ4-1794191268553-1');
  assert.equal(get([first,complete]),'');
  assert.equal(get([first,complete,second]),'AVZ4-1794191268553-1');
  assert.equal(get([first,n('assistant','AVANZA_CONTROL: {"status":"CONTINUE"}\nTools still executing')]),'AVZ4-1794191265252-1');
  assert.equal(get([first,n('assistant','AVANZA_CONTROL: {"status":BROKEN}')]),'AVZ4-1794191265252-1');
}

// Regression: a stable but partial answer must never trigger the next AUTO step.
{
  const begin=source.indexOf('    const reply = assistantAfter(pending.ticket);');
  const end=source.indexOf('    const key = fingerprint(reply);',begin);
  assert.ok(begin>=0 && end>begin,'missing final receipt guard');
  const snippet=source.slice(begin,end);
  const run=new Function('answer','marks',[
    'const pending={ticket:"AVZ4-test",sentAt:1000};',
    'const assistantAfter=()=>answer;',
    'const isGenerating=()=>false;',
    'const now=()=>18000;',
    'const setStatus=(...args)=>marks.push(args);',
    "const parseReceipt=txt=>{try{const x=JSON.parse(txt.slice(txt.indexOf('{')));return x.status==='CONTINUE'?x:null}catch{return null}};",
    snippet,
    'return receipt;'
  ].join('\n'));
  const marks=[];
  assert.equal(run('Estado parcial durante herramientas',marks),undefined);
  assert.ok(marks.some(x=>String(x[0]).includes('AVANZA_CONTROL')));
  assert.equal(run('AVANZA_CONTROL: {"status":"CONTINUE"}\nOtra herramienta',[]),undefined);
  assert.equal(run('AVANZA_CONTROL: {"status":BROKEN}',[]),undefined);
  assert.equal(run('Listo.\nAVANZA_CONTROL: {"status":"CONTINUE"}',[]).status,'CONTINUE');
}
