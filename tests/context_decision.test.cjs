'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '..', 'avanza_macro_maestro_v4.user.js'), 'utf8');
const boot = '  initChannel();\n  if (document.readyState';
assert.ok(script.includes(boot), 'known no-side-effect boot gate is present');
function decide(signals) {
  const body = script.slice(0, script.indexOf(boot)) + 
    '  window.__QA_DECIDE = chooseRoute;\n})();';
  const mem = {};
  const storage = {
    getItem: k => mem[k] ?? null, setItem:(k,v)=>{mem[k]=v},removeItem:k=>delete mem[k],
  };
  const document={documentElement:{getAttribute:()=>null,setAttribute:()=>{}},getElementById:()=>null,
    querySelectorAll:()=>[],addEventListener:()=>{},readyState:'loading'};
  const window={addEventListener:()=>{},removeEventListener:()=>{},innerWidth:1280,innerHeight:800};
  vm.runInNewContext(body, {window,document,localStorage:storage,sessionStorage:storage,
    location:{hostname:'chatgpt.com',pathname:'/c/safe',search:''},
    crypto:{randomUUID:()=> 'QA'},console,Date,Math,Number,String,JSON,Object,Set,RegExp}, {timeout:2000});
  return window.__QA_DECIDE(signals);
}
const cases=[
  ['undefined numerator/denominator -> verify', {stalled:0,lastDelta:null}, 'VERIFICAR_METRICA_Y_ACTUAR'],
  ['real positive delta -> execute next with verification', {lastDelta:12}, 'EJECUTAR_SIGUIENTE_HITO_Y_VERIFICAR'],
  ['zero delta initial -> best safe execution', {lastDelta:0}, 'EJECUTAR_Y_VERIFICAR'],
  ['first unproductive cycle -> compare routes', {lastDelta:0,stalled:1}, 'COMPARAR_ALTERNATIVAS_Y_EJECUTAR'],
  ['blocked login is a specific unblock strategy', {stalled:2,lastDelta:0,blocker:'OAuth login denied'}, 'DESBLOQUEAR_E_INVESTIGAR_ALTERNATIVAS'],
  ['three futile cycles -> change strategy', {stalled:3,lastDelta:0}, 'DESTRABAR_CAMBIANDO_ESTRATEGIA'],
  ['six futile cycles -> consider adoption integration replacement build', {stalled:6,lastDelta:0}, 'REPLANTEAR_ADOPTAR_FUSIONAR_SUSTITUIR_O_CREAR'],
  ['three identical replies -> switch even if percentage allegedly rose', {repeatedResponses:3,lastDelta:7}, 'REPLANTEAR_ADOPTAR_FUSIONAR_SUSTITUIR_O_CREAR'],
  ['missing control receipt -> diagnose instead of fabricate progress', {missingReceipts:2,lastDelta:0}, 'AUDITAR_RECIBOS_Y_RECUPERAR_CONTEXTO'],
  ['human gate -> prove the gate and alternatives', {lastStatus:'HUMAN_GATE_PROVEN'}, 'AUDITAR_GATE_Y_ALTERNATIVAS'],
  ['declared completion -> verify independently', {lastStatus:'VERIFIED_COMPLETE'}, 'VERIFICAR_CIERRE_EN_FUENTE'],
  ['no-safe-action -> evaluate value and resume condition', {lastStatus:'NO_SAFE_ACTION'}, 'REVISAR_VALOR_Y_CONDICION_DE_REANUDACION'],
];
for(const [name,signals,expected] of cases) {
  test(name,()=>assert.equal(decide(signals).mode, expected));
}
test('cycle activation cannot wipe historical stalled count', ()=>{
  assert.doesNotMatch(script,/state\.stalled=0; state\.missingReceipts=0;/);
  assert.match(script,/Manual reactivation must NOT erase/);
});
test('visible decisions use safe textContent rather than HTML from assistant', ()=>{
  assert.match(script,/data-value="decision"/);
  assert.match(script,/set\('decision', '🧭 '/);
  assert.match(script,/function chooseRoute\(signals = \{\}\)/);
});
test('no autonomous external network, irreversible changes or hourly ChatGPT scheduler', ()=>{
  assert.doesNotMatch(script,/\bfetch\s*\(|GM_xmlhttpRequest|new\s+WebSocket\s*\(/);
  assert.match(script,/autoRunOptIn===true/);
  assert.match(script,/backgroundOptIn===true/);
  assert.match(script,/\bCOLA→ENTREGA→ACCIÓN→EFECTO\b|COLA→ENTREGA→ACCIÓN→EFECTO/);
});
test('new installation must require explicit AUTO consent regardless of prior legacy defaults', ()=>{
  assert.match(script,/autoRunOptIn:false/);
  assert.match(script,/if\(!autoRunOptIn\) modules\.auto=false;/);
  assert.match(script,/if\(!backgroundOptIn\) modules\.background=false;/);
});
