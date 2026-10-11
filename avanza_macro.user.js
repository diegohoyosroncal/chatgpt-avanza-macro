// ==UserScript==
// @name         AVANZA — Control de continuación inteligente para ChatGPT
// @namespace    https://chatgpt.com/
// @version      1.0.3
// @description  Agrega un botón AVANZA a cada conversación de ChatGPT web, sin transmitir datos a terceros.
// @updateURL    https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro.user.js
// @downloadURL  https://raw.githubusercontent.com/diegohoyosroncal/chatgpt-avanza-macro/main/avanza_macro.user.js
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const ROOT_ID = 'avanza-universal-control-v1';
  const STATUS_ID = 'avanza-universal-status-v1';
  const MACRO = [
    'AVANZA AL OBJETIVO — CONTINUACIÓN INTELIGENTE. Este mensaje no cambia mis objetivos previos ni autoriza gastos.',
    '1) Recupera el contexto de ESTA conversación y los checkpoints canónicos pertinentes; confirma cuál es el objetivo real y el hito medible aún abierto.',
    '2) Identifica el cuello de botella. Antes de ejecutar, contrasta alternativas viables, globales y verificables: ADOPTAR, REUTILIZAR, INTEGRAR, FUSIONAR, DELEGAR legítimamente, SUSTITUIR, ADAPTAR o CONSTRUIR solo una capacidad faltante. Compara valor esperado, coste marginal, seguridad, tiempo y reversibilidad.',
    '3) EJECUTA AHORA las acciones seguras y ya autorizadas de mayor impacto, comprueba cada efecto mediante evidencia primaria y sigue con las otras ramas útiles en esta misma ejecución; no termines en recomendaciones o documentos si existe una acción realizable.',
    '4) Ante tres intentos o ciclos sin progreso VERIFICABLE, deja de repetir la misma ruta, diagnostica causa raíz, elige un challenger materialmente diferente, ejecútalo y vuelve a comprobar. Nunca cuentes planes, CI, alertas, código ni tráfico como ingresos o cumplimiento final.',
    '5) Antes de cerrar, vuelve a evaluar si queda una acción autorizada de valor positivo. Persiste RECEIPT, OBJETIVO, OWNER, bloqueo, NEXT_EXACT_ACTION y RESUME_CONDITION para el ejecutor externo ya existente; no crees otro cron o runtime duplicado para fingir continuidad.',
    '6) Responde SIEMPRE con OBJETIVO; porcentaje ANTERIOR → ACTUAL (numerador/denominador), DELTA en puntos porcentuales; EFECTO VERIFICADO; BLOQUEO comprobado y SIGUIENTE HITO. Si el denominador no está validado di NO DETERMINABLE y no inventes porcentajes.',
    '7) Si una continuación debe sobrevivir a este turno, usa únicamente el puente seguro y previamente autorizado al ejecutor persistente que ya existe, cuando esté disponible. Registra un evento mínimo idempotente sin transcripciones, credenciales ni datos privados y verifica por separado COLA→ENTREGA→ACCIÓN→EFECTO. DONE/ACK de cola NO prueba ejecución útil: si no hubo nueva acción distinta y verificada, declara el bloqueo, compara alternativas y no subas el porcentaje. No inventes conectores ni uses eventos de prueba repetitivos.',
    'No pagues, cambies contratos, manejes secretos, suprimas controles de acceso ni hagas irreversibles sin autorización específica. Mi intervención humana rutinaria debe tender a cero. No afirmes control de otros chats ni ejecución después del turno sin evidencia independiente.'
  ].join('\n');

  let sending = false;
  let lastSubmitAt = 0;
  const SUBMIT_DEDUP_MS = 4500;
  let statusTimeout;

  function status(message, warning = false) {
    const node = document.getElementById(STATUS_ID);
    if (!node) return;
    node.textContent = message;
    node.style.color = warning ? '#fed7aa' : '#bbf7d0';
    node.style.opacity = '1';
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => { node.style.opacity = '0'; }, 5200);
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function findComposer() {
    const selectors = [
      '#prompt-textarea[contenteditable="true"]',
      '#prompt-textarea',
      'form [contenteditable="true"][role="textbox"]',
      '[data-testid="composer-input"] [contenteditable="true"]',
      'form .ProseMirror[contenteditable="true"]',
      'main [contenteditable="true"][role="textbox"]',
      'form textarea',
      'main textarea'
    ];
    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)].filter(visible);
      const node = nodes.at(-1);
      if (node) return node;
    }
    return null;
  }

  function existingDraft(el) {
    const draft = el.isContentEditable ? el.innerText : el.value;
    return String(draft ?? '').trim();
  }

  function updateComposer(el, message) {
    el.focus();
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      // User-gesture-only DOM edit: no clipboard permissions and no network calls.
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      const inserted = document.execCommand('insertText', false, message);
      if (!inserted || !existingDraft(el)) {
        // A direct edit may not register in all React versions; leave a draft,
        // never claim it was submitted if no enabled send button appears.
        el.textContent = message;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
      }
      return existingDraft(el).includes('AVANZA AL OBJETIVO');
    }
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, message);
    else el.value = message;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
    return String(el.value).includes('AVANZA AL OBJETIVO');
  }

  function findSend(composer) {
    const parent = composer.closest('form') || composer.closest('[data-testid="composer"]') || document;
    const selectors = [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Enviar mensaje"]',
      'button[aria-label="Enviar"]',
      'button[type="submit"]'
    ];
    for (const selector of selectors) {
      const n = parent.querySelector(selector);
      if (n && visible(n) && !n.disabled && n.getAttribute('aria-disabled') !== 'true') return n;
    }
    return null;
  }

  function generationInProgress() {
    const ids = ['stop-button', 'composer-stop-button'];
    if (ids.some(id => document.querySelector(`button[data-testid="${id}"]`))) return true;
    return [...document.querySelectorAll('button[aria-label]')].some(b =>
      visible(b) && /^(stop generating|detener generación|detener la generación|stop streaming)$/i.test(b.getAttribute('aria-label') || '')
    );
  }

  // Only a visible user message is a UI-level receipt. Clicking a submit button
  // is not evidence of delivery to a server or of an assistant response.
  function userMessageCount() {
    return [...document.querySelectorAll('[data-message-author-role="user"]')]
      .filter(node => (node.textContent || '').includes('AVANZA AL OBJETIVO'))
      .length;
  }

  async function checkVisibleSubmission(before, timeoutMs = 1700) {
    const deadline = Date.now() + timeoutMs;
    do {
      if (userMessageCount() > before) return true;
      await new Promise(resolve => setTimeout(resolve, 170));
    } while (Date.now() < deadline);
    return userMessageCount() > before;
  }

  async function advance() {
    if (sending) return;
    if (Date.now() - lastSubmitAt < SUBMIT_DEDUP_MS) {
      status('Envío reciente: revisa el chat antes de repetir.', true);
      return;
    }
    if (generationInProgress()) {
      status('La respuesta sigue generándose. Usa AVANZA cuando termine.', true);
      return;
    }
    const composer = findComposer();
    if (!composer) {
      status('No encuentro el cuadro de mensaje. Abre una conversación.', true);
      return;
    }
    if (existingDraft(composer)) {
      status('Hay un borrador: no lo sobrescribí ni lo envié.', true);
      return;
    }
    sending = true;
    try {
      if (!updateComposer(composer, MACRO)) {
        status('No pude insertar la macro; no envié nada.', true);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 230));
      const send = findSend(composer);
      if (send && !generationInProgress()) {
        const before = userMessageCount();
        lastSubmitAt = Date.now();
        send.click();
        const visibleReceipt = await checkVisibleSubmission(before);
        status(visibleReceipt
          ? 'La macro aparece en el chat. El resultado aún requiere verificación.'
          : 'Se pulsó Enviar, pero NO se confirmó el mensaje. Revísalo antes de repetir.',
          !visibleReceipt);
      } else {
        status('Macro insertada: pulsa Enviar. No se confirmó el envío automático.', true);
      }
    } catch {
      status('No se completó la acción; revisa el cuadro antes de reenviar.', true);
    } finally {
      sending = false;
    }
  }

  function mount() {
    if (document.getElementById(ROOT_ID)) return;
    if (!document.body) return;
    const host = document.createElement('div');
    host.id = ROOT_ID;
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Control AVANZA de ChatGPT');
    host.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom, 0px) + 92px);right:12px;z-index:2147483646;display:flex;flex-direction:column;align-items:flex-end;gap:7px;max-width:min(85vw,340px);font-family:system-ui,-apple-system,sans-serif;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'avanza-one-tap-button';
    btn.textContent = '▶ AVANZAR AL OBJETIVO';
    btn.title = 'Recuperar contexto, evaluar opciones, ejecutar lo autorizado, verificar y reportar porcentaje';
    btn.setAttribute('aria-label', 'Avanzar al objetivo en esta conversación');
    btn.style.cssText = 'background:#facc15;color:#1f2937;border:2px solid #202020;border-radius:999px;padding:12px 16px;min-height:46px;box-shadow:0 4px 18px #0007;font-size:13px;font-weight:800;cursor:pointer;line-height:1.3;touch-action:manipulation;';
    btn.addEventListener('click', advance);
    const notice = document.createElement('div');
    notice.id = STATUS_ID;
    notice.setAttribute('role','status');
    notice.setAttribute('aria-live', 'polite');
    notice.style.cssText = 'font-size:11px;background:#111827;color:#bbf7d0;padding:5px 10px;border-radius:10px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:300px;text-align:right;';
    host.append(btn, notice);
    document.body.append(host);
  }

  mount();
  // Some ChatGPT page transitions replace portions of the DOM without a full reload.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled || document.getElementById(ROOT_ID)) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; mount(); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || !event.altKey || !event.shiftKey || event.key.toLowerCase() !== 'a') return;
    event.preventDefault();
    advance();
  });
})();
