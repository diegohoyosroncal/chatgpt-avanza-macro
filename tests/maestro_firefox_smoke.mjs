import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {firefox} from 'playwright-core';

const script=readFileSync(new URL('../avanza_macro_maestro_v4.user.js',import.meta.url),'utf8');
const server=createServer((req,res)=>{
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  const owner = req.url.includes('different') ? 'CROSS-CHAT-LEARNING' : 'CROSS-CHAT-LEARNING';
  res.end(`<!doctype html><html><head><title>AVANZA isolated Firefox QA</title></head>
  <body><div data-message-author-role="user">Continuar contexto</div>
  <div data-message-author-role="assistant">🧩 PROCESO ${owner} | 📈 AVANCE 60%→60% | 3/5 gates | Δ 0 pp</div>
  <form><textarea id="prompt-textarea"></textarea>
  <button type="button" data-testid="send-button" onclick="window.__sendCount++">Enviar</button></form>
  <script>window.__sendCount=0;window.__intervals=0;
  const nativeInterval=window.setInterval;
  window.setInterval=function(...args){window.__intervals++;return nativeInterval.apply(this,args);};</script>
  </body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const browser=await firefox.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const url=(id)=>`http://127.0.0.1:${port}/c/${id}`;
async function inject(){
  await page.addScriptTag({content:script});
  await page.locator('#avanza-macro-maestro-v4').waitFor({timeout:10000});
}
async function stored(){
  return page.evaluate(()=>{
    const key='avanza-v4-meta:'+location.hostname+location.pathname;
    const raw=localStorage.getItem(key);
    return raw?JSON.parse(raw):null;
  });
}
try {
  await page.goto(url('knownchatabcdefgh'));
  await inject();
  await page.waitForTimeout(1000);
  const first=await stored();
  assert.equal(first?.processId,'CROSS-CHAT-LEARNING','recover canonical owner in real Firefox JS engine');
  assert.equal(first?.autoConsented,false,'unknown Firefox session must not opt itself into AUTO');
  const before=await page.evaluate(()=>({count:document.querySelectorAll('#avanza-macro-maestro-v4').length,
    version:document.documentElement.getAttribute('data-avanza-client-version'),
    intervals:window.__intervals}));
  assert.equal(before.count,1);
  assert.equal(before.version,'4.9.2-identity-once-pr30');
  await page.addScriptTag({content:script});
  const after=await page.evaluate(()=>({count:document.querySelectorAll('#avanza-macro-maestro-v4').length,
    version:document.documentElement.getAttribute('data-avanza-client-version'),
    intervals:window.__intervals}));
  assert.deepEqual(after,before,'second injection must not create another runner, UI or timer');
  assert.equal(await page.evaluate(()=>window.__sendCount),0,'AUTO must stay off');
  console.log('firefox first chat: identity, MANUAL and duplicate-injection PASS');
  await page.reload();
  await inject();
  await page.waitForTimeout(1000);
  const restored=await stored();
  assert.equal(restored?.processId,'CROSS-CHAT-LEARNING','same chat must preserve owner across reload');
  assert.equal(restored?.autoConsented,false);
  console.log('firefox reload: persisted identity and MANUAL PASS');
  await page.goto(url('differentchatxyzabcdefgh'));
  await inject();
  await page.waitForTimeout(1000);
  const second=await stored();
  assert.equal(second?.processId,'CROSS-CHAT-LEARNING','new chat must recover own visible canonical label');
  assert.equal(second?.autoConsented,false,'new chat must not inherit AUTO');
  assert.equal(await page.evaluate(()=>window.__sendCount),0);
  console.log('firefox second chat: canonical recovery and zero sends PASS');
} finally {
  await page.close();
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
