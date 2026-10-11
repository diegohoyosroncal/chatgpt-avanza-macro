// ==UserScript==
// @name         AVANZA — Macro Maestro · Piloto Automático
// @namespace    https://chatgpt.com/
// @version      4.1.0
// @description  Cockpit multiproyecto para ChatGPT web: módulos ON/OFF, AUTO/MANUAL, progreso independiente, misiones y sincronización segura entre pestañas.
// @updateURL    https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js
// @downloadURL  https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro_maestro_v4.user.js
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @match        https://chat.openai.com/*
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  // Auto-continúa solo proyectos identificados que estén explícitamente en AUTO.
  // No llama APIs remotas, no lee credenciales y no elude permisos/herramientas de ChatGPT.
  const APP = 'avanza-macro-maestro-v4';
  const INSTALLED_VERSION = '4.1.0-multi1';
  const CONTROL_KEY = 'avanza-v4-control-center-v1';
  const PROJECTS_KEY = 'avanza-v4-project-registry-v1';
  const CHANNEL_NAME = 'avanza-v4-project-bus-v1';
  const AURA_STYLE_ID = 'avanza-v4-aura-style';
  const UI_KEY = 'avanza-master-ui-v4';
  const LEGACY_IDS = ['avanza-universal-control-v1','avanza-macro-maestro-v2','avanza-macro-maestro-v3','diego-mision-autonomia-v1'];
  const MARK = 'MACRO MAESTRO — AVANZA AL OBJETIVO';
  const RECEIPT = 'AVANZA_CICLO_ID:';
  // Sin STOP por número de ejecuciones: el ciclo termina por objetivo verificado, gate real, OFF manual o falta demostrada de acción segura.
  const MAX_STALLED_CYCLES = 6;
  const MAX_NO_RECEIPT_CYCLES = 3;
  const MIN_SEND_GAP_MS = 3200;
  const RESPONSE_STABLE_MS = 3700;
  const CHECK_EVERY_MS = 700;
  const SESSION_PREFIX = 'avanza-v4-meta:';
  const LEASE_PREFIX = 'avanza-v4-single-tab:';
  const LEASE_TTL_MS = 45000; // browser-profile, same-chat UI coordination; not an external runtime lock
  const TAB_OWNER = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const STATES = Object.freeze({ IDLE: 'IDLE', READY: 'READY', WAITING: 'WAITING', PAUSED: 'PAUSED' });
  const EXIT = new Set(['VERIFIED_COMPLETE', 'HUMAN_GATE_PROVEN', 'NO_SAFE_ACTION']);
  let phase = STATES.IDLE;
  let busy = false;
  let state = null;
  let chatKey = currentChatKey();
  let pending = null;
  let replyCandidate = { fingerprint: '', firstSeen: 0 };
  let observer = null;
  let timer = null;
  let mountQueued = false;
  let root = null;
  let statusNode = null;
  let button = null;
  let dashboard = null;
  let restoreMeta = null;
  let lastAudit = 0;
  let stopReason = '';
  let presentation = readPresentation();
  let drag = null;
  let conflictSummary = '';
  let control = readControl();
  let projects = readProjects();
  let channel = null;

  function currentChatKey() {
    // Route is scoped to this web chat, not a global prompt or another chat.
    return location.hostname + location.pathname + location.search.replace(/([?&])utm_[^&]*/g, '');
  }
  function storageKey() { return SESSION_PREFIX + chatKey; }
  function leaseKey() { return LEASE_PREFIX + chatKey; }
  function readLease() {
    try { return JSON.parse(localStorage.getItem(leaseKey()) || 'null'); }
    catch { return null; }
  }
  function leaseIsMine() {
    try {
      const lease = readLease();
      return Boolean(lease && lease.owner === TAB_OWNER && lease.expires > now());
    } catch { return false; }
  }
  function acquireLease() {
    // Coordinate active sending tabs for the SAME ChatGPT conversation on this
    // browser profile. Never persist prompts, messages, tokens or credentials.
    try {
      const old = readLease();
      if (old && old.owner !== TAB_OWNER && old.expires > now()) return false;
      localStorage.setItem(leaseKey(), JSON.stringify({ owner: TAB_OWNER, expires: now() + LEASE_TTL_MS }));
      return leaseIsMine();
    } catch { return false; } // fail closed if cross-tab coordination is unavailable
  }
  function renewLease() {
    if (!leaseIsMine()) return false;
    try {
      localStorage.setItem(leaseKey(), JSON.stringify({ owner: TAB_OWNER, expires: now() + LEASE_TTL_MS }));
      return leaseIsMine();
    } catch { return false; }
  }
  function releaseLease() {
    try { if (readLease()?.owner === TAB_OWNER) localStorage.removeItem(leaseKey()); }
    catch { /* inaccessible profile storage */ }
  }

  function readControl() {
    const defaults = { modules:{engine:true,auto:true,progress:true,sync:true,game:true,aura:true}, backgroundAuto:true, projectModes:{} };
    try {
      const raw = JSON.parse(localStorage.getItem(CONTROL_KEY) || 'null');
      return raw && typeof raw === 'object' ? { ...defaults, ...raw, modules:{...defaults.modules,...(raw.modules||{})}, projectModes:{...(raw.projectModes||{})} } : defaults;
    } catch { return defaults; }
  }
  function saveControl() {
    try { localStorage.setItem(CONTROL_KEY, JSON.stringify(control)); } catch {}
    renderModules(); renderProjects(); applyAura(); broadcast({type:'control',control});
  }
  function moduleOn(name) { return control.modules?.[name] !== false; }
  function projectMode(id) {
    const row=control.projectModes?.[id]||{};
    return { enabled:row.enabled!==false, auto:row.auto!==false };
  }
  function setProjectMode(id,patch) {
    if(!id) return;
    control.projectModes[id]={...projectMode(id),...patch};
    saveControl();
  }
  function readProjects() {
    try { const raw=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}'); return raw&&typeof raw==='object'?raw:{}; } catch { return {}; }
  }
  function saveProjects() {
    try { localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects)); } catch {}
    renderProjects(); broadcast({type:'projects',projects});
  }
  function safeId(value) { return String(value||'').replace(/[^A-Za-z0-9._:-]/g,'-').replace(/-+/g,'-').slice(0,96); }
  function projectKey() { return safeId(state.processId)||''; }
  function upsertProjectSnapshot() {
    const id=projectKey(); if(!id) return;
    const prev=projects[id]||{};
    projects[id]={...prev,id,chatKey,objective:state.objective||prev.objective||id,current_pct:state.lastPercent,previous_pct:state.lastDelta!==null&&state.lastPercent!==null?state.lastPercent-state.lastDelta:(prev.previous_pct??null),delta_pp:state.lastDelta,numerator:state.lastNumerator,denominator:state.lastDenominator,next_action:state.nextAction||prev.next_action||'',blocker:state.blocker||'',updated_at:state.lastUpdated||new Date().toISOString(),status:state.lastStatus||prev.status||'CONTINUE'};
    saveProjects();
  }
  function freshState() {
    return { cycles:0,totalSent:0,stalled:0,missingReceipts:0,lastPercent:null,lastDenominator:null,lastDelta:null,lastResponseFingerprint:'',repeatedResponses:0,lastStrategy:'',lastStatus:'',objective:'',nextAction:'',blocker:'',lastNumerator:null,lastProof:'',lastUpdated:'',lastTicket:'',processId:'' };
  }
  function recoverState() {
    try {
      const raw=localStorage.getItem(storageKey())||sessionStorage.getItem(storageKey());
      const parsed=raw&&JSON.parse(raw);
      return parsed&&typeof parsed==='object'?{...freshState(),...parsed}:freshState();
    } catch { return freshState(); }
  }
  function saveState() {
    try { localStorage.setItem(storageKey(),JSON.stringify(state)); } catch {}
    try { sessionStorage.setItem(storageKey(),JSON.stringify(state)); } catch {}
    upsertProjectSnapshot();
  }
  function broadcast(payload) { if(!moduleOn('sync')||!channel) return; try { channel.postMessage({source:TAB_OWNER,at:Date.now(),...payload}); } catch {} }
  function initChannel() {
    if(!moduleOn('sync')||typeof BroadcastChannel==='undefined') return;
    try {
      channel?.close?.(); channel=new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage=event=>{
        const msg=event.data||{}; if(msg.source===TAB_OWNER) return;
        if(msg.type==='projects'&&msg.projects&&typeof msg.projects==='object'){ projects={...projects,...msg.projects}; try{localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));}catch{} renderProjects(); }
        if(msg.type==='control'&&msg.control&&typeof msg.control==='object'){ control={...control,...msg.control,modules:{...control.modules,...(msg.control.modules||{})},projectModes:{...control.projectModes,...(msg.control.projectModes||{})}}; try{localStorage.setItem(CONTROL_KEY,JSON.stringify(control));}catch{} renderModules();renderProjects();applyAura(); }
      };
    } catch { channel=null; }
  }
  state = recoverState();
  function fingerprint(s) {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(36) + ':' + s.length;
  }
  function now() { return Date.now(); }
  function visible(e) {
    if (!e || !e.isConnected) return false;
    const r = e.getBoundingClientRect();
    const c = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none';
  }
  function findComposer() {
    const sels = [
      '#prompt-textarea[contenteditable="true"]', '#prompt-textarea',
      '[data-testid="composer-input"][contenteditable="true"]',
      'form [contenteditable="true"][role="textbox"]', 'form textarea',
    ];
    for (const sel of sels) {
      const e = [...document.querySelectorAll(sel)].find(visible);
      if (e) return e;
    }
    return null;
  }
  function draft(e) {
    return (e?.isContentEditable ? (e.innerText || e.textContent) : (e?.value || '')).trim();
  }
  function isGenerating() {
    if (document.querySelector('button[data-testid="stop-button"],button[data-testid="composer-stop-button"]')) return true;
    return [...document.querySelectorAll('button[aria-label]')].some(e => visible(e) &&
      /^(stop generating|stop response|detener generaci[oó]n|detener respuesta|stop streaming)$/i.test((e.getAttribute('aria-label') || '').trim()));
  }
  function findSend() {
    for (const sel of [
      'button[data-testid="send-button"]', 'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]',
      'button[aria-label="Enviar mensaje"]', 'button[aria-label="Enviar"]',
      'form button[type="submit"]'
    ]) {
      const b = [...document.querySelectorAll(sel)].find(e => visible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true');
      if (b) return b;
    }
    return null;
  }
  function fillComposer(e, message) {
    if (e.isContentEditable) {
      e.focus();
      const range = document.createRange();
      range.selectNodeContents(e);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges(); sel?.addRange(range);
      if (!document.execCommand('insertText', false, message)) {
        e.textContent = message;
        e.dispatchEvent(new InputEvent('input', { bubbles: true, data: message, inputType: 'insertText' }));
      }
    } else {
      const proto = e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(e, message); else e.value = message;
      e.dispatchEvent(new InputEvent('input', { bubbles: true, data: message, inputType: 'insertText' }));
    }
    return draft(e).includes(message.slice(0, 60));
  }
  function allMessages() {
    return [...document.querySelectorAll('[data-message-author-role]')].filter(x =>
      x.getAttribute('data-message-author-role') === 'user' || x.getAttribute('data-message-author-role') === 'assistant');
  }
  function ownMessage(ticket) {
    return allMessages().find(x => x.getAttribute('data-message-author-role') === 'user' && (x.textContent || '').includes(ticket));
  }
  function assistantAfter(ticket) {
    const nodes = allMessages();
    const idx = nodes.findIndex(x => x.getAttribute('data-message-author-role') === 'user' && (x.textContent || '').includes(ticket));
    if (idx < 0) return '';
    const after = nodes.slice(idx + 1);
    // If a user interrupts or sends an ordinary message, autonomous replies stop.
    if (after.some(x => x.getAttribute('data-message-author-role') === 'user')) return '<<USER_INTERRUPTED>>';
    const assistants = after.filter(x => x.getAttribute('data-message-author-role') === 'assistant');
    return assistants.length ? (assistants[assistants.length - 1].innerText || assistants[assistants.length - 1].textContent || '').trim() : '';
  }
  function parseReceipt(s) {
    const lines = s.match(/AVANZA_CONTROL\s*:\s*\{[^\n]*\}/ig) || [];
    for (const item of lines.reverse()) {
      try {
        const p = JSON.parse(item.substring(item.indexOf('{')));
        if (p && typeof p.status === 'string') {
          const status = p.status.toUpperCase().replace(/[^A-Z_]/g, '');
          return {
            status: ['CONTINUE','VERIFIED_COMPLETE','HUMAN_GATE_PROVEN','NO_SAFE_ACTION'].includes(status) ? status : 'CONTINUE',
            delta: Number.isFinite(Number(p.delta_pp)) && p.delta_pp !== null ? Number(p.delta_pp) : null,
            percent: Number.isFinite(Number(p.current_pct)) && p.current_pct !== null ? Number(p.current_pct) : null,
            denominator: Number.isInteger(Number(p.denominator)) && Number(p.denominator) > 0 ? Number(p.denominator) : null,
            evidence: typeof p.evidence === 'string' ? p.evidence.slice(0, 120) : '',
            objective: typeof p.objective === 'string' ? p.objective.slice(0, 140) : '',
            nextAction: typeof p.next_action === 'string' ? p.next_action.slice(0, 160) : '',
            blocker: typeof p.blocker === 'string' ? p.blocker.slice(0, 160) : '',
            numerator: Number.isInteger(Number(p.numerator)) && p.numerator !== null && Number(p.numerator) >= 0 ? Number(p.numerator) : null,
            previous: typeof p.previous_pct === 'number' && p.previous_pct >= 0 && p.previous_pct <= 100 ? p.previous_pct : null,
            processId: safeId(typeof p.process_id === 'string' ? p.process_id : ''),
          };
        }
      } catch { /* text not valid JSON; no false receipt */ }
    }
    return null;
  }
  function strategy() {
    if (state.stalled >= 6) return 'AUDITORIA_PROFUNDA_CREAR_O_SUSTITUIR_CAPACIDAD';
    if (state.stalled >= 3 || state.missingReceipts >= 2) return 'REVISAR_RUTA_Y_CAMBIAR_ESTRATEGIA';
    if (state.lastDelta === null) return 'RECUPERAR_METRICA_Y_VERIFICAR';
    if (state.lastDelta > 0) return 'EJECUTAR_SIGUIENTE_HITO';
    if (state.stalled >= 1) return 'COMPARAR_ALTERNATIVAS_Y_EJECUTAR';
    return 'AVANZAR_Y_VERIFICAR';
  }
  function buildMessage(ticket, step) {
    const chosen = strategy();
    const core = [
      `${MARK} — CONTROL ADAPTATIVO ${ticket}. Esta señal AGREGA capacidades; NO reemplaza objetivo, autorizaciones, decisiones, instrucciones ni checkpoints de este chat.`,
      `Decisión interna de interfaz: ${chosen}. PROCESS_ID actual: ${state.processId || 'POR RECUPERAR'}. Ciclo local ${step}. Anterior conocido (NO prueba externa): progreso ${state.lastPercent ?? 'NO DETERMINABLE'}%, denominador ${state.lastDenominator ?? 'NO DETERMINABLE'}, delta ${state.lastDelta ?? 'NO DETERMINABLE'} pp, ciclos sin progreso ${state.stalled}.`,
      'RECUPERA estado actual desde este chat y fuentes canónicas disponibles. Evalúa primero cuál es el verdadero objetivo pendiente, su dueño y qué cambió desde la respuesta anterior. No dependas de una cifra inferida de la interfaz para afirmar efectos.',
      'DECIDE TÚ la mejor acción: ejecutar, verificar, conciliar, corregir, investigar globalmente, adoptar/reutilizar/integrar/fusionar/delegar legítimamente/sustituir/adaptar/construir una capacidad faltante, detener una estrategia de valor negativo o cambiar de rumbo. No conviertas AVANZAR en ejecutar por ejecutar, ni le pidas al usuario escoger entre alternativas.',
      'EJECUTA dentro de este turno las acciones seguras y autorizadas con valor positivo, verifica cada una en una fuente independiente, distingue COLA→ENTREGA→ACCIÓN→EFECTO y sigue con las demás. Si llevamos 3 intentos sin DELTA verificable, identifica causa raíz y realiza una intervención MATERIALMENTE diferente antes de repetir.',
      'Puedes evaluar alternativas mundiales y crear componentes faltantes cuando sea legítimo, pero NUNCA saltar permisos, MFA, consentimiento, términos, límites de herramienta o costos. No generar gastos, pagos, contratos, cambios irreversibles o despliegues riesgosos sin autorización precisa. Preserva single-owner, deduplicación, idempotencia y protección de secretos.',
      'La continuidad fuera del chat requiere el ejecutor externo existente AUTORIZADO y sus recibos; no basta enviar mensajes con la macro ni crear más cron/tareas. No simules persistencia o cumplimiento universal en otros chats. Esta macro puede proponer una continuación del hilo web abierto, pero la ejecución real debe comprobarse en herramientas autorizadas.',
      'Antes de terminar repite la revisión de fronteras útiles, guarda checkpoint con objetivo, owner, receipt, bloqueo, siguiente acción exacta y condición de reanudación si procede. Reporta SIEMPRE objetivo, porcentaje anterior→actual con numerador/denominador, delta pp, pendiente, efecto realmente verificado, bloqueo y siguiente hito. Si no existe denominador defendible di NO DETERMINABLE.',
      'MULTIPROYECTO: identifica un PROCESS_ID estable para este objetivo y NO mezcles su porcentaje con otro proceso. Otros proyectos independientes pueden avanzar en sus propios chats/tabs; conserva owner y escala del proceso actual.',
      'CFI/APRENDIZAJE: usa misiones cortas, feedback interactivo, colores y juego cuando ayuden, pero XP/estética jamás sustituyen dominio verificable. El porcentaje solo sube al cerrar gates de conocimiento o práctica.',
      'Para el control local termina con EXACTAMENTE UNA línea JSON de metadatos, después del informe: AVANZA_CONTROL: {"status":"CONTINUE","process_id":"","objective":"","previous_pct":null,"current_pct":null,"delta_pp":null,"numerator":null,"denominator":null,"evidence":"","blocker":"","next_action":""}. Estos valores son declaraciones del asistente y NO recibos independientes. Usa VERIFIED_COMPLETE solo si el OBJETIVO PRINCIPAL está completamente verificado con fuente primaria, HUMAN_GATE_PROVEN solo si se agotaron alternativas legítimas, NO_SAFE_ACTION solo si realmente no queda acción segura positiva. Nunca afirmes resultado final por CI, cola DONE, pruebas aisladas, documentos o esta macro. Mantén el denominador del MISMO objetivo, no mezcles ámbitos.',
      `${RECEIPT} ${ticket}`,
    ];
    if (state.stalled >= 3) core.push('AUDITORÍA DE ESTANCAMIENTO OBLIGATORIA: compara al menos una ruta materialmente diferente con la estrategia anterior, adopta una mejor si la evidencia lo soporta y prueba el efecto en vez de solo reintentar el mismo servicio o herramienta.');
    return core.join('\n\n');
  }
  function setStatus(message, warning = false) {
    if (statusNode) {
      statusNode.textContent = message;
      statusNode.dataset.warning = warning ? 'true' : 'false';
    }
    updateDashboard();
  }
  function formatPercent(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? (Math.round(value * 100) / 100).toLocaleString('es-PE', {maximumFractionDigits: 2}) + '%' : '—';
  }
  function escapeText(value, max=100) { return String(value || '').replace(/[\u0000-\u001f]/g, ' ').slice(0,max); }
  function updateDashboard() {
    if (!dashboard) return;
    const pct = state.lastPercent;
    const known = typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= 100;
    const circle = dashboard.querySelector('.ring');
    if (circle) circle.style.setProperty('--fill', known ? Math.min(100, Math.max(0, pct)) : 0);
    const set = (name,text) => {const el = dashboard.querySelector(`[data-value="${name}"]`); if (el) el.textContent = text;};
    set('percent',formatPercent(pct));
    const prior = state.lastDelta !== null && known ? pct - state.lastDelta : null;
    set('transition', `${formatPercent(prior)} → ${formatPercent(pct)}`);
    set('delta', state.lastDelta === null ? 'Δ — pp' : `Δ ${state.lastDelta > 0 ? '+' : ''}${state.lastDelta.toLocaleString('es-PE')} pp`);
    set('fraction', state.lastNumerator !== null && state.lastDenominator ? `${state.lastNumerator}/${state.lastDenominator} hitos` : state.lastDenominator ? `Base ${state.lastDenominator} hitos` : 'Base no validada');
    set('pending',known ? `${formatPercent(100-pct)} pendiente` : 'Pendiente —');
    set('objective', escapeText(state.objective || 'Objetivo del chat · por recuperar',88));
    set('stage', phase === STATES.WAITING ? 'ESPERANDO RESPUESTA' : phase === STATES.READY ? 'DECIDIENDO RUTA' : phase === STATES.PAUSED ? 'PAUSADA' : 'DISPONIBLE');
    set('loops', `${state.cycles || 0} ciclos · ${state.stalled || 0} sin avance`);
    set('next', escapeText(state.nextAction || 'El siguiente hito se decide según evidencia del chat.',112));
    const bar = dashboard.querySelector('.bar-fill'); if (bar) { bar.style.width = known ? `${pct}%` : '0%'; if (known) { bar.parentElement.setAttribute('aria-valuemin','0'); bar.parentElement.setAttribute('aria-valuemax','100'); bar.parentElement.setAttribute('aria-valuenow',String(pct)); bar.parentElement.removeAttribute('aria-valuetext'); } else { bar.parentElement.removeAttribute('aria-valuenow'); bar.parentElement.setAttribute('aria-valuetext','Progreso aún no verificable'); } }
    const tone = dashboard.querySelector('.tone');
    if (tone) tone.dataset.level=state.stalled>=3?'risk':phase===STATES.WAITING||phase===STATES.READY?'live':'idle';
  }
  function render() {
    if (!button) return;
    const active = phase === STATES.READY || phase === STATES.WAITING;
    button.textContent = active ? '■  DETENER CICLO' : '▶  AVANZAR';
    button.classList.toggle('active',active);
    button.disabled = busy || conflicts().length > 0;
    button.setAttribute('aria-pressed', String(active));
    updateDashboard();
    updateHealth();
  }
  function pause(reason, warn = false) {
    phase = STATES.PAUSED;
    releaseLease();
    pending = null;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    stopReason = reason;
    setStatus(reason, warn);
    render();
    saveState();
  }
  function syncRoute() {
    const current = currentChatKey();
    if (current === chatKey) return;
    const wasRunning = phase === STATES.READY || phase === STATES.WAITING;
    releaseLease(); // release the previous chat lease BEFORE switching keys
    chatKey = current;
    state = recoverState();
    pending = null;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    phase = STATES.IDLE;
    stopReason = '';
    if (wasRunning) setStatus('Chat cambiado: pausé el ciclo anterior. AVANZAR funciona aquí.', true);
    else setStatus('Lista en este chat. Se activa solo al pulsar AVANZAR.');
    render();
  }
  async function deliver(step) {
    if (checkConflicts()) return;
    if (busy || phase !== STATES.READY || pending) return;
    busy = true; render();
    try {
      syncRoute();
      if (phase !== STATES.READY) return;
      if (!renewLease()) { pause('Otro panel tiene el control de este chat; no duplico envíos.', true); return; }
      if (document.hidden) { pause('Pausada: pestaña no visible. Evita envíos inesperados.', true); return; }
      if (isGenerating()) { setStatus('Respuesta en curso; no duplico mensajes.'); return; }
      if (state.totalSent >= MAX_AUTOMATIC_FOLLOWUPS + 1) { pause('Límite de seguridad alcanzado: revisa el resultado antes de reactivar.', true); return; }
      const c = findComposer();
      if (!c) { pause('No encuentro el cuadro de mensaje; no se envió nada.', true); return; }
      if (draft(c)) { pause('Hay un borrador escrito. Se conservó intacto.', true); return; }
      const send = findSend();
      if (!send) { pause('No hay botón Enviar habilitado. No se envió nada.', true); return; }
      const ticket = `AVZ4-${String(now())}-${state.totalSent + 1}`;
      const message = buildMessage(ticket, step);
      if (!fillComposer(c, message)) { pause('El editor no aceptó el mensaje; no se envió nada.', true); return; }
      await new Promise(resolve => setTimeout(resolve, 120));
      if (!renewLease() || phase !== STATES.READY || isGenerating() || currentChatKey() !== chatKey) { pause('El estado cambió antes de enviar. Se detuvo por seguridad.', true); return; }
      const liveSend = findSend();
      if (!liveSend) { pause('El botón Enviar dejó de estar disponible.', true); return; }
      liveSend.click();
      // Click is not proof of delivery. Wait for the unique user-message receipt in the DOM.
      pending = { ticket, sentAt: now(), lastCheckAt: 0, receiptSeen: false };
      state.lastTicket = ticket;
      state.lastStrategy = strategy();
      state.totalSent += 1;
      state.cycles += 1;
      state.lastUpdated = new Date().toISOString();
      phase = STATES.WAITING;
      setStatus(`Ciclo ${state.cycles} enviado; comprobando respuesta…`);
      saveState();
    } catch {
      pause('Error del editor: envío no acreditado. Verifica el borrador.', true);
    } finally { busy = false; render(); }
  }
  async function tick() {
    if (busy) return;
    syncRoute();
    if (phase !== STATES.READY && phase !== STATES.WAITING) return;
    if (!renewLease()) { pause('El control de este chat está activo en otra pestaña; no duplico mensajes.', true); return; }
    if (document.hidden) return; // hidden tab cannot surprise-send
    if (phase === STATES.READY) {
      if (now() - lastAudit < MIN_SEND_GAP_MS) return;
      lastAudit = now();
      await deliver(state.cycles + 1);
      return;
    }
    if (!pending) return;
    if (pending.receiptSeen && now() - pending.sentAt > 20 * 60 * 1000) {
      pause('Sin respuesta estable durante 20 minutos. No reenvío a ciegas.', true);
      return;
    }
    if (!pending.receiptSeen) {
      if (ownMessage(pending.ticket)) {
        pending.receiptSeen = true;
        setStatus(`Mensaje del ciclo ${state.cycles} visible. Esperando respuesta…`);
      } else if (now() - pending.sentAt > 9500) {
        pause('Se pulsó Enviar, pero no apareció el mensaje. No reenvío.', true);
      }
      return;
    }
    const reply = assistantAfter(pending.ticket);
    if (reply === '<<USER_INTERRUPTED>>') { pause('Intervención humana detectada. No continúo automáticamente.', true); return; }
    if (!reply || isGenerating()) return;
    const key = fingerprint(reply);
    if (key !== replyCandidate.fingerprint) {
      replyCandidate = { fingerprint: key, firstSeen: now() };
      return;
    }
    if (now() - replyCandidate.firstSeen < RESPONSE_STABLE_MS || now() - pending.sentAt < RESPONSE_STABLE_MS) return;
    // Do not silently stop after just one repetition: bounded self-challenge first.
    // The next prompt changes strategy at three stalled cycles; identical replies
    // after that intervention are still capped, so we do not hot-loop forever.
    const identicalResponse = state.lastResponseFingerprint === key;
    state.repeatedResponses = identicalResponse ? (state.repeatedResponses || 0) + 1 : 0;
    state.lastResponseFingerprint = key;
    const receipt = parseReceipt(reply);
    if (!receipt) {
      state.missingReceipts++;
      state.stalled++;
      state.lastDelta = null;
    } else {
      state.missingReceipts = 0;
      state.lastStatus = receipt.status;
      const previousObjective = state.objective;
      const changedObjective = Boolean(receipt.objective && previousObjective && receipt.objective.trim().toLocaleLowerCase() !== previousObjective.trim().toLocaleLowerCase());
      if (receipt.objective && !changedObjective) state.objective = receipt.objective;
      state.nextAction = receipt.nextAction || state.nextAction;
      state.blocker = receipt.blocker || '';
      const numbersPlausible = receipt.percent === null || (receipt.percent >= 0 && receipt.percent <= 100);
      const sameCohort = state.lastDenominator === null || receipt.denominator === state.lastDenominator;
      const mathematicallyConsistent = receipt.previous === null || receipt.delta === null || receipt.percent === null || Math.abs((receipt.percent - receipt.previous) - receipt.delta) <= 0.11;
      const numeratorConsistent = receipt.numerator === null || receipt.denominator === null || (receipt.numerator <= receipt.denominator && Math.abs(100 * receipt.numerator / receipt.denominator - receipt.percent) <= 0.3);
      const validProgress = numbersPlausible && sameCohort && mathematicallyConsistent && numeratorConsistent && !changedObjective && receipt.percent !== null && receipt.denominator !== null;
      if (validProgress) {
        if (receipt.delta !== null && receipt.delta > 0 && receipt.evidence.trim()) state.stalled = 0;
        else state.stalled++;
        state.lastPercent = receipt.percent;
        state.lastDenominator = receipt.denominator;
        state.lastNumerator = receipt.numerator;
        state.lastDelta = receipt.delta;
      } else {
        state.stalled++;
        state.lastDelta = null;
        if (changedObjective) state.blocker = 'Cambio de objetivo no conciliado: conservar escala anterior';
        else if (!numbersPlausible || !mathematicallyConsistent || !numeratorConsistent || !sameCohort) state.blocker = 'Métrica inconsistente: sin incremento acreditable';
      }
      state.lastProof = receipt.evidence || '';
    }
    state.lastUpdated = new Date().toISOString();
    pending = null;
    if (state.repeatedResponses >= 4) {
      saveState();
      pause('Cuatro respuestas consecutivas repetidas: ya intenté cambio de ruta. No repito un bucle inútil.', true);
      return;
    }
    saveState();
    if (receipt && EXIT.has(receipt.status)) {
      pause(receipt.status === 'VERIFIED_COMPLETE' ? 'El asistente declaró objetivo completado: revisa recibos independientes.' :
        receipt.status === 'HUMAN_GATE_PROVEN' ? 'El asistente declaró una intervención humana imprescindible.' :
        'No quedan acciones seguras verificadas; detengo el ciclo.', true);
      return;
    }
    if (state.missingReceipts >= MAX_NO_RECEIPT_CYCLES) {
      pause('Faltan metadatos verificables durante tres respuestas. No continúo a ciegas.', true); return;
    }
    if (state.stalled >= MAX_STALLED_CYCLES) {
      pause('Seis ciclos sin progreso acreditable. Revisión requerida; no más bucle.', true); return;
    }
    if (state.totalSent >= MAX_AUTOMATIC_FOLLOWUPS + 1) {
      pause('Límite de 12 continuaciones automáticas alcanzado. Revisa el resultado.', true); return;
    }
    if (draft(findComposer())) { pause('Hay un borrador nuevo; no lo sobrescribo.', true); return; }
    phase = STATES.READY;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    setStatus(state.stalled >= 3 ? `Ciclo ${state.cycles}: cambio de estrategia por estancamiento…` : `Ciclo ${state.cycles}: evaluando siguiente acción…`);
    render();
  }
  function toggle() {
    syncRoute();
    if (checkConflicts()) return;
    if (busy) return;
    if (phase === STATES.READY || phase === STATES.WAITING) {
      pause('Pausada manualmente. Ningún envío nuevo.', false);
      return;
    }
    // A fresh click resets only local circuit breakers, never canon/effects.
    if (!acquireLease()) { setStatus('Este chat ya está controlado por otra pestaña; no duplico acciones.', true); return; }
    state.totalSent = 0;
    state.stalled = 0;
    state.missingReceipts = 0;
    phase = STATES.READY;
    lastAudit = 0;
    setStatus('Evaluando el contexto para avanzar…');
    render();
    tick();
  }
  function readPresentation() {
    try {
      const old = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
      return {
        theme: ['amber','ocean','violet'].includes(old.theme) ? old.theme : 'amber',
        compact: old.compact === true,
        x: Number.isFinite(old.x) ? old.x : null,
        y: Number.isFinite(old.y) ? old.y : null,
      };
    } catch { return { theme: 'amber', compact: false, x: null, y: null }; }
  }
  function savePresentation() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(presentation)); } catch {}
  }
  function conflicts() { return LEGACY_IDS.filter(id => !!document.getElementById(id)); }
  function applyPresentation() {
    if (!root || !dashboard) return;
    root.dataset.theme = presentation.theme;
    dashboard.classList.toggle('compact', presentation.compact);
    const mini = dashboard.querySelector('[data-action="collapse"]');
    if (mini) {
      mini.textContent = presentation.compact ? '▣' : '▁';
      mini.setAttribute('aria-expanded', String(!presentation.compact));
      mini.setAttribute('aria-label', presentation.compact ? 'Expandir panel AVANZA' : 'Contraer panel AVANZA');
    }
    const theme = dashboard.querySelector('[data-action="theme"]');
    if (theme) theme.setAttribute('aria-label', 'Cambiar color; actual ' + presentation.theme);
    if (presentation.x !== null && presentation.y !== null) {
      const w = Math.max(10, root.offsetWidth || 304);
      const h = Math.max(10, root.offsetHeight || 120);
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.style.left = Math.max(0, Math.min(presentation.x, window.innerWidth - w)) + 'px';
      root.style.top = Math.max(0, Math.min(presentation.y, window.innerHeight - h)) + 'px';
    }
  }
  function dragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId || !root) return;
    const x = Math.max(0, Math.min(drag.x + event.clientX - drag.startX, window.innerWidth - root.offsetWidth));
    const y = Math.max(0, Math.min(drag.y + event.clientY - drag.startY, window.innerHeight - root.offsetHeight));
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = x + 'px'; root.style.top = y + 'px';
    drag.moved = true;
  }
  function dragEnd(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved && root) {
      presentation.x = parseFloat(root.style.left);
      presentation.y = parseFloat(root.style.top);
      savePresentation();
    }
    drag = null;
    window.removeEventListener('pointermove', dragMove);
    window.removeEventListener('pointerup', dragEnd);
    window.removeEventListener('pointercancel', dragEnd);
  }
  function dragStart(event) {
    if (event.button !== 0 || event.target.closest('button') || !root) return;
    const rect = root.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: rect.left, y: rect.top, moved: false };
    window.addEventListener('pointermove', dragMove);
    window.addEventListener('pointerup', dragEnd);
    window.addEventListener('pointercancel', dragEnd);
  }
  function updateHealth() {
    const node = dashboard?.querySelector('[data-value="health"]');
    if (!node) return;
    const duplicates = conflicts();
    node.dataset.warning = duplicates.length ? 'true' : 'false';
    node.textContent = duplicates.length
      ? '⚠ v' + INSTALLED_VERSION + ' · ' + duplicates.length + ' panel(es) antiguos · envíos bloqueados'
      : 'v' + INSTALLED_VERSION + ' local · versión remota NO verificada';
  }
  function checkConflicts() {
    const competing = conflicts();
    updateHealth();
    const label = competing.join(', ');
    if (label === conflictSummary) return competing.length > 0;
    conflictSummary = label;
    if (competing.length) {
      if (phase === STATES.READY || phase === STATES.WAITING) pause('Conflicto: desactiva las macros antiguas en Tampermonkey antes de AVANZAR.', true);
      setStatus('Detectadas macros simultáneas: ' + label + '. Desactívalas en Tampermonkey. No se enviará nada.', true);
    } else if (!stopReason) {
      setStatus('Lista. Versión local ' + INSTALLED_VERSION + '; versión remota no verificada.');
    }
    render();
    return competing.length > 0;
  }
  function mount() {
    if (!document.body || document.getElementById(APP)) return;
    root = document.createElement('aside');
    root.id = APP;
    root.setAttribute('aria-label','AVANZA — Macro Maestro');
    root.style.cssText = 'all:initial;position:fixed;z-index:2147483000;right:max(12px, env(safe-area-inset-right));bottom:max(94px, calc(75px + env(safe-area-inset-bottom)));width:min(304px, calc(100vw - 24px));max-height:75vh;box-sizing:border-box;';
    const shadow = root.attachShadow({mode:'open'});
    const css = document.createElement('style');
    css.textContent = `
      :host{all:initial;--fg:#f8fafc;--muted:#a7b5c7;--accent:#fbbf24;--accent-light:#fde68a;--accent-halo:#fbbf2440;--stroke:rgba(148,163,184,.21)}
      :host([data-theme=ocean]){--accent:#38bdf8;--accent-light:#a5f3fc;--accent-halo:#38bdf840}
      :host([data-theme=violet]){--accent:#c4b5fd;--accent-light:#ede9fe;--accent-halo:#a78bfa40}
      *{box-sizing:border-box} .panel{font:12px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:var(--fg);background:linear-gradient(152deg,rgba(31,44,66,.98),rgba(9,15,26,.99) 64%);border:1px solid rgba(212,231,252,.19);box-shadow:0 21px 55px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.035) inset;border-radius:21px;padding:16px;max-height:75vh;overflow:auto;backdrop-filter:blur(16px);}
      .top{display:flex;align-items:center;gap:9px}.logo{display:grid;place-items:center;width:34px;height:34px;flex:0 0 auto;border-radius:11px;background:linear-gradient(130deg,#ffe28d,#f59e0b);color:#201508;font-size:21px;font-weight:900;box-shadow:0 0 24px #fbbf2440}.topname{flex:1;min-width:0}.brand{font-weight:850;letter-spacing:.09em;font-size:12px}.sub{font-size:10px;color:var(--muted);letter-spacing:.05em}.pill{font-size:8.5px;letter-spacing:.05em;font-weight:850;border:1px solid #4c5b73;border-radius:20px;padding:5px 6px;background:#172335;white-space:nowrap}
      .title{font-size:10.5px;letter-spacing:.02em;color:#cbd5e1;margin:14px 0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.metrics{display:flex;gap:13px;align-items:center}.ring{--fill:0;--angle:calc(var(--fill) * 3.6deg);width:100px;height:100px;flex:0 0 100px;border-radius:50%;background:conic-gradient(var(--accent-light) 0deg,var(--accent) var(--angle),#334155 var(--angle),#334155 360deg);display:grid;place-items:center;box-shadow:0 0 20px #f59e0b22;}.center{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:50%;width:79px;height:79px;background:#111c2d;border:2px solid #182841;text-align:center}.pct{font-size:22px;line-height:1.1;font-weight:820;font-variant-numeric:tabular-nums;letter-spacing:-.06em}.caption{color:#a7b5c7;font-size:9px;margin-top:4px}
      .stat{flex:1;min-width:0}.transition{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}.delta{font-size:11px;font-weight:800;color:#facc15;margin:7px 0}.frac,.pending{font-size:10px;color:#bac9d9}.bar{margin:13px 0 0;height:6px;background:#334155;border-radius:99px;overflow:hidden}.bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-light));border-radius:99px;transition:width .35s ease}
      .tinyrow{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:12px 0 8px;color:#9eacc1;font-size:9px}.tone:before{content:'';display:inline-block;width:6px;height:6px;background:#94a3b8;border-radius:100%;margin-right:5px}.tone[data-level=live]:before{background:#34d399;box-shadow:0 0 9px #34d399aa}.tone[data-level=risk]:before{background:#fb923c}.next{color:#cbd5e1;font-size:10px;line-height:1.35;min-height:14px;max-height:42px;overflow:hidden;margin-bottom:12px}
      .go{position:relative;width:100%;border:0;border-radius:12px;min-height:47px;cursor:pointer;background:linear-gradient(120deg,var(--accent-light),var(--accent) 56%,var(--accent));color:#281b07;font:900 14px/1.2 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;box-shadow:0 5px 19px #fbbf2440;transition:transform .15s,filter .15s}.go:hover{filter:brightness(1.06);transform:translateY(-1px)}.go.active{background:linear-gradient(120deg,#64748b,#475569);color:white;box-shadow:none}.go:focus-visible{outline:3px solid #38bdf8;outline-offset:3px}.go:disabled{opacity:.7;cursor:wait;transform:none}
      .status{font-size:9.5px;color:#cbd5e1;margin-top:10px;min-height:25px;max-height:56px;overflow:hidden}.status[data-warning=true]{color:#fdba74}.foot{font-size:9px;color:#8799ae;border-top:1px solid var(--stroke);padding-top:8px;margin-top:4px;display:flex;justify-content:space-between;gap:5px}.scope{font-weight:700;color:#9fc3d8}
      .health{font-size:9px;line-height:1.3;margin:7px 0 0;padding:5px 7px;color:#a6cee7;border:1px solid var(--stroke);border-radius:8px;background:#0a1b2c}
      .health[data-warning=true]{color:#fdba74;border-color:#c2410c}
      .top{cursor:move;touch-action:none;user-select:none}
      .top button{cursor:pointer;touch-action:manipulation;border:1px solid #41536c;border-radius:8px;color:#e2e8f0;background:#1a2a43;padding:4px 7px;font-size:12px}
      .top button:focus-visible{outline:2px solid var(--accent)}
      .panel.compact{padding:10px}
      .panel.compact .title,.panel.compact .stat,.panel.compact .bar,.panel.compact .tinyrow,.panel.compact .next,.panel.compact .status,.panel.compact .foot{display:none}
      .panel.compact .ring{width:62px;height:62px;flex:0 0 62px;margin:8px auto}
      .panel.compact .center{width:50px;height:50px}
      .panel.compact .pct{font-size:15px}
      .panel.compact .go{min-height:35px;font-size:11px}
      .panel.compact .metrics{justify-content:center}
      :host([data-theme=ocean]) .delta,:host([data-theme=violet]) .delta{color:var(--accent-light)}
      @media(max-width:460px){:host{max-width:calc(100vw - 16px)}}
      @media(max-width:460px){.panel{padding:12px;border-radius:18px}.ring{width:88px;height:88px;flex-basis:88px}.center{width:69px;height:69px}.pct{font-size:19px}}
      @media(prefers-reduced-motion:reduce){.go,.bar-fill{transition:none}}
    `;
    const panel=document.createElement('div');panel.className='panel';
    panel.innerHTML=`<div class="top"><span class="logo" aria-hidden="true">↗</span><div class="topname"><div class="brand">AVANZA</div><div class="sub">MACRO MAESTRO · v4</div></div><button type="button" data-action="theme" title="Cambiar color">◐</button><button type="button" data-action="collapse" title="Compactar / ampliar">▁</button><span class="pill">CON CONTROL</span></div>
      <div class="health" data-value="health" data-warning="false">Versión remota sin verificar</div>
      <div class="title" data-value="objective">Objetivo del chat · por recuperar</div>
      <div class="metrics"><div class="ring"><div class="center"><span class="pct" data-value="percent" aria-label="Porcentaje actual">—</span><span class="caption">AVANCE</span></div></div><div class="stat"><div class="transition" data-value="transition">— → —</div><div class="delta" data-value="delta">Δ — pp</div><div class="frac" data-value="fraction">Base no validada</div><div class="pending" data-value="pending">Pendiente —</div></div></div>
      <div class="bar" role="progressbar" aria-label="Progreso reportado del objetivo del chat"><div class="bar-fill"></div></div>
      <div class="tinyrow"><span class="tone" data-level="idle" data-value="stage">DISPONIBLE</span><span data-value="loops">0 ciclos · 0 sin avance</span></div>
      <div class="next" data-value="next">El siguiente hito se decide según evidencia del chat.</div>
      <button class="go" data-action="avanzar" type="button" aria-label="Avanzar según el contexto o detener el ciclo">▶  AVANZAR</button>
      <div class="status" data-warning="false" role="status" aria-live="polite">Un botón. Decide la ruta según cada respuesta.</div>
      <div class="foot"><span>Informe del asistente ≠ prueba independiente</span><span class="scope">v${INSTALLED_VERSION} · POR CHAT</span></div>`;
    button=panel.querySelector('[data-action="avanzar"]');
    statusNode=panel.querySelector('.status');
    button.addEventListener('click',toggle);
    panel.querySelector('[data-action="theme"]').addEventListener('click', () => {
      const themes = ['amber','ocean','violet'];
      presentation.theme = themes[(themes.indexOf(presentation.theme) + 1) % themes.length];
      savePresentation(); applyPresentation();
    });
    panel.querySelector('[data-action="collapse"]').addEventListener('click', () => {
      presentation.compact = !presentation.compact;
      savePresentation(); applyPresentation();
    });
    panel.querySelector('.top').addEventListener('pointerdown',dragStart);
    dashboard=panel;
    shadow.append(css,panel);
    document.body.appendChild(root);
    applyPresentation();
    updateHealth();
    if (stopReason) setStatus(stopReason);
    checkConflicts();
    render();
  }
  function scheduleMount() {
    if (mountQueued) return;
    mountQueued=true;
    queueMicrotask(() => { mountQueued=false; mount(); });
  }
  function observe() {
    if (observer) return;
    observer = new MutationObserver(() => { if (!document.getElementById(APP)) scheduleMount(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    timer = setInterval(() => { if (!document.getElementById(APP)) scheduleMount(); checkConflicts(); tick(); }, CHECK_EVERY_MS);
    window.addEventListener('pagehide', () => { if (phase === STATES.READY || phase === STATES.WAITING) pause('Navegación de página: ciclo suspendido.'); });
    document.addEventListener('keydown', e => {
      if (e.repeat || !e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || String(e.key).toLowerCase() !== 'a') return;
      e.preventDefault();
      // Legacy scripts also bind this shortcut on document bubble phase.
      e.stopImmediatePropagation();
      toggle();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mount(); observe(); }, { once: true });
  else { mount(); observe(); }
})();
