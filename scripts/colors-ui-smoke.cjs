const { chromium } = require(process.env.SWISS_NODE_MODULES + '/playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const extension = path.resolve('.output/chrome-mv3');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'swiss-colors-qa-'));
  const output = path.resolve('.output/colors-qa'); fs.mkdirSync(output, { recursive: true });
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const failures = [];
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    page.on('pageerror', error => failures.push(String(error)));
    await page.setViewportSize({ width: 380, height: 900 });
    await page.goto(`chrome-extension://${id}/sidepanel.html`);
    await page.getByRole('button', { name: /Colori Cattura/ }).click();
    await page.getByRole('heading', { name: 'La tua palette inizia qui' }).waitFor();
    const tool = page.getByRole('region', { name: 'Strumento colori' });
    await tool.screenshot({ path: path.join(output, 'empty-light.png') });
    assert.equal(await tool.getByRole('textbox', { name: 'Anteprima esportazione' }).count(), 0);
    await page.getByRole('button', { name: 'Salva colore', exact: true }).click();
    await page.getByText('Salvato nella cronologia.', { exact: true }).waitFor();
    await page.getByLabel('Codice colore', { exact: true }).fill('not-a-color');
    await page.getByRole('button', { name: 'Salva colore', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Colore non valido' }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'colors-code');
    await page.getByLabel('Codice colore', { exact: true }).fill('#e8523580');
    await page.getByRole('button', { name: 'Salva colore', exact: true }).click();
    await page.getByText('Salvato nella cronologia.', { exact: true }).waitFor();
    await page.getByLabel('Seleziona #e8523580', { exact: true }).check();
    await page.getByRole('heading', { name: 'Copia la selezione' }).waitFor();
    await page.getByText('Anteprima del testo', { exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Anteprima esportazione' }).inputValue(), '#e8523580');
    await page.getByLabel('Esporta come', { exact: true }).selectOption('tailwind');
    await page.getByLabel('Usa il Tailwind più vicino', { exact: true }).check();
    assert.match(await page.getByRole('textbox', { name: 'Anteprima esportazione' }).inputValue(), /\/\[/);
    await page.getByRole('button', { name: 'Copia 1 colore', exact: true }).click();
    await page.getByText('Selezione copiata.', { exact: true }).waitFor();
    await page.getByRole('tab', { name: /Cronologia/ }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Pagina', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('tab', { name: 'Tailwind', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#colors-panel-tailwind input[type="checkbox"]').count(), 0);
    await page.getByLabel('Cerca in tutte', { exact: true }).fill('purple-500');
    await page.getByRole('button', { name: 'Modifica purple-500', exact: true }).click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'colors-code');
    await page.getByLabel('Cerca in tutte', { exact: true }).fill('');
    await page.getByLabel('Famiglia', { exact: true }).selectOption('blue');
    for (const width of [320, 380, 480]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: theme });
        await tool.screenshot({ path: path.join(output, `tailwind-${width}-${theme}.png`) });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}/${theme}`);
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.getByRole('tab', { name: /Cronologia/ }).click();
    await page.getByRole('button', { name: 'Deseleziona', exact: true }).click();
    await tool.screenshot({ path: path.join(output, 'history-320-light.png') });
    await page.reload();
    await page.getByRole('button', { name: /Colori Cattura/ }).click();
    await page.getByLabel('Seleziona #e8523580', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Svuota', exact: true }).click();
    await page.getByRole('heading', { name: 'La tua palette inizia qui' }).waitFor();
    await page.getByRole('button', { name: /Da elemento/ }).click();
    await page.getByRole('alert').filter({ hasText: /protetta|supportata/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Da elemento/ }).isEnabled(), true);
    assert.deepEqual(failures, []);
    console.log('Colors UI passed: real extension page, local storage/reload/clear, validation, alpha export/clipboard, separated selection, keyboard tabs, family/search, focus return, 320/380/480px light/dark, protected-page recovery.');
    console.log('Screenshots: ' + output);
    console.log('Native side-panel surface and native EyeDropper dialog were not automated by this headless check.');
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
