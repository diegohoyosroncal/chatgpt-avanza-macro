import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../avanza_macro_maestro_v4.user.js', import.meta.url), 'utf8');

// Syntax gate.
new Function(source);

const mustContain = [
  '@version      4.9.0',
  "4.9.0-terminal-proof-continuity",
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


// Regression: an assistant's stable partial text during a tool call must not
// trigger the next AUTO cycle. Only the final AVANZA_CONTROL line can advance.
{
  const parserStart=source.indexOf('  function parseReceipt(s) {');
  const parserEnd=source.indexOf('  function terminalEligible(receipt) {',parserStart);
  const gateStart=source.indexOf('    const reply = assistantAfter(pending.ticket);');
  const gateEnd=source.indexOf('    // Do not silently stop after just one repetition',gateStart);
  assert.ok(parserStart>=0 && parserEnd>parserStart && gateStart>=0 && gateEnd>gateStart);
  const parser=source.slice(parserStart,parserEnd);
  const gate=source.slice(gateStart,gateEnd);
  const run=new Function('answer','t','marks', [
    "const safeId=s=>String(s||'').replace(/[^A-Za-z0-9._:-]/g,'-');",
    "const pending={ticket:'AVZ4-test',sentAt:1000};",
    "const assistantAfter=()=>answer;",
    "const isGenerating=()=>false;",
    "const fingerprint=s=>String(s.length);",
    "const replyCandidate={fingerprint:String(answer.length),firstSeen:2000};",
    "const RESPONSE_STABLE_MS=3700;",
    "const now=()=>t;",
    "const setStatus=(...xs)=>marks.push(xs);",
    parser, gate, "return receipt;"
  ].join('\n'));
  const partialMarks=[];
  assert.equal(run('Herramientas en progreso...',18000,partialMarks),undefined);
  assert.ok(partialMarks.some(xs=>String(xs[0]).includes('AVANZA_CONTROL')));
  assert.equal(run('AVANZA_CONTROL: {"status":"CONTINUE"}\nContinuando herramienta',18000,[]),undefined);
  assert.equal(run('Respuesta.\nAVANZA_CONTROL: {"status":"INVALID_JSON",}',18000,[]),undefined);
  const sealed='Respuesta final.\nAVANZA_CONTROL: {"status":"CONTINUE","process_id":"AVANZA-MACRO","current_pct":null}';
  assert.equal(run(sealed,18000,[]).status,'CONTINUE');
  assert.equal(run(sealed,18000,[]).processId,'AVANZA-MACRO');
}
