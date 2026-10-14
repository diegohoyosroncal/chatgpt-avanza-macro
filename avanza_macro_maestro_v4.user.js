// ==UserScript==
// @name         AVANZA — Macro Maestro · Piloto Automático
// @namespace    https://chatgpt.com/
// @version      4.8.0
// @description  Cockpit multiproyecto + Learn Quest: módulos ON/OFF, AUTO/MANUAL, progreso serio independiente, misiones jugables y sincronización entre pestañas.
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
  // One runner per page. Prevent two injected copies from creating two timers.
  const SINGLETON = 'data-avanza-maestro-v4-runner';
  if (document.documentElement?.getAttribute(SINGLETON) === '1') return;
  document.documentElement?.setAttribute(SINGLETON, '1');
  const INSTALLED_VERSION = '4.8.0-universal-fixed-point';
  document.documentElement?.setAttribute('data-avanza-client-version', INSTALLED_VERSION);
  const LEARN_KEY = 'avanza-v4-learn-quest-v1';
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
  // Processes explicitly archived by verified canonical state must never be resurrected by stale browser seeds.
  const LOCKED_PROCESS_IDS = new Set(['BTS-LIMA','AUGMENTED-LEARNING']);
  const lockedStatus = id => id === 'AUGMENTED-LEARNING' ? 'FROZEN' : 'ARCHIVED';
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
  let learning = readLearning();
  let missionOverlay = null;
  let pageBaselineAssistantFingerprint = '';
  let routeSettleUntil = 0;
  let routeHadGeneration = false;

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
    if (LOCKED_PROCESS_IDS.has(id)) return { enabled:false, auto:false };
    const row=control.projectModes?.[id]||{};
    return { enabled:row.enabled!==false, auto:row.auto!==false };
  }
  function setProjectMode(id,patch) {
    if (!id || LOCKED_PROCESS_IDS.has(id)) return;
    control.projectModes[id]={...projectMode(id),...patch};
    saveControl();
  }
  function seedProjects() {
    return {
      'COCKPIT-TOTAL-v1': {id:'COCKPIT-TOTAL-v1',objective:'Cockpit multiproyecto estable, instalado y verificado en perfil real',current_pct:87.5,previous_pct:75,delta_pp:12.5,numerator:7,denominator:8,next_action:'Verificar actualización/instalación real y canary autenticado',blocker:'Perfil real aún no verificado',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true},
      'CFI-E2-2026-10-16': {id:'CFI-E2-2026-10-16',objective:'Llegar a la E2 del 16/10 con dominio verificable de NIC 38/40/23/36',current_pct:15.8,previous_pct:15.8,delta_pp:0,numerator:3,denominator:19,next_action:'Cerrar NIC 40 modelo del costo + transferencias; luego NIC 23',blocker:'NIC 36 requiere puente de rúbrica antes de cambiar denominador',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true},
      'GLOBAL-VALUE-OS': {id:'GLOBAL-VALUE-OS',objective:'Convertir selección económica autónoma en ejecución autorizada con efecto real',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Demostrar selección nueva → ejecución autorizada → efecto → nueva frontera',blocker:'Autonomía integral aún no demostrada',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true},
      'BTS-LIMA': {id:'BTS-LIMA',objective:'Proyecto BTS Lima archivado; no reactivar por semilla del navegador',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Ninguna: requiere reactivación explícita y estado canónico nuevo',blocker:'ARCHIVED_LOCK',updated_at:'2026-10-13T16:06:00-05:00',status:'ARCHIVED',seeded:true},
      'VELVETBOX': {id:'VELVETBOX',objective:'Validar flujo E2E actual de producción y pagos sin regresiones',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Corregir CI de correlación exacta de payment-status; luego validar y promover solo con verde',blocker:'Producción main READY; rama fix/payment-status-require-orderid-20261009 mantiene CI typecheck en rojo',updated_at:'2026-10-11T00:36:00-05:00',status:'CONTINUE',seeded:true},
      'KASA-VIVA': {id:'KASA-VIVA',objective:'Validar demanda real antes de inventario adicional',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Recuperar E-DEMAND-01 y ejecutar test verificable',blocker:'Publicación/demanda verificable pendiente',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true},
      'YERABELL': {id:'YERABELL',objective:'Convertir piloto de reel IA en anticipo/cobro',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Recuperar material existente y cerrar flujo hacia anticipo',blocker:'Material parcial; cash S/0',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true},
      'AR-TRACKER-ETSY': {id:'AR-TRACKER-ETSY',objective:'Conseguir primera venta externa verificable del producto',current_pct:null,previous_pct:null,delta_pp:null,numerator:null,denominator:null,next_action:'Resolver autenticación de vendedor o cambiar a canal ejecutable',blocker:'Etsy seller auth bloqueada; perfiles TinyFish sin sesión',updated_at:'2026-10-10T23:53:00-05:00',status:'CONTINUE',seeded:true}
    };
  }
  function readLearning() {
    try { const raw=JSON.parse(localStorage.getItem(LEARN_KEY)||'{}'); return raw&&typeof raw==='object'?raw:{}; } catch { return {}; }
  }
  function saveLearning() {
    try { localStorage.setItem(LEARN_KEY,JSON.stringify(learning)); } catch {}
    renderGame(); broadcast({type:'learning',learning});
  }
  function learningFor(id=projectKey()) {
    if(!id) return null;
    const p=projects?.[id]||{};
    const baseXp=Number.isInteger(p.numerator)?p.numerator*100:0;
    return learning[id]||{processId:id,course:'',missionId:'',title:'',difficulty:1,reward:100,xp:baseXp,streak:0,status:'IDLE',boss:false,lastResult:'',choices:[],completed:{},updatedAt:''};
  }
  function setLearning(id,patch) {
    if(!id) return;
    const prev=learningFor(id)||{};
    learning[id]={...prev,...patch,completed:{...(prev.completed||{}),...(patch.completed||{})},updatedAt:new Date().toISOString()};
    saveLearning();
  }
  function looksLearningProcess() {
    const id=projectKey(), p=projects?.[id]||{}, hay=[id,p.objective,state.objective].join(' ');
    return /(CFI|CURSO|ACADEM|EXAM|CLASE|ESTUDI|APREND|CONTABIL|NIC\s*\d+)/i.test(hay);
  }
  function parseQuestLine(text) {
    const m=String(text||'').match(/🎮\s*QUEST\s*\|\s*([^|\n]+)\|\s*([^|\n]+)\|\s*⭐\s*(\d{1,4})\s*XP\s*\|\s*⚔️\s*([1-5])\s*\/\s*5\s*\|\s*([^\n]+)/i);
    if(!m) return null;
    return {course:m[1].trim().slice(0,40),missionId:safeId(m[2].trim()),reward:Math.min(500,Math.max(0,Number(m[3]))),difficulty:Number(m[4]),title:m[5].trim().slice(0,120),boss:/👾|BOSS/i.test(m[5])};
  }
  function parseQuestResult(text) {
    const m=String(text||'').match(/(?:🏆|🔁)\s*QUEST_RESULT\s*\|\s*([^|\n]+)\|\s*(PASS|RETRY)\s*\|\s*\+(\d{1,4})\s*XP(?:\s*\|\s*🔥\s*(\d+))?/i);
    if(!m) return null;
    return {missionId:safeId(m[1].trim()),result:m[2].toUpperCase(),claimedXp:Number(m[3]),claimedStreak:m[4]?Number(m[4]):null};
  }
  function parseQuestChoices(text) {
    const line=(String(text||'').match(/🎲\s*QUEST_CHOICES\s*\|[^\n]+/i)||[])[0];
    if(!line) return null;
    const parts=line.split('|').map(x=>x.trim());
    if(parts.length<4) return null;
    const missionId=safeId(parts[1].replace(/^QUEST_CHOICES\s*/i,''));
    const choices=parts.slice(2).map(part=>{
      const m=part.match(/^([A-F1-6])\s*[=:]\s*(.+)$/i);
      return m?{key:m[1].toUpperCase(),label:m[2].trim().slice(0,120)}:null;
    }).filter(Boolean).slice(0,6);
    return missionId&&choices.length>=2?{missionId,choices}:null;
  }
  function findLearningProjectId(course) {
    const needle=String(course||'').trim().toLocaleUpperCase();
    if(!needle) return '';
    const rows=Object.values(projects||{});
    const hit=rows.find(p=>[p.id,p.objective].join(' ').toLocaleUpperCase().includes(needle));
    return hit?.id||'';
  }
  function discoverLearning() {
    if(!moduleOn('game')) return;
    const nodes=[...document.querySelectorAll('[data-message-author-role="assistant"]')].slice(-24);
    let active=null,result=null,choicePack=null;
    for(const node of nodes){
      const text=node.innerText||node.textContent||'';
      active=parseQuestLine(text)||active;
      result=parseQuestResult(text)||result;
      choicePack=parseQuestChoices(text)||choicePack;
    }
    let id=projectKey();
    if(active){
      const mapped=findLearningProjectId(active.course);
      if(mapped) id=mapped;
      if(id && state.processId!==id){
        state.processId=id;
        const p=projects[id]||{};
        if(typeof p.current_pct==='number') state.lastPercent=p.current_pct;
        if(Number.isInteger(p.numerator)) state.lastNumerator=p.numerator;
        if(Number.isInteger(p.denominator)) state.lastDenominator=p.denominator;
        if(typeof p.delta_pp==='number') state.lastDelta=p.delta_pp;
      }
    }
    if(!id) return;
    let L=learningFor(id); if(!L) return;
    if(result && result.missionId){
      const done=L.completed||{};
      if(result.result==='PASS' && result.missionId===L.missionId && !done[result.missionId]){
        const gain=Math.max(0,Math.min(500,L.reward||result.claimedXp||100));
        L={...L,xp:(L.xp||0)+gain,streak:(L.streak||0)+1,lastResult:'PASS',completed:{...done,[result.missionId]:true},status:'RESOLVED'};
      } else if(result.result==='RETRY' && result.missionId===L.missionId){
        L={...L,streak:0,lastResult:'RETRY',status:'AWAITING_USER'};
      }
    }
    if(active){
      const same=active.missionId===L.missionId;
      L={...L,...active,status:'AWAITING_USER',lastResult:same?L.lastResult:'',processId:id,choices:choicePack?.missionId===active.missionId?choicePack.choices:[]};
    } else if(choicePack && choicePack.missionId===L.missionId) {
      L={...L,choices:choicePack.choices};
    }
    learning[id]=L; try{localStorage.setItem(LEARN_KEY,JSON.stringify(learning));}catch{}
    saveState(); renderGame(); renderProgressRibbon();
  }
  function readProjects() {
    const seeds=seedProjects();
    let merged=seeds;
    try {
      const raw=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}');
      merged=raw&&typeof raw==='object'?{...seeds,...raw}:seeds;
    } catch { merged=seeds; }
    for (const id of LOCKED_PROCESS_IDS) {
      if (merged[id]) merged[id]={...merged[id],status:lockedStatus(id),blocker:'ARCHIVED_LOCK'};
    }
    return merged;
  }
  function saveProjects() {
    for (const id of LOCKED_PROCESS_IDS) if (projects[id]) projects[id]={...projects[id],status:lockedStatus(id),blocker:'ARCHIVED_LOCK'};
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
    return { cycles:0,totalSent:0,stalled:0,missingReceipts:0,lastPercent:null,lastDenominator:null,lastDelta:null,lastResponseFingerprint:'',repeatedResponses:0,lastStrategy:'',lastStatus:'',objective:'',nextAction:'',blocker:'',lastNumerator:null,lastProof:'',lastUpdated:'',lastTicket:'',processId:'',autoConsented:false,terminalCandidate:'',terminalConfirmations:0,inFlightTicket:'',inFlightSentAt:0,parkFingerprint:'',parkSince:0,retryAfter:0 };
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
        if(msg.type==='learning'&&msg.learning&&typeof msg.learning==='object'){ learning={...learning,...msg.learning}; try{localStorage.setItem(LEARN_KEY,JSON.stringify(learning));}catch{} renderGame(); }
      };
    } catch { channel=null; }
  }
  state = recoverState();
  function fingerprint(s) {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(36) + ':' + s.length;
  }
  function fallbackProcessId() { return 'CHAT-' + fingerprint(chatKey).split(':')[0].toUpperCase(); }
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
  function clearOwnUnsentDraft(el, message) {
    if (!el || draft(el) !== String(message).trim()) return false;
    try {
      if (el.isContentEditable) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges(); sel?.addRange(range);
        if (!document.execCommand('delete', false, null)) {
          el.textContent = '';
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        }
      } else {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, ''); else el.value = '';
        el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'deleteContentBackward' }));
      }
      return true;
    } catch { return false; }
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
    if (state.stalled >= 6) return 'OPERADOR_TOTAL_EXPANDIR_UNIVERSO_CREAR_O_SUSTITUIR';
    if (state.stalled >= 3 || state.missingReceipts >= 2) return 'CAMBIAR_CLASE_DE_SOLUCION_Y_EJECUTAR';
    if (state.lastDelta === null) return 'RECUPERAR_METRICA_Y_VERIFICAR';
    if (state.lastDelta > 0) return 'EJECUTAR_SIGUIENTE_HITO';
    if (state.stalled >= 1) return 'COMPARAR_ALTERNATIVAS_Y_EJECUTAR';
    return 'AVANZAR_Y_VERIFICAR';
  }
  function buildMessage(ticket, step) {
    const chosen = strategy();
    const core = [
      `${MARK} — CONTROL ADAPTATIVO ${ticket}. Esta señal AGREGA capacidades; NO reemplaza objetivo, autorizaciones, decisiones, instrucciones ni checkpoints de este chat.`,
      `AVANZA_CLIENT_PROOF: ${INSTALLED_VERSION} | ${ticket}`,
      `Decisión interna de interfaz: ${chosen}. PROCESS_ID actual: ${state.processId || 'POR RECUPERAR'}. Ciclo local ${step}. Anterior conocido (NO prueba externa): progreso ${state.lastPercent ?? 'NO DETERMINABLE'}%, denominador ${state.lastDenominator ?? 'NO DETERMINABLE'}, delta ${state.lastDelta ?? 'NO DETERMINABLE'} pp, ciclos sin progreso ${state.stalled}.`,
      'RECUPERA estado actual desde este chat y fuentes canónicas disponibles. Si falta contexto transversal, usa primero el canon global compartido de Drive ID 1epHKEGs6SjTzrfDi5SeHNaxH7CHX09VTfmYNa7WxIcY y después el canon específico del PROCESS_ID. Evalúa cuál es el objetivo pendiente, su dueño y qué cambió desde la respuesta anterior. No dependas de una cifra inferida de la interfaz para afirmar efectos.',
      'DECIDE TÚ la mejor acción: ejecutar, verificar, conciliar, corregir, investigar globalmente, adoptar/reutilizar/integrar/fusionar/delegar legítimamente/sustituir/adaptar/construir una capacidad faltante, detener una estrategia de valor negativo o cambiar de rumbo. No conviertas AVANZAR en ejecutar por ejecutar, ni le pidas al usuario escoger entre alternativas.',
      'CONTRATO OPERADOR TOTAL: no termines con solo explicación, estado, plan, lista de opciones o una pregunta si todavía existe alguna acción material que puedas ejecutar en este turno. Ante una carencia puntual de herramienta, acceso, proveedor o canal, NO la generalices a imposibilidad del objetivo: busca otra herramienta/conector/plugin, otra API o runtime ya disponible, otro proveedor/canal, recuperación de acceso, integración, adopción, reutilización, delegación al owner correcto, composición entre sistemas o construcción mínima. Elige tú la mejor ruta y ejecútala.',
      'AGOTAMIENTO MATERIAL OBLIGATORIO: antes de HUMAN_GATE_PROVEN o NO_SAFE_ACTION, revisa clases de solución distintas, no variaciones cosméticas de la misma. Documenta qué clases ya se intentaron y qué evidencia descartó cada una. Tras tres intentos equivalentes sin delta, prohíbe el cuarto intento equivalente y cambia arquitectura, canal, proveedor, herramienta o mecanismo causal. Mantén abiertas y avanza en paralelo las fronteras independientes.',
      'BÚSQUEDA ACTIVA DE CAPACIDAD: cuando una capacidad externa pueda cambiar el resultado, descubre plugins/conectores disponibles y usa investigación web actual para encontrar soluciones, prácticas o proveedores mejores. Prefiere adoptar/integrar/componer una solución existente cuando domina construirla; si queda una brecha demostrada, construye el componente mínimo que desbloquee el efecto. No pidas al usuario repetir contexto recuperable ni elegir entre rutas que puedes comparar tú.',
      'EJECUTA dentro de este turno todas las acciones disponibles con valor positivo que no estén impedidas por un requisito real del caso; verifica cada una en una fuente independiente, distingue COLA→ENTREGA→ACCIÓN→EFECTO y sigue con las demás. Si llevamos 3 intentos sin DELTA verificable, identifica causa raíz y realiza una intervención MATERIALMENTE diferente antes de repetir.',
      'REQUISITOS REALES DEL CASO: aplica permisos, identidad/MFA, consentimiento exigible, términos del proveedor, presupuesto/costos y decisiones del titular solo cuando correspondan a una acción concreta. Si una ruta los exige y otra no, compara y usa la mejor alternativa disponible; no generalices el bloqueo de una ruta a todo el objetivo ni paralices fronteras independientes. Preserva single-owner, deduplicación, idempotencia y protección de secretos.',
      'SEPARA CAPAS: continuidad conversacional ≠ tareas programadas ≠ ejecución externa. Una respuesta, checkpoint, porcentaje intermedio o cambio de hilo NO son STOP. No crees cron/tareas para simular que el chat sigue; reserva Tasks únicamente para un evento realmente futuro/periódico/condicional. La continuidad fuera del chat requiere el ejecutor persistente autorizado y recibos; esta macro reanuda hilos web reconocidos, pero la ejecución externa real debe comprobarse en herramientas autorizadas.',
      'CONTRATO VISUAL DE PORCENTAJE: la PRIMERA línea de toda respuesta de proceso multi-ejecución debe ser 🧩 PROCESO <process_id> | 📈 AVANCE <anterior>%→<actual>% | <numerador>/<denominador> gates | Δ <pp>. Si no existe denominador defendible: 🧩 PROCESO <process_id> | 📈 AVANCE NO DETERMINABLE. Nunca omitas una métrica ya verificada; conserva el último valor si esta ejecución no cambia progreso.',
      'Antes de terminar repite la revisión de fronteras útiles, guarda checkpoint con objetivo, owner, receipt, bloqueo, siguiente acción exacta y condición de reanudación si procede. Reporta SIEMPRE objetivo, porcentaje anterior→actual con numerador/denominador, delta pp, pendiente, efecto realmente verificado, bloqueo y siguiente hito. Si no existe denominador defendible di NO DETERMINABLE.',
      'MULTIPROYECTO: identifica un PROCESS_ID estable para este objetivo y NO mezcles su porcentaje con otro proceso. Si el chat contiene varias fronteras, evalúa sus objetivos y restricciones individualmente, actúa solo en las autorizadas y conserva métricas independientes. Otros proyectos pueden avanzar en sus propios chats/tabs.',
      ...(looksLearningProcess() ? [
      'CFI/APRENDIZAJE: usa misiones cortas, feedback interactivo, colores y juego cuando ayuden, pero XP/estética jamás sustituyen dominio verificable. El porcentaje solo sube al cerrar gates de conocimiento o práctica.',
      'LEARN QUEST: si el proceso es de aprendizaje, NO entregues una pared de teoría. Presenta una micro-misión resoluble por el usuario, evalúa su respuesta, explica el error o acierto y encadena la siguiente misión sin que tenga que escribir "sigue". Usa dificultad progresiva, recuperación espaciada, variación de datos y boss/simulacro cuando proceda.',
      'PROTOCOLO VISIBLE PARA EL HUD: cuando presentes una misión termina el bloque con una línea EXACTA: 🎮 QUEST | <curso> | <mission_id> | ⭐<xp 0-500> XP | ⚔️<1-5>/5 | <título>. Si la pregunta admite opciones útiles, añade inmediatamente: 🎲 QUEST_CHOICES | <mission_id> | A=<opción> | B=<opción> | C=<opción> | D=<opción>. El HUD convertirá esas opciones en botones. Si es numérica/abierta, deja que el usuario responda desde la caja interactiva del HUD. Cuando evalúes una respuesta añade: 🏆 QUEST_RESULT | <mission_id> | PASS | +<xp> XP | 🔥<racha> o 🔁 QUEST_RESULT | <mission_id> | RETRY | +0 XP | 🔥0. Si haces PASS, presenta en esa misma respuesta la siguiente QUEST salvo boss, pausa pedagógica o gate humano real.',
      ] : []),
      'Para el control local termina con EXACTAMENTE UNA línea JSON de metadatos, después del informe: AVANZA_CONTROL: {"status":"CONTINUE","process_id":"","objective":"","previous_pct":null,"current_pct":null,"delta_pp":null,"numerator":null,"denominator":null,"evidence":"","blocker":"","next_action":""}. Estos valores son declaraciones del asistente y NO recibos independientes. Usa VERIFIED_COMPLETE solo si el OBJETIVO PRINCIPAL está completamente verificado con fuente primaria, HUMAN_GATE_PROVEN solo si se agotaron alternativas legítimas, NO_SAFE_ACTION solo si realmente no queda acción segura positiva. Nunca afirmes resultado final por CI, cola DONE, pruebas aisladas, documentos o esta macro. Mantén el denominador del MISMO objetivo, no mezcles ámbitos.',
      `${RECEIPT} ${ticket}`,
    ];
    if (state.terminalCandidate) core.push('TERMINAL_CANDIDATE EN REVISIÓN: no detengas por repetición verbal. Reabre el universo de rutas, busca una clase de solución no probada y revalida desde fuente primaria/recibo independiente la condición terminal anterior; si no se sostiene, vuelve a CONTINUE y ejecuta la mejor alternativa materialmente distinta.');
    if (state.stalled >= 3) core.push('AUDITORÍA DE ESTANCAMIENTO: identifica causa raíz y abre un UNIVERSO MATERIALMENTE DISTINTO de soluciones. Audita herramientas/conectores instalados y alternativos, plugins disponibles, APIs/runtimes existentes, recuperación de acceso, investigación web actual, adopción, integración, colaboración, delegación al owner correcto, adaptación, sustitución de proveedor/canal, combinación y construcción mínima. Compara valor esperado, rapidez, coste total, reversibilidad, autonomía, dependencias y evidencia primaria; ELIGE y EJECUTA la mejor ruta sin pedirme que la seleccione. No repitas una consulta negativa como si agotara la clase de solución.');
    if (state.stalled >= MAX_STALLED_CYCLES) core.push('REVISIÓN TOTAL antes de cualquier espera: realiza inventario de clases de ruta ya intentadas y aún no intentadas, descubre capacidad externa faltante, cambia mecanismo causal y ejecuta al menos una alternativa materialmente distinta si existe. Verifica acción y efecto por separado. Un bloqueo de una herramienta no es bloqueo del objetivo. No emitas otro informe vacío ni gastes ciclos en la misma operación improductiva.');
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
  function escapeHtml(value,max=160) {
    return escapeText(value,max).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function shortProjectLabel(id) {
    if(/^CFI-/i.test(id)) return '🎓 CFI';
    if(/^COCKPIT/i.test(id)) return '🧩 COCKPIT';
    if(/VELVET/i.test(id)) return '🎬 VELVET';
    if(/BTS/i.test(id)) return '💜 BTS';
    if(/KASA/i.test(id)) return '🏠 KASA';
    if(/YERABELL/i.test(id)) return '🎞️ YERABELL';
    return '🚀 '+String(id||'').replace(/-v\d+$/i,'').slice(0,12);
  }
  function renderProgressRibbon() {
    const box=dashboard?.querySelector('[data-value="progress-ribbon"]'); if(!box) return;
    if(!moduleOn('progress')) { box.hidden=true; return; }
    const rows=Object.values(projects||{}).filter(p=>typeof p.current_pct==='number'&&Number.isFinite(p.current_pct)).sort((a,b)=>{
      if(a.id===projectKey()) return -1; if(b.id===projectKey()) return 1;
      return String(b.updated_at||'').localeCompare(String(a.updated_at||''));
    }).slice(0,6);
    box.hidden=false;
    box.innerHTML=rows.length?rows.map(p=>'<span class="progress-chip" data-active="'+(p.id===projectKey()?'true':'false')+'"><b>'+escapeHtml(shortProjectLabel(p.id),22)+'</b> '+escapeHtml(formatPercent(p.current_pct),8)+'</span>').join(''):'<span class="progress-chip">📈 sin % verificable aún</span>';
  }
  function updateDashboard() {
    if (!dashboard) return;
    const pct = moduleOn('progress') ? state.lastPercent : null;
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
    renderGame(); renderModules(); renderProjects(); renderProgressRibbon(); renderMissionControl();
  }
  function render() {
    if (!button) return;
    const active = phase === STATES.READY || phase === STATES.WAITING;
    button.textContent = active ? '■  AUTO ACTIVO · DETENER' : '▶  AVANZAR · AUTO';
    button.classList.toggle('active',active);
    dashboard?.setAttribute('data-activity', active ? (phase===STATES.WAITING?'waiting':'running') : (phase===STATES.PAUSED?'paused':'idle'));
    const indicator=dashboard?.querySelector('[data-value="live-indicator"]');
    if(indicator){ indicator.dataset.live=active?'true':'false';
      indicator.textContent=active?(phase===STATES.WAITING?'● ESPERANDO':'● AUTO ACTIVO'):(phase===STATES.PAUSED?'● EN PAUSA':'◇ LISTO'); }
    // Do not make AVANZAR inert when a legacy panel exists: its click explains
    // the conflict via toggle()/checkConflicts(), while sending stays blocked.
    button.disabled = busy;
    button.title = conflicts().length ? 'Hay otra macro activa: pulsa para ver el motivo; no se enviará nada.' : 'Avanzar o detener AUTO en este chat';
    button.setAttribute('aria-pressed', String(active));
    updateDashboard();
    updateHealth();
  }
  function pause(reason, warn = false) {
    phase = STATES.PAUSED;
    state.autoConsented=false;
    state.retryAfter=0;
    releaseLease();
    pending = null;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    stopReason = reason;
    setStatus(reason, warn);
    render();
    saveState();
  }
  function defer(reason, warn = false, delayMs = 5000) {
    phase = STATES.IDLE;
    state.retryAfter = now() + Math.max(1000, delayMs);
    releaseLease();
    pending = null;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    stopReason = '';
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
    routeHadGeneration = isGenerating();
    routeSettleUntil = now() + 1000;
    pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint();
    pending = null;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    phase = STATES.IDLE;
    stopReason = '';
    if (state.inFlightTicket) restoreOutstanding();
    if (wasRunning) setStatus('Chat cambiado: liberé el lease anterior; este hilo reanuda AUTO si reconoce su PROCESS_ID.', true);
    else setStatus('Lista en este chat. Los procesos reconocidos reanudan AUTO sin otro clic.');
    render();
  }
  // A Web Lock makes the final pre-send receipt check atomic between browser tabs
  // when supported. No profile-crossing or server-side lock is claimed.
  async function claimAndSend(liveSend,ticket) {
    const commit=async()=>{
      let shared={};
      try { shared=JSON.parse(localStorage.getItem(storageKey())||'{}')||{}; }
      catch { return false; }
      if (shared.inFlightTicket && shared.inFlightTicket!==ticket) return false;
      if (!renewLease()) return false;
      state.inFlightTicket=ticket; state.inFlightSentAt=now();
      saveState(); // Write-ahead receipt: never retry a click of unknown outcome.
      liveSend.click();
      return true;
    };
    if (navigator.locks && typeof navigator.locks.request==='function') {
      return navigator.locks.request('avanza-send:'+chatKey,
        {ifAvailable:true,mode:'exclusive'},lock=>lock?commit():false);
    }
    return commit(); // Legacy Web Locks absence: retain profile lease, fail-closed.
  }
  async function deliver(step) {
    if (checkConflicts() || !moduleOn('engine')) return;
    if (LOCKED_PROCESS_IDS.has(projectKey())) {
      state.autoConsented=false;
      pause('Proceso archivado o congelado: envío bloqueado.',true);
      return;
    }
    if (busy || phase !== STATES.READY || pending) return;
    busy = true; render();
    try {
      syncRoute();
      if (phase !== STATES.READY) return;
      if (!renewLease()) { defer('Otro panel tiene el control de este chat; reintento cuando venza el lease.', true, 3000); return; }
      if (document.hidden && !control.backgroundAuto) { setStatus('Pestaña en segundo plano: AUTO-background está OFF.'); return; }
      if (isGenerating()) { setStatus('Respuesta en curso; no duplico mensajes.'); return; }
      const c = findComposer();
      if (!c) { defer('No encuentro el cuadro de mensaje todavía; AUTO reintentará tras remount.', true, 3000); return; }
      if (draft(c)) { defer('Hay un borrador escrito. Se conserva intacto y AUTO reanuda cuando quede libre.', true, 3000); return; }
      // ChatGPT normally disables Enviar when the composer is empty.
      // Never demand an enabled send control BEFORE filling it.
      const ticket = `AVZ4-${String(now())}-${state.totalSent + 1}`;
      const message = buildMessage(ticket, step);
      if (!fillComposer(c, message)) { defer('El editor no aceptó el mensaje todavía; no se envió nada y AUTO reintentará.', true, 5000); return; }
      // Wait briefly for React/ProseMirror to enable Send after input/change.
      let liveSend = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
        if (phase !== STATES.READY || currentChatKey() !== chatKey || isGenerating() || !renewLease()) break;
        if (draft(c) !== message.trim()) break; // user edit wins; never send altered text
        liveSend = findSend();
        if (liveSend) break;
      }
      if (!renewLease() || phase !== STATES.READY || isGenerating() || currentChatKey() !== chatKey) {
        defer('El chat cambió antes del envío. No pulsé Enviar; reevalúo la ruta activa.', true, 2500); return;
      }
      if (draft(c) !== message.trim()) {
        defer('El contenido del editor cambió; conservé el borrador y reevalúo después.',true,3000); return;
      }
      if (!liveSend) {
        // We injected this draft ourselves; clear only if completely untouched.
        // No outgoing message or write-ahead ticket has occurred.
        clearOwnUnsentDraft(c, message);
        defer('No se habilitó Enviar después de escribir; limpié solo mi borrador y AUTO reintentará sin pedir otro clic.', true, 5000);
        return;
      }
      const delivered = await claimAndSend(liveSend,ticket);
      if (!delivered) { defer('Otro panel o un mensaje pendiente tiene prioridad; AUTO reintentará sin duplicar.',true,3000); return; }
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
      if (state.inFlightTicket) {
        phase = STATES.WAITING;
        pending = null;
        setStatus('Error posterior al intento: conservo el ticket y reconcilio sin reenvío.', true);
        restoreOutstanding();
      } else {
        defer('Error recuperable del editor antes del envío; AUTO reintentará sin pedir otro clic.', true, 5000);
      }
    } finally { busy = false; render(); }
  }
  async function tick() {
    if (busy) return;
    syncRoute();
    if (LOCKED_PROCESS_IDS.has(projectKey())) {
      state.autoConsented=false;
      pause('Proceso archivado o congelado: el ciclo no puede continuar.',true);
      return;
    }
    if (phase !== STATES.READY && phase !== STATES.WAITING) return;
    if (!renewLease()) { defer('El control está en otra pestaña; espero el lease y reanudo.', true, 3000); return; }
    if (document.hidden && !control.backgroundAuto) return;
    if (phase === STATES.READY) {
      if (now() - lastAudit < MIN_SEND_GAP_MS) return;
      lastAudit = now();
      await deliver(state.cycles + 1);
      return;
    }
    if (!pending) return;
    if (pending.receiptSeen && now() - pending.sentAt > 20 * 60 * 1000) {
      setStatus('Sin respuesta estable todavía; mantengo vigilancia del mismo ticket sin reenviar.', true);
    }
    if (!pending.receiptSeen) {
      if (ownMessage(pending.ticket)) {
        pending.receiptSeen = true;
        setStatus(`Mensaje del ciclo ${state.cycles} visible. Esperando respuesta…`);
      } else if (now() - pending.sentAt > 9500) {
        setStatus('Envío con resultado DOM incierto: sigo reconciliando el mismo ticket; no reenvío a ciegas.', true);
      }
      return;
    }
    const reply = assistantAfter(pending.ticket);
    if (reply === '<<USER_INTERRUPTED>>') { pending=null; phase=STATES.IDLE; state.inFlightTicket=''; state.inFlightSentAt=0; replyCandidate={fingerprint:'',firstSeen:0}; state.lastUpdated=new Date().toISOString(); saveState(); setStatus('Intervención humana detectada: conservo continuidad y reanudo tras la respuesta del chat.'); return; }
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
      if (receipt.processId) { if (!state.processId) state.processId=receipt.processId; else if (state.processId!==receipt.processId) state.blocker='PROCESS_ID cambió: conservar '+state.processId+' sin mezclar métricas'; }
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
    pending = null; state.inFlightTicket=''; state.inFlightSentAt=0;
    if (state.repeatedResponses >= 4) { state.stalled=Math.max(state.stalled,3); state.lastStrategy='FORZAR_RUTA_MATERIALMENTE_DISTINTA'; setStatus('Respuesta repetida: cambio material de estrategia obligatorio; continúo.', true); }
    saveState();
    if (receipt && EXIT.has(receipt.status)) {
      const candidateKey = receipt.status + '|' + (receipt.evidence || '').trim();
      if (state.terminalCandidate === candidateKey && state.terminalConfirmations >= 1) {
        pause(receipt.status === 'VERIFIED_COMPLETE' ? 'Cierre confirmado en dos ciclos: objetivo declarado completo con evidencia revalidada.' :
          receipt.status === 'HUMAN_GATE_PROVEN' ? 'Gate humano confirmado en dos ciclos tras reauditoría.' :
          'Ausencia de acción segura confirmada en dos ciclos tras reauditoría.', true);
        return;
      }
      state.terminalCandidate = candidateKey;
      state.terminalConfirmations = 1;
      state.lastStatus = 'CONTINUE';
      state.stalled = Math.max(state.stalled, 3);
      saveState();
      setStatus('Terminal candidato NO cerrado: ejecuto una reauditoría independiente antes de detener.', true);
    } else if (receipt) {
      state.terminalCandidate = '';
      state.terminalConfirmations = 0;
    }
    if (state.missingReceipts >= MAX_NO_RECEIPT_CYCLES) { state.stalled=Math.max(state.stalled,3); setStatus('Faltan metadatos: fuerzo recuperación de métrica/objetivo y continúo con ruta distinta.', true); }
    if (state.stalled > MAX_STALLED_CYCLES && state.lastStrategy === 'AUDITORIA_PROFUNDA_CREAR_O_SUSTITUIR_CAPACIDAD') {
      state.lastStrategy='ROTAR_CAPACIDAD_Y_REABRIR_UNIVERSO';
      setStatus('Estancamiento profundo: no aparco el proceso; roto a una clase de solución materialmente distinta.', true);
    }
    if (draft(findComposer())) { setStatus('Hay un borrador nuevo: lo respeto y reanudo después.'); phase=STATES.IDLE; render(); return; }
    const id=projectKey(), mode=id?projectMode(id):{enabled:true,auto:true};
    phase = state.autoConsented===true && moduleOn('auto') && mode.enabled && mode.auto ? STATES.READY : STATES.IDLE;
    replyCandidate = { fingerprint: '', firstSeen: 0 };
    setStatus(phase===STATES.READY ? (state.stalled >= 3 ? `Ciclo ${state.cycles}: cambio de estrategia por estancamiento…` : `Ciclo ${state.cycles}: evaluando siguiente acción…`) : '✋ MANUAL: checkpoint guardado; pulsa AVANZAR cuando quieras.');
    render();
  }
  function toggle() {
    syncRoute();
    if (checkConflicts()) return;
    if (busy) return;
    const id=projectKey();
    if (LOCKED_PROCESS_IDS.has(id)) {
      state.autoConsented=false;
      pause('Proceso archivado o congelado: no se inicia ningún ciclo AUTO.',true);
      return;
    }
    if (phase === STATES.READY || phase === STATES.WAITING) {
      state.autoConsented=false;
      if (id) setProjectMode(id,{auto:false});
      pause('Pausada manualmente. Este proyecto queda en MANUAL hasta reactivar AUTO.', false);
      return;
    }
    if (!moduleOn('engine')) { setStatus('⚡ MOTOR está OFF. Enciéndelo desde MACROS.', true); return; }
    if (!moduleOn('auto')) { control.modules.auto=true; saveControl(); }
    if (!acquireLease()) { setStatus('Este chat ya está controlado por otra pestaña; no duplico acciones.', true); return; }
    if (id && !projectMode(id).enabled) setProjectMode(id,{enabled:true});
    if (id && !projectMode(id).auto) setProjectMode(id,{auto:true});
    state.autoConsented=true; state.parkFingerprint=''; state.parkSince=0; state.retryAfter=0;
    saveState();
    state.stalled=0; state.missingReceipts=0;
    if (state.inFlightTicket) { restoreOutstanding(); render(); return; }
    phase=STATES.READY; lastAudit=0;
    setStatus('Evaluando el contexto para avanzar…'); render(); tick();
  }

  // PASSIVE, READ-ONLY display recovery: no ChatGPT request, no external call.
  // Unlike 🧩 PROCESO, many existing chats report progress in natural Spanish.
  // Never treat a statement from the assistant as independent primary proof.
  let lastPassiveProgressScan = 0;
  function hydrateVisibleReportedProgress() {
    if (!moduleOn('progress') || state.processId) return; // do not override canonical tagged project
    if (state.lastDenominator && state.lastPercent !== null
        && state.lastProof !== 'ASISTENTE_VISIBLE_NO_PRUEBA_PRIMARIA') return;
    const labels = [
      { re: /continuidad(?:\s+aut[oó]noma)?\s+entre\s+chats/gi, objective: 'Continuidad entre chats' },
      { re: /entrega\s+(?:de\s+estado\s+)?a\s+(?:los\s+)?(?:responsables|owners)/gi, objective: 'Entrega a responsables' },
      { re: /consumo\s+de\s+gse\s+por\s+owners/gi, objective: 'Consumo GSE por owners' },
    ];
    const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')].slice(-24);
    for (let k=nodes.length-1; k>=0; k--) {
      const content=(nodes[k].innerText||nodes[k].textContent||'').replace(/\u00a0/g,' ');
      for (const label of labels) {
        for (const hit of content.matchAll(label.re)) {
          const area=content.slice(hit.index,hit.index+240);
          const ps=[...area.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g)]
            .map(m=>({ value:Number(m[1].replace(',','.')), at:m.index }));
          const fs=[...area.matchAll(/\b(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})(?:\s+(?:hitos|responsables|owners))?/gi)]
            .map(m=>({ n:Number(m[1]),d:Number(m[2]),at:m.index }));
          for (const frac of fs) {
            if (!frac.d || frac.n>frac.d) continue;
            const pct=ps.filter(x=>Math.abs(x.value-100*frac.n/frac.d)<.31
              && Math.abs(x.at-frac.at)<110)
              .sort((a,b)=>Math.abs(a.at-frac.at)-Math.abs(b.at-frac.at))[0];
            if (!pct) continue;
            const changed=state.lastPercent!==pct.value || state.lastDenominator!==frac.d
              || state.objective!==label.objective || state.lastNumerator!==frac.n;
            if (!changed) return;
            state.objective=label.objective;
            state.lastPercent=pct.value;
            state.lastNumerator=frac.n;
            state.lastDenominator=frac.d;
            state.lastDelta=null; // no reliable transition inferred from prose
            state.lastProof='ASISTENTE_VISIBLE_NO_PRUEBA_PRIMARIA';
            saveState();
            updateDashboard();
            return;
          }
        }
      }
    }
  }
  function discoverVisibleProjects() {
    const nodes=[...document.querySelectorAll('[data-message-author-role="assistant"]')].slice(-30);
    const detected = new Set(); // Avoid binding the first of multiple unrelated objectives.
    for (const node of nodes) {
      const text=(node.innerText||node.textContent||'');
      const re=/🧩\s*PROCESO\s+([A-Za-z0-9._:-]+)[^\n]*?📈\s*(?:AVANCE\s*)?([0-9]+(?:[.,][0-9]+)?)%\s*→\s*([0-9]+(?:[.,][0-9]+)?)%[^\n]*?(\d+)\s*\/\s*(\d+)/gi;
      let m;
      while((m=re.exec(text))) {
        const id=safeId(m[1]), current=Number(m[3].replace(',','.')), previous=Number(m[2].replace(',','.')), numerator=Number(m[4]), denominator=Number(m[5]);
        if(!id||denominator<=0||numerator>denominator||Math.abs(100*numerator/denominator-current)>0.5) continue;
        const old=projects[id]||{};
        detected.add(id);
        projects[id]={...old,id,current_pct:current,previous_pct:previous,delta_pp:current-previous,numerator,denominator,chatKey,updated_at:new Date().toISOString(),objective:old.objective||id,status:old.status||'CONTINUE'};
      }
    }
    // Bind automatically only when precisely one process is visible in this chat.
    // Multiple processes remain visible as separate cards; the assistant recovers the correct active objective.
    if(!state.processId && detected.size===1) {
      const id=[...detected][0], p=projects[id];
      state.processId=id; state.lastPercent=p.current_pct; state.lastDelta=p.delta_pp;
      state.lastNumerator=p.numerator; state.lastDenominator=p.denominator;
    }
    if(Object.keys(projects).length){ try{localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));}catch{} renderProjects(); }
    if (Date.now() - lastPassiveProgressScan > 3500) {
      lastPassiveProgressScan = Date.now();
      hydrateVisibleReportedProgress();
    }
  }
  function latestVisibleReceipt() {
    const nodes=[...document.querySelectorAll('[data-message-author-role="assistant"]')].slice(-12);
    for(let i=nodes.length-1;i>=0;i--){
      const text=nodes[i].innerText||nodes[i].textContent||'';
      const receipt=parseReceipt(text);
      if(receipt) return receipt;
    }
    return null;
  }
  function shouldAutoStart() {
    // Rehydrate any visible PROCESS_ID first. This covers historical tagged chats.
    discoverVisibleProjects();
    const visibleReceipt=latestVisibleReceipt();
    if (visibleReceipt && EXIT.has(visibleReceipt.status)) return false;
    if (visibleReceipt?.percent !== null && visibleReceipt?.percent >= 100) return false;

    let continuityArmed = state.autoConsented === true || Boolean(state.processId);
    if (!continuityArmed && routeSettleUntil && now() < routeSettleUntil) {
      routeHadGeneration = routeHadGeneration || isGenerating();
      if (!routeHadGeneration) pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint();
      return false;
    }

    if (!continuityArmed) {
      const latestFingerprint = lastVisibleAssistantFingerprint();
      const hasConversation = Boolean(
        document.querySelector('[data-message-author-role="user"]')
        && document.querySelector('[data-message-author-role="assistant"]')
      );
      // Universal fixed-point bootstrap: opening an existing unfinished web chat
      // is sufficient to recover a durable fallback process. New chats arm after
      // their first assistant response. Explicit MANUAL/OFF and terminal states
      // still win below.
      if (latestFingerprint && hasConversation) {
        state.processId = visibleReceipt?.processId || fallbackProcessId();
        state.objective = visibleReceipt?.objective || state.objective || 'Objetivo actual de este chat';
        state.autoConsented = true;
        saveState();
        continuityArmed = true;
      }
    }

    if (!continuityArmed || state.inFlightTicket) return false;
    if (state.retryAfter && now() < state.retryAfter) return false;
    if (state.parkFingerprint) {
      // legacy parked chats must not remain permanently frozen: reopen with a challenger strategy.
      state.parkFingerprint=''; state.parkSince=0;
      state.stalled=Math.max(3,state.stalled||0); state.missingReceipts=0; saveState();
    }
    if(!moduleOn('engine')||!moduleOn('auto')||checkConflicts()||isGenerating()) return false;
    const id=projectKey();
    if(id && LOCKED_PROCESS_IDS.has(id)) return false;
    const mode=id?projectMode(id):{enabled:true,auto:true};
    if(!mode.enabled||!mode.auto) return false;
    const L=id?learningFor(id):null; if(moduleOn('game')&&L?.status==='AWAITING_USER') return false;
    if(draft(findComposer())) return false;
    if(state.lastStatus&&EXIT.has(state.lastStatus)) return false;
    if(typeof state.lastPercent==='number'&&state.lastPercent>=100) return false;
    state.retryAfter=0;
    return true;
  }
  function maybeAutoStart() {
    if(phase!==STATES.IDLE&&phase!==STATES.PAUSED) return;
    if(stopReason&&/HUMAN_GATE|NO_SAFE_ACTION|completado/i.test(stopReason)) return;
    if(!shouldAutoStart()) return;
    if(!acquireLease()) return;
    stopReason=''; phase=STATES.READY;
    setStatus(document.hidden?'♾️ AUTO multiproyecto en segundo plano…':'♾️ AUTO multiproyecto activo…');
    render();
  }
  // Automatic mode never retries a delivery whose receipt is unknown.
  function lastVisibleAssistantFingerprint() {
    const nodes=document.querySelectorAll('[data-message-author-role="assistant"]');
    if (!nodes.length) return '';
    const node=nodes[nodes.length-1];
    return fingerprint((node.innerText||node.textContent||'').slice(-5000));
  }
  function restoreOutstanding() {
    if (!state.inFlightTicket) return false;
    if (!acquireLease()) { phase=STATES.PAUSED; setStatus('Otro panel controla este chat; no reenvío.',true); return false; }
    pending={ticket:state.inFlightTicket,sentAt:now(),lastCheckAt:0,receiptSeen:false};
    phase=STATES.WAITING;
    setStatus('♾️ Recuperando respuesta anterior sin duplicar envíos…');
    return true;
  }
  function parkUnproductiveLoop() {
    state.parkFingerprint=lastVisibleAssistantFingerprint();
    state.parkSince=now(); phase=STATES.PAUSED; releaseLease(); saveState();
    setStatus('⏳ AUTO espera evidencia nueva: no repito rutas improductivas.',true);
    render();
  }
  function readPresentation() {
    try {
      const old = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
      return {
        theme: ['amber','ocean','violet'].includes(old.theme) ? old.theme : 'amber',
        compact: old.compact !== false,
        x: Number.isFinite(old.x) ? old.x : null,
        y: Number.isFinite(old.y) ? old.y : null,
      };
    } catch { return { theme: 'amber', compact: true, x: null, y: null }; }
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
  function ensurePanelVisible() {
    if(!root || !root.isConnected) return;
    root.style.display='block'; root.style.visibility='visible'; root.style.opacity='1';
    const r=root.getBoundingClientRect();
    const bad=!Number.isFinite(r.left)||r.width<30||r.height<30||r.right<30||r.bottom<30||r.left>window.innerWidth-30||r.top>window.innerHeight-30;
    if(bad){
      presentation.x=null; presentation.y=null; savePresentation();
      root.style.left='auto'; root.style.top='auto';
      root.style.right='max(12px, env(safe-area-inset-right))';
      root.style.bottom='max(94px, calc(75px + env(safe-area-inset-bottom)))';
      setStatus('🛟 HUD rescatado a una posición visible.');
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
  function renderModules() {
    if(!dashboard) return;
    const labels={engine:'⚡ MOTOR',auto:'♾️ AUTO',progress:'📈 %',sync:'🌐 SYNC',game:'🎮 QUEST',aura:'🎨 AURA'};
    for(const b of dashboard.querySelectorAll('[data-module]')){
      const name=b.dataset.module,on=moduleOn(name); b.dataset.on=on?'true':'false'; b.textContent=(labels[name]||name)+' '+(on?'ON':'OFF');
    }
  }
  function projectDeadline(id) {
    const m=String(id||'').match(/(20\d{2})-(\d{2})-(\d{2})/);
    return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),23,59,59):null;
  }
  function sendLearningPayload(message,label) {
    if(isGenerating()){ setStatus('La respuesta sigue en curso; no interrumpo.',true); return false; }
    const composer=findComposer(); if(!composer){ setStatus('No encuentro el cuadro de mensaje.',true); return false; }
    if(draft(composer)){ setStatus('Tu borrador sigue intacto. Envíalo o bórralo antes de usar QUEST.',true); return false; }
    if(!fillComposer(composer,message)){ setStatus('No pude preparar la acción QUEST sin tocar tu borrador.',true); return false; }
    const send=findSend(); if(!send){ setStatus('Acción QUEST preparada; botón Enviar no disponible todavía.',true); return false; }
    send.click(); setStatus('🎮 '+label+' enviada');
    return true;
  }
  function sendLearningAction(kind) {
    const id=projectKey(), L=learningFor(id);
    if(!id){ setStatus('No hay PROCESS_ID académico activo todavía.',true); return; }
    const mission=L?.missionId||'SIGUIENTE';
    const actions={
      start:'🎮 LEARN_ACTION | START | PROCESS '+id+' | Activa la siguiente micro-misión del curso. Hazla interactiva y no reveles la solución antes de mi intento.',
      hint:'💡 LEARN_ACTION | HINT | PROCESS '+id+' | MISSION '+mission+' | Dame UNA pista mínima y socrática; no resuelvas el ejercicio por mí.',
      retry:'🔁 LEARN_ACTION | RETRY | PROCESS '+id+' | MISSION '+mission+' | Repite la misma habilidad con datos/contexto distintos. Conserva gates ya ganados.',
      boss:'👾 LEARN_ACTION | BOSS | PROCESS '+id+' | Lanza un boss/simulacro acumulativo apropiado a mi nivel actual; puntúa por gates, no por estilo.',
      map:'🗺️ LEARN_ACTION | MAP | PROCESS '+id+' | Muéstrame el mapa de misiones: completadas, actual, siguientes y boss. No cambies el % sin evidencia.'
    };
    sendLearningPayload(actions[kind]||actions.start,'acción '+kind.toUpperCase());
  }
  function sendLearningAnswer(answer) {
    const id=projectKey(), L=learningFor(id), clean=String(answer||'').trim();
    if(!id||!L?.missionId){ setStatus('Primero activa una misión.',true); return; }
    if(!clean){ setStatus('Escribe o elige una respuesta primero.',true); return; }
    const message='🎮 LEARN_ANSWER | PROCESS '+id+' | MISSION '+L.missionId+' | ANSWER '+clean.slice(0,1200)+' | Evalúa mi razonamiento; no me premies por estilo. Si PASS, acredita solo el gate demostrado y lanza la siguiente QUEST en esta misma respuesta.';
    if(sendLearningPayload(message,'respuesta')){
      const input=dashboard?.querySelector('[data-learn-answer]'); if(input) input.value='';
    }
  }
  function renderGame() {
    const box=dashboard?.querySelector('[data-value="game"]'); if(!box) return;
    box.hidden=!moduleOn('game'); if(box.hidden) return;
    const id=projectKey(), L=learningFor(id);
    if(!id || !looksLearningProcess()){
      box.innerHTML='<div class="quest-head"><b>🎮 LEARN QUEST</b><span>modo universal</span></div><div class="quest-empty">Se activa automáticamente en procesos de aprendizaje.</div><div class="quest-actions single"><button type="button" data-learn-action="start">🎯 crear misión</button></div>';
      return;
    }
    const xp=L?.xp||0, level=1+Math.floor(xp/500), reward=L?.reward||100, streak=L?.streak||0;
    const difficulty=Math.max(1,Math.min(5,L?.difficulty||1));
    const stars='⚔️'.repeat(difficulty)+'·'.repeat(5-difficulty);
    const deadline=projectDeadline(id), left=deadline?Math.max(0,deadline-Date.now()):null;
    const boss=deadline?'👾 '+deadline.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit'})+' · '+Math.ceil(left/86400000)+'d':'👾 boss dinámico';
    const mission=L?.missionId||'SIGUIENTE', title=L?.title||'Listo para generar la siguiente misión';
    const status=L?.status==='AWAITING_USER'?'🎯 TU TURNO':L?.lastResult==='PASS'?'✅ GATE CERRADO':'🛰️ LISTO';
    const choices=(L?.choices||[]).map(c=>'<button type="button" class="quest-choice" data-quest-choice="'+escapeHtml(c.key,4)+'"><b>'+escapeHtml(c.key,4)+'</b> '+escapeHtml(c.label,90)+'</button>').join('');
    box.innerHTML='<div class="quest-head"><b>🎮 LEARN QUEST</b><span>🔥 '+streak+'</span></div>'+
      '<div class="quest-title">'+escapeHtml(mission,26)+' · '+escapeHtml(title,70)+'</div>'+
      '<div class="quest-meta"><span>LVL '+level+'</span><span>✨ '+xp+' XP</span><span>'+stars+'</span></div>'+
      '<div class="quest-state">'+status+' · recompensa '+reward+' XP · '+boss+'</div>'+
      (choices?'<div class="quest-choices">'+choices+'</div>':'')+
      '<div class="quest-answer"><textarea data-learn-answer rows="2" placeholder="✍️ responde aquí… (Enter envía · Shift+Enter salto)"></textarea><button type="button" data-learn-submit>🚀</button></div>'+
      '<div class="quest-actions"><button type="button" data-learn-action="start">🎯 misión</button><button type="button" data-learn-action="hint">💡 pista</button><button type="button" data-learn-action="retry">🔁 retry</button><button type="button" data-learn-action="boss">👾 boss</button><button type="button" data-learn-action="map">🗺️ mapa</button></div>'+
      '<div class="quest-rule">✨ XP/racha motivan · 📈 porcentaje = dominio verificado · otros proyectos AUTO siguen aparte</div>';
  }
  function renderProjects() {
    const box=dashboard?.querySelector('[data-value="projects"]'); if(!box) return;
    const rows=Object.values(projects).sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,12);
    if(!rows.length){ box.innerHTML='<div class="empty">abre/visita un chat con 🧩 PROCESO y aparecerá aquí automáticamente</div>'; return; }
    box.innerHTML=rows.map(p=>{
      const mode=projectMode(p.id), pct=typeof p.current_pct==='number'?formatPercent(p.current_pct):'—';
      const frac=p.numerator!==null&&p.denominator?p.numerator+'/'+p.denominator:'—';
      return '<div class="project-card" data-current="'+(p.id===projectKey()?'true':'false')+'"><div class="project-main"><b>'+escapeText(p.id,34)+'</b><span>'+pct+' · '+frac+'</span></div><div class="project-actions"><button type="button" data-project-enabled="'+p.id+'">'+(mode.enabled?'🟢 ON':'⚫ OFF')+'</button><button type="button" data-project-auto="'+p.id+'">'+(mode.auto?'♾️ AUTO':'✋ MANUAL')+'</button></div></div>';
    }).join('');
  }

  function missionProjectRows() {
    return Object.values(projects||{}).sort((a,b)=>{
      const qa=typeof a.current_pct==='number'?1:0, qb=typeof b.current_pct==='number'?1:0;
      if(qa!==qb) return qb-qa;
      return String(b.updated_at||'').localeCompare(String(a.updated_at||''));
    }).slice(0,8);
  }
  function missionNode(label,done,active=false,locked=false) {
    const cls=done?'done':active?'active':locked?'locked':'';
    return '<div class="mc-node '+cls+'"><span class="mc-dot">'+(done?'✓':locked?'🔒':active?'◎':'•')+'</span><b>'+escapeHtml(label,18)+'</b></div>';
  }
  function renderMissionControl() {
    if(!missionOverlay) return;
    const id=projectKey()||'CFI-E2-2026-10-16';
    const p=projects[id]||projects['CFI-E2-2026-10-16']||{};
    const L=learningFor(id)||{};
    const pct=typeof p.current_pct==='number'?p.current_pct:(typeof state.lastPercent==='number'?state.lastPercent:null);
    const xp=L.xp||0, level=1+Math.floor(xp/500), streak=L.streak||0;
    const frac=Number.isInteger(p.numerator)&&Number.isInteger(p.denominator)?p.numerator+'/'+p.denominator:'—';
    const rows=missionProjectRows();
    const projectBars=rows.map(row=>{
      const rp=typeof row.current_pct==='number'?Math.max(0,Math.min(100,row.current_pct)):null;
      return '<div class="mc-project"><div><b>'+escapeHtml(shortProjectLabel(row.id),22)+'</b><span>'+(rp===null?'—':formatPercent(rp))+'</span></div><div class="mc-mini"><i style="width:'+(rp===null?0:rp)+'%"></i></div></div>';
    }).join('');
    const choices=(L.choices||[]).map(c=>'<button type="button" class="mc-choice" data-quest-choice="'+escapeHtml(c.key,4)+'"><span>'+escapeHtml(c.key,4)+'</span>'+escapeHtml(c.label,90)+'</button>').join('');
    const map=[
      missionNode('NIC 40',false,true,false),
      missionNode('NIC 23',false,false,false),
      missionNode('NIC 36',false,false,false),
      missionNode('NIC 38',false,false,false),
      missionNode('SIMULACRO',false,false,true)
    ].join('<div class="mc-link"></div>');
    missionOverlay.innerHTML=
      '<div class="mc-shell">'+
        '<div class="mc-topbar"><div class="mc-brand">🚀 AVANZA <span>MISSION CONTROL</span></div><div class="mc-topchips">'+
          '<span>🧩 COCKPIT <b>'+formatPercent(projects['COCKPIT-TOTAL-v1']?.current_pct)+'</b></span>'+
          '<span>🎓 CFI <b>'+formatPercent(projects['CFI-E2-2026-10-16']?.current_pct)+'</b></span>'+
          '<span>🎮 QUEST <b>LVL '+level+'</b></span>'+
        '</div><button type="button" data-action="cinema-close">✕</button></div>'+
        '<div class="mc-grid">'+
          '<aside class="mc-left">'+
            '<div class="mc-orb" style="--mc:'+(pct??0)+'"><div><strong>'+formatPercent(pct)+'</strong><small>AVANCE</small></div></div>'+
            '<div class="mc-stat-grid"><div>⭐<b>'+xp+'</b><span>XP</span></div><div>🔥<b>'+streak+'</b><span>RACHA</span></div><div>🚩<b>'+frac+'</b><span>GATES</span></div><div>🎚️<b>'+level+'</b><span>NIVEL</span></div></div>'+
            '<div class="mc-card"><h4>📊 PROYECTOS</h4>'+projectBars+'</div>'+
          '</aside>'+
          '<main class="mc-center">'+
            '<section class="mc-hero"><div><small>CFI 2026.2</small><h2>🎯 Misión activa — '+escapeHtml(L.missionId||'SIGUIENTE',30)+'</h2><p>'+escapeHtml(L.title||p.next_action||'Recuperar siguiente micro-misión verificable.',160)+'</p></div><div class="mc-badge">⚔️ '+Math.max(1,Math.min(5,L.difficulty||1))+'/5</div></section>'+
            '<section class="mc-quest">'+
              '<div class="mc-quest-head"><span>🎮 TU TURNO</span><b>+'+(L.reward||100)+' XP</b></div>'+
              (choices?'<div class="mc-choices">'+choices+'</div>':'<div class="mc-open">✍️ Respuesta abierta: usa la caja inferior o pulsa 🎯 misión para generar opciones.</div>')+
              '<div class="mc-answer"><textarea data-learn-answer rows="3" placeholder="Escribe tu respuesta… Enter envía · Shift+Enter salto"></textarea><button type="button" data-learn-submit>🚀</button></div>'+
              '<div class="mc-actions"><button data-learn-action="hint">💡 PISTA</button><button data-learn-action="retry">🔁 RETRY</button><button data-learn-action="boss">👾 BOSS</button><button data-learn-action="map">🗺️ MAPA</button></div>'+
            '</section>'+
          '</main>'+
          '<aside class="mc-right">'+
            '<div class="mc-card"><h4>🗺️ MAPA DE MISIONES</h4><div class="mc-road">'+map+'</div></div>'+
            '<div class="mc-boss"><span>👾 BOSS BATTLE</span><h3>SIMULACRO E2</h3><p>mezcla de NIC 40 · 23 · 36 · 38</p><button type="button" data-learn-action="boss">🏆 ENFRENTAR BOSS</button></div>'+
            '<div class="mc-card"><h4>🎁 RECOMPENSAS</h4><div class="mc-rewards"><span>🏆<b>+400 XP</b></span><span>💎<b>NIC 40</b></span><span>📘<b>SIMULACRO</b></span></div></div>'+
          '</aside>'+
        '</div>'+
      '</div>';
  }
  function toggleMissionControl(force) {
    if(!missionOverlay) return;
    const open=typeof force==='boolean'?force:missionOverlay.hidden;
    missionOverlay.hidden=!open;
    if(open){ renderMissionControl(); missionOverlay.querySelector('textarea')?.focus(); }
  }
  function applyAura() {
    const old=document.getElementById(AURA_STYLE_ID);
    if(!moduleOn('aura')){ old?.remove(); return; }
    let style=old; if(!style){ style=document.createElement('style'); style.id=AURA_STYLE_ID; document.head?.appendChild(style); }
    style.textContent='html,body{background:radial-gradient(circle at 12% 10%,rgba(124,58,237,.16),transparent 28%),radial-gradient(circle at 88% 18%,rgba(6,182,212,.16),transparent 30%),radial-gradient(circle at 48% 92%,rgba(245,158,11,.12),transparent 32%),linear-gradient(145deg,#07101f,#0d1730 45%,#10253c)!important;background-attachment:fixed!important}[data-message-author-role="assistant"]>div,[data-message-author-role="user"]>div{border-radius:18px!important}';
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
      if (phase === STATES.READY || phase === STATES.WAITING) defer('Conflicto de macro detectado: bloqueo envíos y reevalúo automáticamente cuando desaparezca.', true, 5000);
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
      .progress-ribbon{display:flex;gap:5px;overflow:auto;padding:7px 1px 2px;scrollbar-width:thin}.progress-chip{flex:0 0 auto;border:1px solid #40536d;background:#0e1d32;border-radius:999px;padding:4px 7px;font-size:8.5px;color:#dbeafe;white-space:nowrap}.progress-chip[data-active=true]{border-color:var(--accent);color:var(--accent-light);box-shadow:0 0 12px var(--accent-halo)}
      .section{margin-top:10px;padding-top:9px;border-top:1px solid var(--stroke)}.section-title{font-size:9px;color:#94a3b8;font-weight:800;letter-spacing:.08em;margin-bottom:6px}
      .modules{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.modules button,.project-actions button{border:1px solid #40536d;background:#17263c;color:#e5eef8;border-radius:8px;padding:5px 4px;font-size:8.5px;font-weight:800;cursor:pointer}.modules button[data-on=true]{border-color:var(--accent);box-shadow:0 0 10px var(--accent-halo);color:var(--accent-light)}
      .projects{display:grid;gap:5px;max-height:180px;overflow:auto}.project-card{border:1px solid #31445e;background:#0d1b2d;border-radius:10px;padding:6px}.project-card[data-current=true]{border-color:var(--accent);box-shadow:0 0 14px var(--accent-halo)}.project-main{display:flex;justify-content:space-between;gap:5px;font-size:9px}.project-main b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-main span{color:#cbd5e1;white-space:nowrap}.project-actions{display:flex;gap:5px;margin-top:5px}.project-actions button{flex:1}.empty{font-size:9px;color:#8495aa;line-height:1.35}
      .game{margin-top:8px;border:1px solid #6d4aff;background:radial-gradient(circle at 8% 20%,rgba(236,72,153,.17),transparent 34%),linear-gradient(120deg,#2e1065d9,#164e63d9);border-radius:13px;padding:9px;font-size:9px;color:#f3e8ff;font-weight:750;box-shadow:0 0 22px rgba(124,58,237,.12)}.quest-head{display:flex;justify-content:space-between;align-items:center;gap:7px}.quest-head span{color:#f9a8d4}.quest-title{font-size:10px;margin-top:6px;color:#fff;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.quest-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.quest-meta span{background:#111c32aa;border:1px solid #596a86;border-radius:999px;padding:3px 6px}.quest-state{margin-top:7px;color:#c4f1ff}.quest-choices{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.quest-choice{border:1px solid #6d5bd0;background:#201a43;color:#f8f7ff;border-radius:9px;padding:7px 6px;font-size:8.5px;text-align:left;cursor:pointer}.quest-choice:hover{transform:translateY(-1px);box-shadow:0 0 12px #a78bfa44}.quest-answer{display:flex;gap:5px;margin-top:7px}.quest-answer textarea{flex:1;resize:vertical;min-height:48px;max-height:120px;border:1px solid #52637d;border-radius:9px;background:#0c1728;color:#f8fafc;padding:7px;font:9px/1.35 ui-sans-serif,system-ui,sans-serif;outline:none}.quest-answer textarea:focus{border-color:#c4b5fd;box-shadow:0 0 0 2px #a78bfa22}.quest-answer button{width:40px;border:0;border-radius:9px;background:linear-gradient(135deg,#f59e0b,#ec4899,#7c3aed);color:#fff;font-size:17px;cursor:pointer}.quest-actions{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:7px}.quest-actions.single{grid-template-columns:1fr}.quest-actions button{border:1px solid #596a86;background:#13233d;color:#eef7ff;border-radius:8px;padding:5px 2px;font-size:8px;font-weight:800;cursor:pointer}.quest-actions button:hover{border-color:#c4b5fd;box-shadow:0 0 10px #a78bfa33}.quest-rule,.quest-empty{margin-top:6px;color:#cbd5e1;font-size:8px;line-height:1.3}
      .top{cursor:move;touch-action:none;user-select:none}
      .top button{cursor:pointer;touch-action:manipulation;border:1px solid #41536c;border-radius:8px;color:#e2e8f0;background:#1a2a43;padding:4px 7px;font-size:12px}
      .top button:focus-visible{outline:2px solid var(--accent)}
      .mc-overlay[hidden]{display:none!important}.mc-overlay{position:fixed;inset:12px;z-index:2147483600;border-radius:24px;overflow:auto;background:radial-gradient(circle at 15% 8%,rgba(34,211,238,.16),transparent 26%),radial-gradient(circle at 80% 12%,rgba(168,85,247,.18),transparent 28%),radial-gradient(circle at 80% 88%,rgba(236,72,153,.14),transparent 30%),linear-gradient(150deg,#06111f 0%,#091a33 45%,#090d22 100%);color:#f8fbff;border:1px solid rgba(125,211,252,.28);box-shadow:0 25px 100px rgba(0,0,0,.68),0 0 60px rgba(79,70,229,.16);backdrop-filter:blur(24px)}
      .mc-shell{min-height:100%;padding:14px}.mc-topbar{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #284268;border-radius:15px;background:#08172bbf;box-shadow:0 0 24px #0ea5e922}.mc-brand{font-weight:950;letter-spacing:.08em}.mc-brand span{color:#67e8f9;font-size:10px}.mc-topchips{display:flex;gap:7px;flex:1;justify-content:center;flex-wrap:wrap}.mc-topchips span{border:1px solid #3c5275;border-radius:999px;padding:6px 9px;background:#0c1a31;color:#cbd5e1;font-size:9px}.mc-topchips b{color:#fff;margin-left:4px}.mc-topbar>button{border:1px solid #475569;background:#111827;color:#fff;border-radius:10px;padding:6px 9px;cursor:pointer}
      .mc-grid{display:grid;grid-template-columns:minmax(190px,240px) minmax(420px,1fr) minmax(220px,300px);gap:12px;margin-top:12px}.mc-left,.mc-right{display:grid;gap:10px;align-content:start}.mc-center{display:grid;gap:10px;align-content:start}
      .mc-orb{--mc:0;width:155px;height:155px;margin:4px auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#22d3ee 0 calc(var(--mc)*1%),#a855f7 calc(var(--mc)*1%) calc(var(--mc)*1% + 8%),#172554 calc(var(--mc)*1% + 8%) 100%);box-shadow:0 0 38px #22d3ee44}.mc-orb>div{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;align-content:center;background:#071225;border:1px solid #25466f}.mc-orb strong{font-size:25px}.mc-orb small{color:#94a3b8}
      .mc-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mc-stat-grid>div{padding:8px;border:1px solid #263c5e;border-radius:11px;background:#0c172a;text-align:center}.mc-stat-grid b{display:block;font-size:14px}.mc-stat-grid span{font-size:8px;color:#94a3b8}.mc-card{border:1px solid #284268;border-radius:14px;background:#0a172abf;padding:10px}.mc-card h4{margin:0 0 8px;color:#dbeafe}.mc-project{margin:7px 0}.mc-project>div:first-child{display:flex;justify-content:space-between;font-size:8.5px}.mc-mini{height:5px;border-radius:99px;background:#1e293b;overflow:hidden;margin-top:3px}.mc-mini i{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#8b5cf6,#ec4899);box-shadow:0 0 12px #8b5cf688}
      .mc-hero{display:flex;justify-content:space-between;gap:12px;padding:16px;border:1px solid #5b3dc7;border-radius:17px;background:linear-gradient(120deg,#1b1d4a,#0d2745 56%,#151238);box-shadow:0 0 32px #8b5cf633}.mc-hero small{color:#67e8f9;font-weight:800}.mc-hero h2{margin:5px 0 4px;font-size:22px}.mc-hero p{margin:0;color:#cbd5e1}.mc-badge{align-self:start;border:1px solid #f59e0b;background:#451a03;color:#fcd34d;border-radius:999px;padding:7px 9px;font-weight:900;white-space:nowrap}
      .mc-quest{border:1px solid #4f46e5;border-radius:17px;padding:14px;background:linear-gradient(180deg,#0b1830e8,#091326e8)}.mc-quest-head{display:flex;justify-content:space-between;color:#c4b5fd;margin-bottom:10px}.mc-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mc-choice{border:1px solid #35537c;background:linear-gradient(100deg,#0f2a49,#1f1c52);color:#fff;border-radius:12px;padding:11px;text-align:left;cursor:pointer;transition:.16s}.mc-choice:hover{transform:translateY(-2px);border-color:#67e8f9;box-shadow:0 0 18px #22d3ee33}.mc-choice span{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#0ea5e9;margin-right:8px;font-weight:950}.mc-open{padding:14px;border:1px dashed #475569;border-radius:12px;color:#cbd5e1}.mc-answer{display:flex;gap:8px;margin-top:10px}.mc-answer textarea{flex:1;min-height:76px;resize:vertical;border:1px solid #365174;background:#071223;color:#fff;border-radius:12px;padding:10px;outline:none}.mc-answer textarea:focus{border-color:#c084fc;box-shadow:0 0 0 2px #a855f733}.mc-answer button{width:52px;border:0;border-radius:12px;background:linear-gradient(135deg,#06b6d4,#8b5cf6,#ec4899);color:#fff;font-size:20px;cursor:pointer}.mc-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px}.mc-actions button{border:1px solid #354b69;background:#10223b;color:#fff;border-radius:10px;padding:8px;cursor:pointer}
      .mc-road{display:grid;justify-items:center}.mc-node{display:flex;align-items:center;gap:7px;min-width:130px;border:1px solid #334155;background:#0e1b2f;border-radius:999px;padding:7px 10px}.mc-node.done{border-color:#10b981}.mc-node.active{border-color:#f59e0b;box-shadow:0 0 18px #f59e0b55}.mc-node.locked{opacity:.55}.mc-dot{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#16283f}.mc-link{width:2px;height:16px;background:linear-gradient(#22d3ee,#8b5cf6)}.mc-boss{border:1px solid #b91c1c;border-radius:15px;padding:13px;background:radial-gradient(circle at 85% 20%,#7f1d1d66,transparent 35%),linear-gradient(135deg,#2a0b18,#190b13);box-shadow:0 0 25px #ef444422}.mc-boss span{color:#fca5a5;font-weight:900}.mc-boss h3{margin:5px 0}.mc-boss p{color:#fecaca;font-size:9px}.mc-boss button{width:100%;border:0;border-radius:10px;padding:10px;background:linear-gradient(100deg,#f43f5e,#e11d48,#7c3aed);color:#fff;font-weight:900;cursor:pointer}.mc-rewards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.mc-rewards span{border:1px solid #384f72;border-radius:10px;padding:10px 5px;text-align:center;background:#0d1a2d;font-size:17px}.mc-rewards b{display:block;font-size:8px;margin-top:4px}
      @media(max-width:1050px){.mc-grid{grid-template-columns:200px 1fr}.mc-right{grid-column:1/-1;grid-template-columns:1fr 1fr 1fr}.mc-choices{grid-template-columns:1fr}}
      @media(max-width:720px){.mc-overlay{inset:4px}.mc-grid{grid-template-columns:1fr}.mc-left,.mc-right{grid-template-columns:1fr}.mc-topchips{display:none}.mc-orb{width:120px;height:120px}.mc-orb>div{width:92px;height:92px}.mc-hero h2{font-size:17px}.mc-actions{grid-template-columns:1fr 1fr}}

      .panel.compact{padding:10px}
      .panel.compact .title,.panel.compact .section,.panel.compact .game,.panel.compact .health,.panel.compact .tinyrow,.panel.compact .next,.panel.compact .foot{display:none}
      .panel.compact .ring{width:88px;height:88px;flex:0 0 88px;margin:6px 0}
      .panel.compact .center{width:70px;height:70px}
      .panel.compact .pct{font-size:21px}
      .panel.compact .go{min-height:46px;font-size:12px}
      .panel.compact .metrics{justify-content:space-between;gap:12px}.panel.compact .title{display:block;margin:8px 0 7px}.panel.compact .tinyrow{display:flex;margin:8px 0}.panel.compact .next{display:block;margin-bottom:10px;font-size:9px;min-height:0}.panel.compact .status{font-size:9px}
      :host([data-theme=ocean]) .delta,:host([data-theme=violet]) .delta{color:var(--accent-light)}
      @media(max-width:460px){:host{max-width:calc(100vw - 16px)}}
      @media(max-width:460px){.panel{padding:12px;border-radius:18px}.ring{width:88px;height:88px;flex-basis:88px}.center{width:69px;height:69px}.pct{font-size:19px}}

      /* Aurora Focus UI — visual overlay ONLY. Existing goals and runtime are unchanged. */
      .panel{position:relative;isolation:isolate;background:
        radial-gradient(ellipse 160px 120px at 90% -10%,rgba(56,189,248,.26),transparent 90%),
        radial-gradient(ellipse 200px 140px at -10% 30%,rgba(168,85,247,.22),transparent 85%),
        linear-gradient(145deg,#0e1630 0%,#0b182c 48%,#080d1d 100%);
        border:1px solid rgba(125,211,252,.40);
        box-shadow:0 18px 60px rgba(1,5,19,.54),0 0 0 1px rgba(255,255,255,.065) inset,0 0 38px rgba(99,102,241,.11);
        transition:border-color .35s,box-shadow .45s,transform .25s;
        scrollbar-color:rgba(148,163,184,.42) transparent}
      .panel[data-activity=running],.panel[data-activity=waiting]{border-color:var(--accent);
        box-shadow:0 20px 65px rgba(0,0,0,.60),0 0 0 1px var(--accent-halo) inset,0 0 38px var(--accent-halo)}
      .top{position:relative;padding:0 0 8px;border-bottom:1px solid rgba(148,163,184,.17)}
      .logo{background:linear-gradient(125deg,#ffdd82,#fd9f45 46%,#e879f9);color:#190d20;
        box-shadow:0 0 22px rgba(250,204,21,.20),0 0 28px rgba(217,70,239,.15)}
      .brand{font-size:13px;letter-spacing:.13em;background:linear-gradient(95deg,#fff4ba,#f9a8d4 52%,#67e8f9);
        background-clip:text;-webkit-background-clip:text;color:transparent}
      .pill{display:inline-flex;align-items:center;gap:5px;color:#cddbee;border-color:rgba(125,211,252,.30);font-variant-numeric:tabular-nums}
      .pill[data-live=true]{color:#bbf7d0;border-color:rgba(52,211,153,.56);background:rgba(6,78,59,.32);
        animation:avanza-breathe 2.6s ease-in-out infinite}
      .go{overflow:hidden;background:linear-gradient(110deg,#fde68a 0%,#fbbf24 31%,#f472b6 65%,#67e8f9 100%);
        background-size:220% 220%;color:#141827;font-size:13px;min-height:49px;
        border:1px solid rgba(255,255,255,.39);
        box-shadow:0 5px 25px rgba(250,204,21,.20),0 0 26px rgba(217,70,239,.12);
        transition:filter .2s,transform .2s,box-shadow .2s,background-position .5s}
      .go:hover{background-position:100% 50%;box-shadow:0 7px 30px rgba(244,114,182,.26);transform:translateY(-2px)}
      .go.active{background:linear-gradient(105deg,#16a34a,#0d9488 40%,#2563eb 85%,#7c3aed);
        background-size:240% 100%;color:#f0fdf4;border-color:#86efac;box-shadow:0 0 21px rgba(34,197,94,.25);
        animation:avanza-flow 5s ease-in-out infinite}
      .ring{box-shadow:0 0 25px var(--accent-halo),inset 0 0 8px rgba(255,255,255,.14)}
      .panel[data-activity=running] .ring,.panel[data-activity=waiting] .ring{animation:avanza-breathe 2.8s ease-in-out infinite}
      .center{background:radial-gradient(circle at 32% 16%,#172746,#091326 76%);box-shadow:inset 0 0 18px rgba(3,7,18,.45)}
      .bar{height:7px;background:#16243b;border:1px solid rgba(148,163,184,.13)}
      .bar-fill{box-shadow:0 0 13px var(--accent-halo);background:linear-gradient(90deg,var(--accent),#a78bfa,#67e8f9)}
      .progress-chip{background:linear-gradient(120deg,#132642,#181f3b);border-color:#3a5574;font-variant-numeric:tabular-nums}
      .progress-chip[data-active=true]{background:linear-gradient(110deg,#1c2d47,#382755);font-weight:850}
      .status{background:rgba(20,36,61,.45);border-left:2px solid rgba(125,211,252,.50);border-radius:6px;padding:6px 8px}
      .status[data-warning=true]{background:rgba(124,45,18,.2);border-left-color:#fb923c}
      .panel.compact{padding:12px;border-radius:19px}
      @keyframes avanza-breathe{0%,100%{filter:brightness(1);box-shadow:0 0 12px var(--accent-halo)}
        50%{filter:brightness(1.13);box-shadow:0 0 28px var(--accent-halo)}}
      @keyframes avanza-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
      @media(prefers-reduced-motion:reduce){.go,.bar-fill,.panel{transition:none!important}
        .go.active,.pill[data-live=true],.panel[data-activity=running] .ring,
        .panel[data-activity=waiting] .ring{animation:none!important}}
      @media(prefers-reduced-motion:reduce){.go,.bar-fill{transition:none}}
    `;
    const panel=document.createElement('div');panel.className='panel';
    panel.innerHTML=`<div class="top"><span class="logo" aria-hidden="true">↗</span><div class="topname"><div class="brand">AVANZA</div><div class="sub">MACRO MAESTRO · v4</div></div><button type="button" data-action="cinema" title="Abrir Mission Control">🌌</button><button type="button" data-action="theme" title="Cambiar color">◐</button><button type="button" data-action="collapse" title="Compactar / ampliar">▁</button><span class="pill" data-value="live-indicator" data-live="false">◇ LISTO</span></div>
      <div class="health" data-value="health" data-warning="false">Versión remota sin verificar</div>
      <div class="progress-ribbon" data-value="progress-ribbon" aria-label="Porcentajes verificados de proyectos"></div>
      <div class="section"><div class="section-title">🎛️ MACROS · ON/OFF</div><div class="modules"><button data-module="engine"></button><button data-module="auto"></button><button data-module="progress"></button><button data-module="sync"></button><button data-module="game"></button><button data-module="aura"></button></div></div>
      <div class="section"><div class="section-title">🗺️ PROYECTOS · PARALELO</div><div class="projects" data-value="projects"></div></div>
      <div class="game" data-value="game"></div>
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
    panel.addEventListener('click', event => {
      const mod=event.target.closest('[data-module]');
      if(mod){
        const name=mod.dataset.module; control.modules[name]=!moduleOn(name);
        if(name==='sync') initChannel();
        if(name==='engine'&&!moduleOn('engine')&&(phase===STATES.READY||phase===STATES.WAITING)) pause('⚡ MOTOR OFF desde el cockpit.');
        saveControl(); render(); return;
      }
      const en=event.target.closest('[data-project-enabled]');
      if(en){ const id=en.dataset.projectEnabled; setProjectMode(id,{enabled:!projectMode(id).enabled}); return; }
      const au=event.target.closest('[data-project-auto]');
      if(au){ const id=au.dataset.projectAuto; if(LOCKED_PROCESS_IDS.has(id)){setStatus('Proyecto archivado: AUTO bloqueado hasta una reactivación canónica explícita.',true);return;} setProjectMode(id,{auto:!projectMode(id).auto,enabled:true}); return; }
      const learn=event.target.closest('[data-learn-action]');
      if(learn){ sendLearningAction(learn.dataset.learnAction); return; }
      const choice=event.target.closest('[data-quest-choice]');
      if(choice){
        const L=learningFor(projectKey()), key=choice.dataset.questChoice;
        const item=(L?.choices||[]).find(c=>c.key===key);
        sendLearningAnswer(item?key+' — '+item.label:key); return;
      }
      const submit=event.target.closest('[data-learn-submit]');
      if(submit){ const input=panel.querySelector('[data-learn-answer]'); sendLearningAnswer(input?.value||''); return; }
    });
    panel.querySelector('[data-action="cinema"]').addEventListener('click', () => toggleMissionControl());
    panel.querySelector('[data-action="theme"]').addEventListener('click', () => {
      const themes = ['amber','ocean','violet'];
      presentation.theme = themes[(themes.indexOf(presentation.theme) + 1) % themes.length];
      savePresentation(); applyPresentation();
    });
    panel.querySelector('[data-action="collapse"]').addEventListener('click', () => {
      presentation.compact = !presentation.compact;
      savePresentation(); applyPresentation();
    });
    panel.addEventListener('keydown', event => {
      const input=event.target.closest?.('[data-learn-answer]');
      if(input && event.key==='Enter' && !event.shiftKey){
        event.preventDefault(); sendLearningAnswer(input.value||'');
      }
    });
    panel.querySelector('.top').addEventListener('pointerdown',dragStart);
    dashboard=panel;
    missionOverlay=document.createElement('div');
    missionOverlay.className='mc-overlay';
    missionOverlay.hidden=true;
    missionOverlay.addEventListener('click',event=>{
      const close=event.target.closest('[data-action="cinema-close"]');
      if(close){ toggleMissionControl(false); return; }
      const choice=event.target.closest('[data-quest-choice]');
      if(choice){
        const L=learningFor(projectKey()), key=choice.dataset.questChoice;
        const item=(L?.choices||[]).find(c=>c.key===key);
        sendLearningAnswer(item?key+' — '+item.label:key); return;
      }
      const submit=event.target.closest('[data-learn-submit]');
      if(submit){ const input=missionOverlay.querySelector('[data-learn-answer]'); sendLearningAnswer(input?.value||''); return; }
      const action=event.target.closest('[data-learn-action]');
      if(action){ sendLearningAction(action.dataset.learnAction); return; }
    });
    missionOverlay.addEventListener('keydown',event=>{
      const input=event.target.closest?.('[data-learn-answer]');
      if(input&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendLearningAnswer(input.value||'');}
      if(event.key==='Escape'){toggleMissionControl(false);}
    });
    shadow.append(css,panel,missionOverlay);
    document.body.appendChild(root);
    applyPresentation();
    applyAura();
    discoverVisibleProjects();
    renderModules(); renderProjects(); renderGame(); renderProgressRibbon();
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
    timer = setInterval(() => {
      if (!document.getElementById(APP)) scheduleMount();
      checkConflicts(); discoverVisibleProjects(); discoverLearning(); ensurePanelVisible(); maybeAutoStart(); tick();
    }, CHECK_EVERY_MS);
    window.addEventListener('pagehide', () => { releaseLease(); saveState(); });
    document.addEventListener('keydown', e => {
      if (e.repeat || !e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || String(e.key).toLowerCase() !== 'a') return;
      e.preventDefault();
      // Legacy scripts also bind this shortcut on document bubble phase.
      e.stopImmediatePropagation();
      toggle();
    }, true);
  }
  initChannel();
  function boot() {
    pageBaselineAssistantFingerprint = lastVisibleAssistantFingerprint();
    mount(); observe(); discoverLearning();
    if (state.inFlightTicket) restoreOutstanding();
    else maybeAutoStart();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
