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
