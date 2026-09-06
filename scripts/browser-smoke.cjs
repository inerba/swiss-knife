const { chromium } = require(process.env.SWISS_NODE_MODULES + '/playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const http = require('node:http');
const ts = require('typescript');

(async () => {
  const extension = path.resolve('.output/chrome-mv3');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'swiss-knife-test-'));
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/child') res.end('<iframe title="Nested" src="/leaf"></iframe>');
    else if (req.url === '/leaf') res.end('<p>Leaf</p>');
    else res.end(`<iframe title="Parent" src="/child"></iframe><iframe title="Cross origin" src="http://localhost:${server.address().port}/child"></iframe><iframe srcdoc="inline"></iframe><div id="shadow"></div><script>document.querySelector('#shadow').attachShadow({mode:'open'}).innerHTML='<iframe title="Shadow" src="/leaf"></iframe>'</script>`);
  });
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`chrome-extension://${id}/sidepanel.html`);
    await page.getByRole('heading', { name: 'I tuoi strumenti' }).waitFor();
    await page.getByLabel('Cerca uno strumento').fill('inesistente');
    await page.getByRole('status').filter({ hasText: 'Nessuno strumento' }).waitFor();
    await page.getByLabel('Cerca uno strumento').fill('');
    await page.screenshot({ path: '.output/panel-light.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: '.output/panel-dark.png', fullPage: true });
    await page.getByRole('button', { name: /Elenca iframe/ }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Elenca iframe' }).first().waitFor();
    await page.getByRole('status').filter({ hasText: /protetta|Accesso non disponibile/ }).waitFor();
    await page.getByRole('button', { name: 'Tutti gli strumenti' }).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tool-iframes');
    const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'sidePanel', 'downloads'].sort());
    assert.deepEqual([...manifest.optional_host_permissions].sort(), ['http://*/*', 'https://*/*']);
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.content_scripts, undefined);
    const fixture = await context.newPage();
    await fixture.goto(`http://127.0.0.1:${server.address().port}/`);
    const output = ts.transpileModule(fs.readFileSync('src/tools/iframes/scan.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    new Function('exports', output)(exports);
    const scanned = await fixture.evaluate(exports.scanIframes);
    assert.equal(scanned.frames.length, 5);
    assert.equal(scanned.frames.find(f => f.title === 'Nested').depth, 1);
    assert.equal(scanned.frames.find(f => f.title === 'Cross origin').inaccessible, true);
    assert.equal(scanned.inaccessibleCount, 1);
    assert.ok(scanned.frames.find(f => f.reason?.includes('srcdoc')));
    console.log('Browser smoke passed: real extension load, catalog/search, keyboard, 320px layout, themes, protected-page error, focus return, minimal manifest.');
    console.log('Real browser scanner passed: nested same-origin, cross-origin boundary, srcdoc and shadow DOM.');
  } finally { await context.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
