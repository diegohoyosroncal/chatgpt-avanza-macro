'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'avanza_macro_maestro_v4.user.js'), 'utf8');
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'macro-registry.json'), 'utf8'));
const boot = "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded'";
assert.ok(script.includes(boot), 'known bootstrapping gate must exist for non-invasive test harness');

function harness() {
  const source = script.slice(0, script.indexOf(boot)) +
    "  window.__TEST = { readPresentation, conflicts, dragStart, dragMove, dragEnd, applyPresentation, checkConflicts, acquireLease, renewLease, releaseLease, setRoot:(x)=>{root=x;},setDashboard:(x)=>{dashboard=x;},setPresentation:(x)=>{presentation=x;},getPresentation:()=>presentation };\n})();";
  const dom = {};
  const mem = {};
  const listeners = {};
  const document = { readyState: 'loading', getElementById: id => dom[id] || null, addEventListener() {} };
  const window = { innerWidth: 600, innerHeight: 500,
    addEventListener: (key, handler) => { listeners[key] = handler; },
    removeEventListener: key => { delete listeners[key]; } };
  const localStorage = { getItem: key => mem[key] || null, setItem: (key, value) => { mem[key] = value; }, removeItem: key => { delete mem[key]; } };
  vm.runInNewContext(source, {document, window, localStorage, location:{ hostname:'chatgpt.com', pathname:'/c/test', search:'' },
    console, JSON, Math, Number, String, Date, RegExp, Set, Object, crypto: { randomUUID: () => 'test-owner' }}, {timeout:2000});
  return { t: window.__TEST, dom, mem, window, listeners };
}

