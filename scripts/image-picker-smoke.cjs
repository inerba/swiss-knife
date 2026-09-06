const { chromium } = require(process.env.SWISS_NODE_MODULES + '/playwright');
const sharp = require(process.env.SWISS_NODE_MODULES + '/sharp');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

(async () => {
  const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#4a80b5' } }).png().toBuffer();
  const overlay = await sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.1 } } }).png().toBuffer();
  const server = http.createServer((req, res) => {
    if (/\.png/.test(req.url)) { res.setHeader('Content-Type', 'image/png'); res.end(req.url.includes('overlay') ? overlay : photo); return; }
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/frame') { res.end('<img src="/frame.png" style="width:100px;height:100px">'); return; }
    res.end(`<!doctype html><style>body{margin:0}.stack{position:relative;width:400px;height:300px;background-image:url('/background.png')} .stack img{position:absolute;inset:0;width:400px;height:300px} .stack::before{content:'';position:absolute;inset:0;background-image:url('/pseudo.png')} #shadow{display:block;width:100px;height:100px} iframe{width:120px;height:120px}</style>
      <a class="stack" style="display:block" href="#clicked"><img src="/photo.png"><img src="/overlay.png" style="pointer-events:none"></a>
      <div id="shadow"></div><iframe src="/frame"></iframe><iframe src="http://localhost:${server.address().port}/frame"></iframe>
      <script>window.clicks=0;document.querySelector('a').addEventListener('click',()=>window.clicks++);document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<img src="/shadow.png" style="width:100px;height:100px">';</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swiss-images-'));
  const extension = path.join(testDir, 'extension');
  fs.cpSync(path.resolve('.output/chrome-mv3'), extension, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
  assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'downloads', 'scripting', 'sidePanel'].sort());
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  // A test-only copy preauthorizes the local fixture. Production build is untouched.
  // Native activeTab and optional permission prompts still require manual testing.
  manifest.host_permissions = [origin + '/*'];
  fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(testDir, 'profile'), {
      channel: 'chromium', headless: true, acceptDownloads: true, downloadsPath: path.join(testDir, 'downloads'),
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const fixture = await context.newPage();
    await fixture.goto(origin); await fixture.waitForLoadState('networkidle');
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${id}/sidepanel.html`);
    await panel.evaluate(async origin => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(t => t.url?.startsWith(origin));
      window.fixtureId = tab.id;
      const [injection] = await chrome.scripting.executeScript({target:{tabId:tab.id},files:['media-picker.js']});
      window.results = [];
      window.pickerPort = chrome.tabs.connect(tab.id,{documentId:injection.documentId,name:'swiss-media-picker:smoke'});
      window.pickerPort.onMessage.addListener(message => window.results.push(message));
    }, origin);
    await panel.waitForFunction(() => window.results.some(m => m.type === 'ready'));
    await fixture.mouse.move(100, 100); await fixture.mouse.click(100, 100);
    await panel.waitForFunction(() => window.results.some(m => m.type === 'selection'));
    const selection = await panel.evaluate(() => window.results.find(m => m.type === 'selection').result);
    assert.deepEqual(selection.images.map(i => new URL(i.url).pathname).sort(), ['/background.png', '/overlay.png', '/photo.png', '/pseudo.png']);
    assert.equal(await fixture.evaluate(() => window.clicks), 0);
    assert.equal(await fixture.locator('[data-swiss-picker]').count(), 0);
    // Real downloads API: test originals independently without native Save As dialog.
    const downloaded = await panel.evaluate(async images => {
      const ids = [];
      for (const image of images.filter(i => /\/(photo|overlay)\.png$/.test(i.url))) ids.push(await chrome.downloads.download({url:image.url,filename:`swiss-smoke-${image.id}.png`,saveAs:false}));
      return ids;
    }, selection.images);
    await panel.waitForFunction(async ids => (await Promise.all(ids.map(id => chrome.downloads.search({id})))).every(items => items[0]?.state === 'complete'), downloaded);
    const sizes = await panel.evaluate(async ids => (await Promise.all(ids.map(id => chrome.downloads.search({id})))).map(items => items[0].fileSize), downloaded);
    assert.deepEqual(sizes.sort((a,b)=>a-b), [photo.length, overlay.length].sort((a,b)=>a-b));
    await panel.evaluate(() => window.pickerPort.disconnect());
    async function restart() {
      await panel.evaluate(async () => {
        const [injection] = await chrome.scripting.executeScript({target:{tabId:window.fixtureId},files:['media-picker.js']});
        window.results=[];window.pickerPort=chrome.tabs.connect(window.fixtureId,{documentId:injection.documentId,name:'swiss-media-picker:smoke'});
        window.pickerPort.onMessage.addListener(message=>window.results.push(message));
      });
      await panel.waitForFunction(() => window.results.some(m => m.type === 'ready'));
    }
    await restart(); await fixture.mouse.move(100,100); await fixture.keyboard.press('Escape');
    await panel.waitForFunction(() => window.results.some(m => m.type === 'cancelled'));
    assert.equal(await fixture.locator('[data-swiss-picker]').count(), 0);
    await panel.evaluate(() => window.pickerPort.disconnect());
    await restart(); await panel.evaluate(() => window.pickerPort.disconnect());
    await fixture.waitForFunction(() => !document.querySelector('[data-swiss-picker]'));
    await fixture.mouse.click(100,100); assert.equal(await fixture.evaluate(() => window.clicks), 1);
    console.log('PASS: shipped isolated script, real port, four image layers including transparent pointer-events:none PNG, prevented click, separate original downloads with exact sizes, Esc and disconnect cleanup.');
  } finally { await context?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
