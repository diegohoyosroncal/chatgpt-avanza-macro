import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const script = readFileSync(new URL('../avanza_macro_maestro_v4.user.js', import.meta.url), 'utf8');
const executablePath = process.env.CHROME_PATH;
assert.ok(executablePath, 'CHROME_PATH required: use an installed Chromium/Chrome');
const browser = await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.setContent('<html><body style="min-height:4000px"><h1>Chat de prueba aislado</h1><div id="prompt-textarea" contenteditable="true"></div><button data-testid="send-button">Enviar</button></body></html>');
  await page.addScriptTag({content:script});
  await page.waitForFunction(() => {
    const host=document.getElementById('avanza-macro-maestro-v4');
    return host?.shadowRoot?.querySelector('[data-value="health"]');
  });
  const getHealth=()=>page.evaluate(()=>document.getElementById('avanza-macro-maestro-v4').shadowRoot.querySelector('[data-value="health"]').textContent);
  assert.match(await getHealth(),/v4\.0\.3 instalada/);
  assert.match(await getHealth(),/remota NO verificada/);
  const rectBefore=await page.evaluate(()=>document.getElementById('avanza-macro-maestro-v4').getBoundingClientRect().top);
  await page.evaluate(()=>scrollTo(0,2100));
  await page.waitForTimeout(100);
  const rectAfter=await page.evaluate(()=>document.getElementById('avanza-macro-maestro-v4').getBoundingClientRect().top);
  assert.ok(Math.abs(rectBefore-rectAfter)<1,'floating UI must stay fixed after scroll');
  await page.evaluate(()=>{
    const old=document.createElement('aside');old.id='avanza-universal-control-v1';old.style.display='none';document.body.appendChild(old);
  });
  await page.waitForFunction(()=>document.getElementById('avanza-macro-maestro-v4').shadowRoot.querySelector('[data-value="health"]').textContent.includes('posible duplicado'),{timeout:4000});
  await page.evaluate(()=>document.getElementById('avanza-macro-maestro-v4').shadowRoot.querySelector('[data-action="avanzar"]').click());
  const outcome=await page.evaluate(()=>{
    const root=document.getElementById('avanza-macro-maestro-v4').shadowRoot;
    return {status:root.querySelector('.status').textContent, button:root.querySelector('[data-action="avanzar"]').textContent, warning:root.querySelector('[data-value="health"]').dataset.warning};
  });
  assert.match(outcome.status,/Se bloquea AVANZAR/);
  assert.match(outcome.button,/AVANZAR/);
  assert.equal(outcome.warning,'true');
  await page.evaluate(()=>document.getElementById('avanza-universal-control-v1').remove());
  await page.waitForFunction(()=>document.getElementById('avanza-macro-maestro-v4').shadowRoot.querySelector('[data-value="health"]').dataset.warning==='false');
  await page.close();
  console.log('PASS: Chromium floating panel, local-version badge, hidden legacy collision, guarded activation, recovery');
} finally { await browser.close(); }