test('userscript keeps central update channel, strict host matches, no frame injection', () => {
  assert.match(script, /@updateURL\s+https:\/\/raw\.githubusercontent\.com\/diegohoyosroncal\/chatgpt-avanza-macro\/main\/avanza_macro_maestro_v4\.user\.js/);
  assert.match(script, /@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/diegohoyosroncal\/chatgpt-avanza-macro\/main\/avanza_macro_maestro_v4\.user\.js/);
  assert.match(script, /@noframes/);
  assert.match(script, /@match\s+https:\/\/chatgpt\.com\/\*/);
});
test('source evaluates without triggering network requests on a non-booted mock page', () => {
  assert.ok(harness().t.readPresentation);
});
test('restores compatible color, compact and position preferences', () => {
  const {t,mem} = harness();
  mem['avanza-master-ui-v4'] = JSON.stringify({theme:'violet',compact:true,x:100,y:200});
  assert.equal(t.readPresentation().theme, 'violet');
  assert.equal(t.readPresentation().compact, true);
  assert.equal(t.readPresentation().x, 100);
});
test('malformed local preferences revert safely to defaults', () => {
  const {t,mem} = harness(); mem['avanza-master-ui-v4'] = '{broken';
  assert.equal(t.readPresentation().theme, 'amber');
  assert.equal(t.readPresentation().compact, true); // compact by default; explicit expansion remains supported
});
test('detects older MISION VIVA v3.1 and blocks macros running simultaneously', () => {
  const {t,dom}=harness();dom['diego-mision-autonomia-v1'] = {};
  assert.ok(t.conflicts().includes('diego-mision-autonomia-v1'));
  assert.equal(t.checkConflicts(),true);
  delete dom['diego-mision-autonomia-v1'];
  assert.equal(t.conflicts().length,0);
});
test('compact mode maintains actual UI controls and theme metadata', () => {
  const {t}=harness();
  const root={style:{},dataset:{},offsetWidth:200,offsetHeight:110};
  const collapse={setAttribute(key,val){this[key]=val;}},theme={setAttribute(key,val){this[key]=val;}};
  const dashboard={classList:{toggle(key,on){this[key]=on;}},querySelector:sel=>sel.includes('collapse')?collapse:theme};
  t.setRoot(root);t.setDashboard(dashboard);t.setPresentation({theme:'ocean',compact:true,x:800,y:800});t.applyPresentation();
  assert.equal(root.dataset.theme,'ocean');
  assert.equal(dashboard.classList.compact,true);
  assert.equal(collapse['aria-expanded'],'false');
  assert.equal(root.style.left,'400px');
  assert.equal(root.style.top,'390px');
});
test('dragging records position and disposes pointer event handlers', () => {
  const {t,mem,listeners}=harness();
  const root={style:{},offsetWidth:200,offsetHeight:110,getBoundingClientRect:()=>({left:350,top:250})};
  t.setRoot(root);t.dragStart({button:0,pointerId:7,clientX:50,clientY:50,target:{closest:()=>null}});
  t.dragMove({pointerId:7,clientX:-100,clientY:-100});t.dragEnd({pointerId:7});
  assert.match(mem['avanza-master-ui-v4'],/"x":/);
  assert.equal(Object.keys(listeners).length,0);
});
test('concurrent-script guard executes before send or auto cycle, progress not fabricated', () => {
  assert.match(script, /function toggle\(\) \{\s*syncRoute\(\);\s*if \(checkConflicts\(\)\) return;/);
  assert.match(script, /async function deliver\(step\) \{\s*if \(checkConflicts\(\) \|\| !moduleOn\('engine'\)\) return;/);
  assert.match(script, /Progreso aún no verificable/);
  assert.match(script, /lastDenominator/);
});


test('cross-tab lease is preserved from latest stable baseline', () => {
  assert.match(script, /const LEASE_PREFIX = 'avanza-v4-single-tab:'/);
  assert.match(script, /if \(!acquireLease\(\)\)/);
  assert.match(script, /if \(!renewLease\(\)\)/);
  assert.match(script, /function pause\([\s\S]*?releaseLease\(\);/);
  const {t,mem}=harness();
  assert.equal(t.acquireLease(), true);
  assert.equal(t.renewLease(), true);
  const active = Object.keys(mem).find(key => key.startsWith('avanza-v4-single-tab:'));
  assert.ok(active);
  t.releaseLease();
  assert.equal(mem[active], undefined);
});

test('another tab lease refuses duplicate control and preserves foreign owner', () => {
  const {t,mem}=harness();
  const key='avanza-v4-single-tab:chatgpt.com/c/test';
  mem[key]=JSON.stringify({owner:'foreign-tab',expires:Date.now()+300000});
  assert.equal(t.acquireLease(),false);
  assert.equal(JSON.parse(mem[key]).owner,'foreign-tab');
});

test('permanent health badge names the installed version without pretending the remote is checked', () => {
  assert.match(script, /data-value="health"/);
  assert.match(script, /versión remota NO verificada/);
  assert.match(script, /function updateHealth\(\)/);
  assert.match(script, /updateHealth\(\)/);
});
test('registry identifies 4.9 source and retains historical 4.8 branch', () => {
  assert.equal(registry.channels.stable.version_verified_in_repository, '4.9.0');
  assert.equal(registry.channels.candidate.version, '4.9.1');
  assert.equal(registry.channels.candidate.status, 'draft_release_candidate');
  assert.ok(registry.limitations.some(text => text.includes('Native Android/iOS')));
  assert.ok(registry.release_gates.includes('authenticated_chatgpt_browser_smoke_pass'));
  assert.ok(registry.variants.some(v => v.name === 'AVANZA Neon Mission Control' && v.status === 'stable'));
});

test('real-browser canary has machine-readable DOM and conversation proof markers', () => {
  assert.match(script, /data-avanza-client-version/);
  assert.match(script, /AVANZA_CLIENT_PROOF: \$\{INSTALLED_VERSION\}/);
});

test('existing and new unfinished web chats bootstrap after route settle', () => {
  assert.match(script,/pageBaselineAssistantFingerprint/);
  assert.match(script,/Universal fixed-point bootstrap/);
  assert.match(script,/hasConversation/);
  assert.match(script,/fallbackProcessId\(\)/);
  assert.doesNotMatch(script,/latestFingerprint !== pageBaselineAssistantFingerprint/);
});

test('full-spectrum operator contract rejects passive status-only behavior', () => {
  assert.match(script,/CONTRATO OPERADOR TOTAL/);
  assert.match(script,/AGOTAMIENTO MATERIAL OBLIGATORIO/);
  assert.match(script,/BÚSQUEDA ACTIVA DE CAPACIDAD/);
  assert.match(script,/Un bloqueo de una herramienta no es bloqueo del objetivo/);
  assert.match(script,/No repitas una consulta negativa como si agotara la clase de solución/);
});

test('execution wording scopes requirements to concrete actions instead of generic filters', () => {
  assert.doesNotMatch(script,/acciones seguras y autorizadas con valor positivo/);
  assert.match(script,/REQUISITOS REALES DEL CASO/);
  assert.match(script,/no generalices el bloqueo de una ruta a todo el objetivo/);
});

test('multiproject cockpit exposes six independent module switches', () => {
  for (const name of ['engine','auto','progress','sync','game','aura']) assert.match(script, new RegExp('data-module="'+name+'"'));
  assert.match(script, /🎛️ MACROS · ON\/OFF/);
});
test('project cards keep ON-OFF and AUTO-MANUAL state independently', () => {
  assert.match(script, /function projectMode\(id\)/);
  assert.match(script, /data-project-enabled/);
  assert.match(script, /data-project-auto/);
  assert.match(script, /projectModes/);
});
test('project state persists beyond a single tab session', () => {
  assert.match(script, /localStorage\.setItem\(storageKey\(\),JSON\.stringify\(state\)\)/);
  assert.match(script, /localStorage\.getItem\(storageKey\(\)\)\|\|sessionStorage\.getItem/);
});
test('cross-tab project registry uses BroadcastChannel without remote APIs', () => {
  assert.match(script, /new BroadcastChannel\(CHANNEL_NAME\)/);
  assert.match(script, /channel\.postMessage/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket\(/);
});
test('continuity has no fixed execution-count stop and legacy park no longer halts tick', () => {
  assert.doesNotMatch(script, /Límite de 12 continuaciones automáticas/);
  assert.doesNotMatch(script, /MAX_AUTOMATIC_FOLLOWUPS/);
  assert.match(script,/state\.stalled > MAX_STALLED_CYCLES/);
  assert.match(script,/ROTAR_CAPACIDAD_Y_REABRIR_UNIVERSO/);
  const tick=script.slice(script.indexOf('  async function tick() {'),script.indexOf('  function toggle() {'));
  assert.doesNotMatch(tick,/parkUnproductiveLoop\(\)/);
  assert.match(script,/legacy parked chats must not remain permanently frozen/);
});
test('game mode keeps XP explicitly separate from verified progress', () => {
  assert.match(script, /XP\/racha motivan/);
  assert.match(script, /CFI\/APRENDIZAJE/);
});

test('seed catalog includes active projects and never fabricates percentages for unscored lanes', () => {
  for (const id of ['COCKPIT-TOTAL-v1','CFI-E2-2026-10-16','GLOBAL-VALUE-OS','BTS-LIMA','VELVETBOX','KASA-VIVA','YERABELL','AR-TRACKER-ETSY']) assert.match(script,new RegExp("'"+id+"'"));
  assert.match(script,/current_pct:null/);
  assert.match(script,/CFI-E2-2026-10-16[\s\S]*?current_pct:15\.8/);
});


test('Learn Quest protocol is readable and generic across courses', () => {
  assert.match(script,/function parseQuestLine\(text\)/);
  assert.match(script,/🎮\\s\*QUEST/);
  assert.match(script,/function parseQuestResult\(text\)/);
  assert.match(script,/QUEST_RESULT/);
  assert.match(script,/LEARN QUEST/);
});
test('Learn Quest persists XP separately from verified project percentage', () => {
  assert.match(script,/const LEARN_KEY = 'avanza-v4-learn-quest-v1'/);
  assert.match(script,/localStorage\.setItem\(LEARN_KEY/);
  assert.match(script,/porcentaje = dominio verificado/);
});
test('academic AUTO lane waits while a learner owes an answer', () => {
  assert.match(script,/L\?\.status==='AWAITING_USER'/);
  assert.match(script,/return false;/);
});
test('Learn Quest offers mission hint retry boss and map controls', () => {
  for (const action of ['start','hint','retry','boss','map']) assert.match(script,new RegExp('data-learn-action="'+action+'"'));
  assert.match(script,/function sendLearningAction\(kind\)/);
});


test('verified percentages have a persistent ribbon independent of the current ring', () => {
  assert.match(script,/data-value="progress-ribbon"/);
  assert.match(script,/function renderProgressRibbon\(\)/);
  assert.match(script,/progress-chip/);
  assert.match(script,/CONTRATO VISUAL DE PORCENTAJE/);
});
test('HUD rescue restores a panel that became invisible or offscreen', () => {
  assert.match(script,/function ensurePanelVisible\(\)/);
  assert.match(script,/HUD rescatado a una posición visible/);
  assert.match(script,/ensurePanelVisible\(\); maybeAutoStart/);
});
test('interactive quest supports direct free-text answers and click choices', () => {
  assert.match(script,/function sendLearningAnswer\(answer\)/);
  assert.match(script,/data-learn-answer/);
  assert.match(script,/data-learn-submit/);
  assert.match(script,/data-quest-choice/);
  assert.match(script,/QUEST_CHOICES/);
});
test('quest choices parser accepts multiple labeled options', () => {
  assert.match(script,/function parseQuestChoices\(text\)/);
  assert.match(script,/A-F1-6/);
});


test('recoverable editor and macro-conflict failures defer instead of clearing AUTO', () => {
  const deliver=script.slice(script.indexOf('  async function deliver(step) {'),script.indexOf('  async function tick() {'));
  assert.match(deliver,/El editor no aceptó el mensaje todavía; no se envió nada y AUTO reintentará/);
  assert.match(deliver,/Error recuperable del editor antes del envío; AUTO reintentará/);
  assert.doesNotMatch(deliver,/pause\('El editor no aceptó/);
  assert.match(script,/Conflicto de macro detectado: bloqueo envíos y reevalúo automáticamente/);
});

test('v4.9 preserves the full-screen Mission Control visual mode', () => {
  assert.match(script,/const INSTALLED_VERSION = '4\.9\.0-[^']+'/);
  assert.match(script,/data-action="cinema"/);
  assert.match(script,/function renderMissionControl\(\)/);
  assert.match(script,/function toggleMissionControl\(force\)/);
  assert.match(script,/MISSION CONTROL/);
  assert.match(script,/mc-orb/);
  assert.match(script,/mc-road/);
  assert.match(script,/BOSS BATTLE/);
});
test('Mission Control keeps project percentages and Learn Quest interactions wired', () => {
  assert.match(script,/missionProjectRows\(\)/);
  assert.match(script,/data-quest-choice/);
  assert.match(script,/data-learn-submit/);
  assert.match(script,/data-learn-action="boss"/);
  assert.match(script,/formatPercent\(projects\['CFI-E2-2026-10-16'\]\?\.current_pct\)/);
});
