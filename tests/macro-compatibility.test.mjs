import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../avanza_macro_maestro_v4.user.js', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../avanza_macro.user.js', import.meta.url), 'utf8');
const registry = JSON.parse(readFileSync(new URL('../macro-registry.json', import.meta.url), 'utf8'));
const version = (s) => s.match(/^\/\/ @version\s+(\S+)$/m)?.[1];
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));

test('JavaScript candidate parses without running in page context', () => {
  assert.doesNotThrow(() => new Script(source));
});
test('candidate and legacy versions match registry', () => {
  assert.equal(version(source), registry.channels.candidate.version);
  assert.equal(version(legacy), registry.known_variants[0].source_version);
});
test('stable and candidate channels are distinguished', () => {
  assert.equal(registry.channels.stable.branch, 'main');
  assert.equal(registry.channels.stable.verified_source_version, '4.0.2');
  assert.equal(registry.channels.candidate.release_status, 'draft_review_pending');
});
test('canonical update URLs and ChatGPT-only scope remain unchanged', () => {
  const url = 'https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js';
  assert.ok(source.includes('// @updateURL    ' + url));
  assert.ok(source.includes('// @downloadURL  ' + url));
  assert.match(source, /\/\/ @grant\s+none/);
  assert.doesNotMatch(source, /\/\/ @match\s+https:\/\/(?!www\.chatgpt\.com|chatgpt\.com|chat\.openai\.com)/);
});
test('no direct network/secret transport added', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest\b|GM_xmlhttpRequest\b|sendBeacon\s*\(/);
});
test('legacy panel detector recognizes hidden and multiple panels', () => {
  const body = section('  function knownLegacyPanels()', '  function ensureNoLegacyInterference()');
  assert.ok(body.includes('document.getElementById(id)'));
  const ids = ['avanza-universal-control-v1','avanza-macro-maestro-v2','avanza-macro-maestro-v3'];
  const detect = present => runInNewContext(body + '; knownLegacyPanels()', {
    LEGACY_PANEL_IDS: ids,
    document: { getElementById: id => present.includes(id) ? { style: { display: 'none' }} : null }
  });
  assert.equal(detect([]).length, 0);
  assert.equal(detect([ids[0]]).length, 1);
  assert.equal(detect([ids[0], ids[2]]).length, 2);
});
test('guard before delivery, loop progression and user activation', () => {
  assert.match(section('  async function deliver(', '  async function tick('), /ensureNoLegacyInterference\(\)/);
  assert.match(section('  async function tick(', '  function toggle('), /ensureNoLegacyInterference\(\)/);
  assert.match(section('  function toggle(', '  function mount('), /ensureNoLegacyInterference\(\)/);
});
test('status panel displays local version and unverified remote', () => {
  assert.match(source, /data-value="health"/);
  assert.match(source, /versión remota NO verificada/);
  assert.match(source, /posible duplicado/);
});
test('original progress and human-control protections are preserved', () => {
  for (const token of ['function parseReceipt(', 'function buildMessage(', 'MAX_AUTOMATIC_FOLLOWUPS = 12', 'MAX_STALLED_CYCLES = 6', 'draft(findComposer())', 'pause(']) {
    assert.ok(source.includes(token), 'missing: ' + token);
  }
});
test('registry makes limitations and rollback explicit', () => {
  assert.equal(registry.schema_version, 1);
  assert.ok(registry.limitations.some(x => x.includes('not exhaustive')));
  assert.ok(registry.rollback.includes('v4.0.2'));
  assert.ok(registry.release_conditions.includes('authenticated_browser_smoke_test_pass'));
});
