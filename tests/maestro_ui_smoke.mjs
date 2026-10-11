import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

const script = readFileSync(new URL('../avanza_macro_maestro_v4.user.js', import.meta.url), 'utf8');
const browserPath = process.env.CHROME_PATH;
assert.ok(browserPath, 'CHROME_PATH must point to a locally installed Chrome/Chromium');
const browser = await chromium.launch({executablePath: browserPath, headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--no-first-run']});
const hostId = 'avanza-macro-maestro-v4';
const getHost = () => document.getElementById('avanza-macro-maestro-v4');
const results = [];
try {
  for (const size of [{width:1280,height:800},{width:390,height:844}]) {
    const page = await browser.newPage({viewport:size});
    await page.setContent(`<!doctype html><html><body style="min-height:4000px;background:#141b2b">
      <form style="position:fixed;bottom:0"><textarea id="prompt-textarea"></textarea>
      <button type="button" data-testid="send-button">Enviar</button></form></body></html>`);
    await page.addScriptTag({content:script});
    const host = page.locator('#'+hostId);
    await host.waitFor({timeout:7000});
    const dock = host.locator('.panel');
    const localVersion = await host.locator('[data-value="health"]').innerText();
    assert.match(localVersion,/4\.4\.0-neon-control/);
    assert.match(localVersion,/remota NO verificada/);
    assert.equal(await host.locator('[data-module]').count(),6);
    assert.match(await host.locator('[data-module="auto"]').innerText(),/AUTO ON/);
    assert.match(await host.locator('[data-module="game"]').innerText(),/QUEST ON/);
    assert.match(await host.locator('[data-module="aura"]').innerText(),/AURA ON/);
    await page.evaluate(() => {
      const a=document.createElement('div'); a.setAttribute('data-message-author-role','assistant');
      a.innerText='🧩 PROCESO CFI-E2-2026-10-16 | 📈 AVANCE 15.8%→15.8% | 3/19 | Δ 0 pp\n🎮 QUEST | CFI | M40-4 | ⭐100 XP | ⚔️2/5 | Modelo del costo\n🎲 QUEST_CHOICES | M40-4 | A=S/30,000 | B=S/90,000 | C=S/1,350,000 | D=No se deprecia';
      document.body.append(a);
    });
    await page.waitForFunction(() => {
      const h=document.getElementById('avanza-macro-maestro-v4')?.shadowRoot;
      return h?.querySelector('[data-value="game"]')?.textContent?.includes('M40-4');
    },{timeout:5000});
    assert.match(await host.locator('[data-value="game"]').innerText(),/M40-4/);
    assert.match(await host.locator('[data-value="game"]').innerText(),/100 XP/);
    assert.equal(await dock.locator('[data-learn-action]').count(),5);
    assert.match(await host.locator('[data-value="progress-ribbon"]').innerText(),/CFI/);
    assert.match(await host.locator('[data-value="progress-ribbon"]').innerText(),/15,8%|15\.8%/);
    assert.equal(await host.locator('[data-quest-choice]').count(),4);
    assert.equal(await dock.locator('[data-learn-answer]').count(),1);
    await host.locator('[data-quest-choice="A"]').click();
    assert.match(await page.locator('#prompt-textarea').inputValue(),/LEARN_ANSWER/);
    await page.locator('#prompt-textarea').fill('');
    await host.locator('[data-action="cinema"]').click();
    const missionControl=host.locator('.mc-overlay');
    await missionControl.waitFor({state:'visible',timeout:3000});
    assert.match(await missionControl.innerText(),/MISSION CONTROL/);
    assert.match(await missionControl.innerText(),/COCKPIT/);
    assert.match(await missionControl.innerText(),/CFI/);
    assert.match(await missionControl.innerText(),/BOSS BATTLE/);
    assert.equal(await missionControl.locator('[data-quest-choice]').count(),4);
    await missionControl.locator('[data-action="cinema-close"]').click();
    assert.equal(await missionControl.isHidden(),true);
    await host.locator('[data-module="aura"]').click();
    assert.match(await host.locator('[data-module="aura"]').innerText(),/AURA OFF/);
    await host.locator('[data-module="aura"]').click();
    await page.evaluate(() => { const h=document.getElementById('avanza-macro-maestro-v4'); h.style.left='5000px'; h.style.top='5000px'; h.style.right='auto'; h.style.bottom='auto'; });
    await page.waitForTimeout(1100);
    const rescued = await host.boundingBox();
    assert.ok(rescued.x < size.width && rescued.y < size.height, 'HUD rescue must restore an offscreen panel');
    const before = await host.boundingBox();
    await page.evaluate(() => scrollTo(0,2100));
    await page.waitForTimeout(950);
    const after = await host.boundingBox();
    assert.ok(Math.abs(before.y-after.y)<2, 'dock must remain fixed after scroll');
    await host.locator('[data-action="theme"]').click();
    assert.equal(await host.getAttribute('data-theme'),'ocean');
    await host.locator('[data-action="collapse"]').click();
    assert.match(await dock.getAttribute('class'),/compact/);
    await host.locator('[data-action="collapse"]').click();
    assert.doesNotMatch(await dock.getAttribute('class'),/compact/);
    const top = host.locator('.brand');
    const start = await host.boundingBox();
    const rect = await top.boundingBox();
    await page.mouse.move(rect.x+Math.min(20,rect.width/2),rect.y+rect.height/2);
    await page.mouse.down();
    await page.mouse.move(rect.x+65,rect.y+60,{steps:5});
    await page.mouse.up();
    const moved = await host.boundingBox();
    assert.ok(Math.abs(moved.x-start.x)>8 || Math.abs(moved.y-start.y)>8,'HUD must be draggable');
    await page.evaluate(() => {const e=document.createElement('aside');e.id='diego-mision-autonomia-v1';e.style.display='none';document.body.append(e);});
    await page.waitForFunction(() => {
      const h=document.getElementById('avanza-macro-maestro-v4')?.shadowRoot;
      return h?.querySelector('[data-value="health"]')?.dataset.warning === 'true';
    },{timeout:5000});
    assert.equal(await host.locator('[data-action="avanzar"]').isDisabled(),true);
    await page.evaluate(() => document.getElementById('diego-mision-autonomia-v1').remove());
    await page.waitForFunction(() => {
      const h=document.getElementById('avanza-macro-maestro-v4')?.shadowRoot;
      return h?.querySelector('[data-value="health"]')?.dataset.warning === 'false';
    },{timeout:5000});
    assert.equal(await host.locator('[data-action="avanzar"]').isEnabled(),true);
    results.push(size.width+'x'+size.height+': mission-control/ribbon/interactive/rescue/fixed/drag/theme/compact/version/conflict PASS');
    await page.close();
  }
  console.log(results.join('\n'));
} finally { await browser.close(); }
