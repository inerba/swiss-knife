# Browser context — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere lo strumento «Browser context», che seleziona un elemento della pagina (blocca + conferma) e produce un report Markdown in inglese con markup, CSS rilevante e screenshot, copiato negli appunti e scaricabile.

**Architecture:** Il picker di `inspect-save` diventa generico: riceve dall’esterno la funzione che costruisce il payload, e la logica dell’host nella pagina e della sessione nel pannello viene estratta in `picker-host.ts` e `picker-session.ts`, con Ispeziona e salva ridotto a un wrapper dal comportamento invariato. Il nuovo modulo `src/tools/browser-context/` aggiunge la raccolta CSS nella pagina (scansione dei fogli, corrispondenze, valori calcolati), il formatter Markdown puro, i download e la UI del pannello. Un nuovo entrypoint `entrypoints/browser-context.ts` collega picker e raccolta.

**Tech Stack:** WXT 0.21, Chrome MV3, React 19, TypeScript, Vitest 3 + jsdom 26, Lucide (`Crosshair`, `MousePointerClick`, `Copy`, `Image`, `Download`, `Expand`, `ArrowUp`, `ArrowDown`, `Check`, `X`), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-16-browser-context-design.md`

## Global Constraints

- Testi dell’interfaccia in italiano; report Markdown in inglese, con le intestazioni esatte della spec.
- Catalogo: `id: 'browser-context'`, nome `Browser context`, descrizione `Seleziona un elemento e copia HTML e CSS pronti per un agente AI.`, icona `Crosshair`, ultima voce dell’array `tools`.
- Icone solo da `lucide-react`. Nessuna nuova dipendenza npm, nessun nuovo permesso, nessuna richiesta di rete, nessuna archiviazione di dati della pagina.
- Il comportamento visibile di Ispeziona e salva non cambia; i suoi test esistenti devono passare senza modifiche.
- Limiti: 40 regole corrispondenti, 15 altri breakpoint, 12 ereditate, 20 per stato e per pseudo-elemento, 40 variabili, 200 valori calcolati, markup tagliato a 60 000 caratteri.
- Download in `swiss-knife/browser-context/` con `saveAs: false` e `conflictAction: 'uniquify'`.
- Uno screenshot fallito non blocca il report.
- Ogni file iniettato è un entrypoint incluso nella build (niente codice remoto). Stili solo con i token di `src/style.css`, niente `color: inherit` sui controlli.
- Non modificare `.output`, `.wxt` o `node_modules`.
- Comandi di verifica: `pnpm compile`, `pnpm test`, `pnpm build`.

## Note sull’ambiente di test (verificate)

- jsdom 26 analizza `@media` (type 4), `@supports` (type 12), `@layer` e `@container`; `rule.style.cssText` conserva `var()` e le shorthand (`"padding: 24px; border-radius: var(--radius);"`).
- In jsdom `sheet.ownerNode` e `sheet.href` sono `undefined`, `window.matchMedia` e `CSS` non esistono, `getComputedStyle(el, '::before')` non è implementato, `Element.prototype.scrollIntoView` non esiste, `Blob.prototype.text` non esiste, `ClipboardItem` non esiste. I test usano oggetti finti o stub per questi casi.
- `(3750).toLocaleString('it-IT')` restituisce `3750`; `(15000).toLocaleString('it-IT')` restituisce `15.000`.
- `src/tools/inspect-save/picker.ts` ha righe vuote doppie tra le istruzioni: leggi il file prima di ogni modifica e copia il testo esatto.

---

## Struttura dei file

Crea:

- `src/tools/inspect-save/picker-host.ts` — host generico nella pagina: port, comandi, isolamento, pulizia.
- `src/tools/inspect-save/picker-host.test.ts`
- `src/tools/inspect-save/picker-session.ts` — sessione generica nel pannello: iniezione, port, cattura PNG obbligatoria o facoltativa.
- `src/tools/inspect-save/picker-session.test.ts`
- `src/tools/browser-context/types.ts` — tipi del payload e del risultato.
- `src/tools/browser-context/test-fixtures.ts` — `samplePayload()` condiviso dai test.
- `src/tools/browser-context/path.ts` + `path.test.ts` — segmento di selettore e percorso DOM.
- `src/tools/browser-context/markup.ts` + `markup.test.ts` — pulizia e taglio del markup.
- `src/tools/browser-context/css-rules.ts` + `css-rules.test.ts` — dichiarazioni, filtro rumore, origine, scansione dei fogli con at-rule.
- `src/tools/browser-context/css-match.ts` + `css-match.test.ts` — regole corrispondenti, breakpoint, stati, pseudo-elementi, ereditarietà, variabili.
- `src/tools/browser-context/resolved.ts` + `resolved.test.ts` — valori calcolati diversi dal default.
- `src/tools/browser-context/report.ts` + `report.test.ts` — formatter Markdown, nome, timestamp, statistiche.
- `src/tools/browser-context/collect.ts` + `collect.test.ts` — `buildContextPayload` eseguito nella pagina.
- `src/tools/browser-context/session.ts` + `session.test.ts` — sessione dello strumento.
- `src/tools/browser-context/download.ts` + `download.test.ts` — download PNG e `.md`.
- `src/tools/browser-context/BrowserContextTool.tsx` + `BrowserContextTool.test.tsx`
- `src/tools/browser-context/browser-context.css` + `browser-context.css.test.ts`
- `entrypoints/browser-context.ts`

Modifica:

- `src/tools/inspect-save/picker.ts` — `installInspectPicker<T>(buildPayload, …)`, `inspectSnapshotPayload` esportata.
- `src/tools/inspect-save/session.ts` — wrapper su `startPickerSession`.
- `entrypoints/inspect-save.ts` — usa `runPickerHost`.
- `src/tools/registry.ts` — nuova voce in fondo.
- `src/App.test.tsx` — ordine predefinito del catalogo.
- `README.md`, `AGENTS.md`, `PRIVACY.md`, `public/THIRD-PARTY-NOTICES.txt`.

Rispetto alla tabella della spec, la raccolta CSS è divisa in `css-rules.ts` (scansione) e `css-match.ts` (corrispondenze), e il calcolo del selettore sta in `path.ts`: file più piccoli, stessa responsabilità complessiva.

---

### Task 1: Picker generico e host condiviso nella pagina

**Files:**
- Modify: `src/tools/inspect-save/picker.ts` (funzione `snapshotPayload`, firma di `installInspectPicker`, corpo di `choose`)
- Create: `src/tools/inspect-save/picker-host.ts`
- Create: `src/tools/inspect-save/picker-host.test.ts`
- Modify: `entrypoints/inspect-save.ts` (sostituzione completa)

**Interfaces:**
- Consumes: `applyCaptureIsolation(element: Element): () => void` e `waitForPaintFrames(): Promise<void>` da `./isolate-capture`; `PickerCommand`, `LockedPreview` da `./types`.
- Produces:
  - `export function inspectSnapshotPayload(element: Element, view: Window): SnapshotPayload` (in `picker.ts`)
  - `export function installInspectPicker<T>(buildPayload: (element: Element, view: Window) => T, onPick: (payload: T, element: Element) => void, onCancel: () => void, onLock: (preview: LockedPreview) => void): InspectPickerControl`
  - `export interface PickerHostOptions<T> { portPrefix: string; scopeKey: string; buildPayload: (element: Element, view: Window) => T }`
  - `export function parsePickerSession(name: string, portPrefix: string): string | null`
  - `export function isPickerCommand(value: unknown): value is PickerCommand`
  - `export function runPickerHost<T>(options: PickerHostOptions<T>): void`
  - Messaggi inviati al pannello: `{ type: 'ready' | 'locked' | 'cancelled' | 'snapshot' | 'error' | 'isolated' | 'restored', session, … }`; in caso di eccezione del builder `{ type: 'error', error: "Impossibile leggere l'elemento: <messaggio>" }`.

- [ ] **Step 1: Scrivi il test dell’host**

Crea `src/tools/inspect-save/picker-host.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import type { Browser } from 'wxt/browser';

const api = vi.hoisted(() => ({
  runtime: { id: 'ext-id', onConnect: { addListener: vi.fn(), removeListener: vi.fn() } },
}));
vi.mock('wxt/browser', () => ({ browser: api }));

const picker = vi.hoisted(() => ({ install: vi.fn() }));
vi.mock('./picker', () => ({ installInspectPicker: picker.install }));
vi.mock('./isolate-capture', () => ({
  applyCaptureIsolation: vi.fn(() => vi.fn()),
  waitForPaintFrames: vi.fn(async () => undefined),
}));

import { parsePickerSession, runPickerHost } from './picker-host';

let scopeCounter = 0;

function fakePort(name: string, senderId = 'ext-id') {
  const messageListeners: Array<(message: Record<string, unknown>) => void> = [];
  return {
    name,
    sender: { id: senderId },
    postMessage: vi.fn(),
    onMessage: { addListener: (fn: (message: Record<string, unknown>) => void) => messageListeners.push(fn) },
    onDisconnect: { addListener: vi.fn() },
    emit(message: Record<string, unknown>) { messageListeners.forEach(fn => fn(message)); },
  };
}

function install(buildPayload: (element: Element, view: Window) => unknown) {
  const scopeKey = `__swissTestHost${scopeCounter++}`;
  runPickerHost({ portPrefix: 'swiss-test', scopeKey, buildPayload });
  const connect = api.runtime.onConnect.addListener.mock.calls.at(-1)![0] as (port: Browser.runtime.Port) => void;
  return { scopeKey, connect };
}

beforeEach(() => {
  vi.clearAllMocks();
  picker.install.mockImplementation(() => ({ dispose: vi.fn(), handleCommand: vi.fn() }));
});

it('parses only sessions with the expected prefix', () => {
  expect(parsePickerSession('swiss-test:abc', 'swiss-test')).toBe('abc');
  expect(parsePickerSession('swiss-test:', 'swiss-test')).toBeNull();
  expect(parsePickerSession('swiss-other:abc', 'swiss-test')).toBeNull();
});

it('sends the payload built by the custom builder', () => {
  const buildPayload = vi.fn((_element: Element, _view: Window) => ({ custom: true }));
  const { connect } = install(buildPayload);
  const port = fakePort('swiss-test:s1');
  connect(port as unknown as Browser.runtime.Port);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'ready', session: 's1' });

  const [build, onPick] = picker.install.mock.calls[0]!;
  const element = document.createElement('div');
  onPick(build(element, window), element);

  expect(buildPayload.mock.calls[0]![0]).toBe(element);
  expect(buildPayload.mock.calls[0]![1]).toBe(window);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'snapshot', payload: { custom: true }, session: 's1' });
});

it('reports a builder exception as an error message', () => {
  const { connect } = install(() => { throw new Error('boom'); });
  const port = fakePort('swiss-test:s2');
  connect(port as unknown as Browser.runtime.Port);
  const [build, onPick] = picker.install.mock.calls[0]!;
  const element = document.createElement('div');
  onPick(build(element, window), element);
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'error', error: "Impossibile leggere l'elemento: boom", session: 's2' });
});

it('ignores connections from other senders or prefixes', () => {
  const { connect } = install(() => ({}));
  connect(fakePort('swiss-test:s3', 'someone-else') as unknown as Browser.runtime.Port);
  connect(fakePort('swiss-other:s3') as unknown as Browser.runtime.Port);
  expect(picker.install).not.toHaveBeenCalled();
});

it('installs only once per scope key until disposed', () => {
  const { scopeKey } = install(() => ({}));
  runPickerHost({ portPrefix: 'swiss-test', scopeKey, buildPayload: () => ({}) });
  expect(api.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

  const scope = globalThis as unknown as Record<string, unknown>;
  (scope[`${scopeKey}Dispose`] as () => void)();
  expect(api.runtime.onConnect.removeListener).toHaveBeenCalledTimes(1);
  expect(scope[`${scopeKey}Installed`]).toBeUndefined();
});

it('forwards valid commands to the picker', () => {
  const control = { dispose: vi.fn(), handleCommand: vi.fn() };
  picker.install.mockReturnValue(control);
  const { connect } = install(() => ({}));
  const port = fakePort('swiss-test:s4');
  connect(port as unknown as Browser.runtime.Port);
  port.emit({ type: 'command', session: 's4', command: 'navigate-up' });
  port.emit({ type: 'command', session: 's4', command: 'explode' });
  port.emit({ type: 'command', session: 'other', command: 'confirm' });
  expect(control.handleCommand).toHaveBeenCalledTimes(1);
  expect(control.handleCommand).toHaveBeenCalledWith('navigate-up');
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/inspect-save/picker-host.test.ts`
Expected: FAIL, `Failed to resolve import "./picker-host"`.

- [ ] **Step 3: Rendi generico il picker**

In `src/tools/inspect-save/picker.ts`:

1. Sostituisci `function snapshotPayload(element: Element, view: Window): SnapshotPayload {` con `export function inspectSnapshotPayload(element: Element, view: Window): SnapshotPayload {`.
2. Sostituisci l’intestazione di `installInspectPicker` (i parametri sono separati da righe vuote nel file: copia il testo esatto leggendo il file) in modo che diventi:

```ts
export function installInspectPicker<T>(
  buildPayload: (element: Element, view: Window) => T,
  onPick: (payload: T, element: Element) => void,
  onCancel: () => void,
  onLock: (preview: LockedPreview) => void,
): InspectPickerControl {
```

3. In `choose`, sostituisci `const payload = snapshotPayload(element, win);` con `const payload = buildPayload(element, win);`.

Nessun’altra modifica a `picker.ts`.

- [ ] **Step 4: Crea l’host**

Crea `src/tools/inspect-save/picker-host.ts`:

```ts
import { browser, type Browser } from 'wxt/browser';
import { applyCaptureIsolation, waitForPaintFrames } from './isolate-capture';
import { installInspectPicker, type InspectPickerControl } from './picker';
import type { PickerCommand } from './types';

export interface PickerHostOptions<T> {
  portPrefix: string;
  scopeKey: string;
  buildPayload: (element: Element, view: Window) => T;
}

type BuildOutcome<T> = { ok: true; payload: T } | { ok: false; error: string };

export function parsePickerSession(name: string, portPrefix: string) {
  const prefix = `${portPrefix}:`;
  return name.startsWith(prefix) && name.length > prefix.length ? name.slice(prefix.length) : null;
}

export function isPickerCommand(value: unknown): value is PickerCommand {
  return value === 'navigate-up' || value === 'navigate-down' || value === 'confirm' || value === 'cancel';
}

export function runPickerHost<T>({ portPrefix, scopeKey, buildPayload }: PickerHostOptions<T>) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const installedKey = `${scopeKey}Installed`;
  const disposeKey = `${scopeKey}Dispose`;
  if (scope[installedKey]) return;
  scope[installedKey] = true;

  let pickerControl: InspectPickerControl | undefined;
  let pickedElement: Element | undefined;
  let restoreIsolation: (() => void) | undefined;

  function build(element: Element, view: Window): BuildOutcome<T> {
    try {
      return { ok: true, payload: buildPayload(element, view) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  function connect(connection: Browser.runtime.Port) {
    const session = parsePickerSession(connection.name, portPrefix);
    if (!session || connection.sender?.id !== browser.runtime.id) return;
    restoreIsolation?.();
    restoreIsolation = undefined;
    pickedElement = undefined;
    pickerControl?.dispose();
    const abort = new AbortController();
    const send = (message: Record<string, unknown>) => {
      if (!abort.signal.aborted) connection.postMessage({ ...message, session });
    };
    connection.onDisconnect.addListener(() => {
      abort.abort();
      restoreIsolation?.();
      restoreIsolation = undefined;
      pickedElement = undefined;
      pickerControl?.dispose();
      pickerControl = undefined;
    });
    connection.onMessage.addListener(message => {
      if (abort.signal.aborted || message?.session !== session) return;
      if (message.type === 'command' && isPickerCommand(message.command)) {
        pickerControl?.handleCommand(message.command);
        return;
      }
      if (message.type === 'isolate-capture') {
        restoreIsolation?.();
        restoreIsolation = pickedElement ? applyCaptureIsolation(pickedElement) : undefined;
        void waitForPaintFrames().then(() => send({ type: 'isolated' }));
        return;
      }
      if (message.type === 'restore-capture') {
        restoreIsolation?.();
        restoreIsolation = undefined;
        send({ type: 'restored' });
      }
    });
    pickerControl = installInspectPicker(
      build,
      (outcome, element) => {
        if (outcome.ok) {
          pickedElement = element;
          send({ type: 'snapshot', payload: outcome.payload });
        } else {
          send({ type: 'error', error: `Impossibile leggere l'elemento: ${outcome.error}` });
        }
      },
      () => send({ type: 'cancelled' }),
      preview => send({ type: 'locked', preview }),
    );
    send({ type: 'ready' });
  }

  function teardown() {
    restoreIsolation?.();
    restoreIsolation = undefined;
    pickedElement = undefined;
    pickerControl?.dispose();
    pickerControl = undefined;
    browser.runtime.onConnect.removeListener(connect);
    window.removeEventListener('pagehide', teardown);
    delete scope[installedKey];
    delete scope[disposeKey];
  }

  browser.runtime.onConnect.addListener(connect);
  window.addEventListener('pagehide', teardown);
  scope[disposeKey] = teardown;
}
```

- [ ] **Step 5: Riduci l’entrypoint di Ispeziona e salva**

Sostituisci l’intero contenuto di `entrypoints/inspect-save.ts` con (le chiavi `__swissInspectInstalled` / `__swissInspectDispose` restano identiche):

```ts
import { inspectSnapshotPayload } from '../src/tools/inspect-save/picker';
import { runPickerHost } from '../src/tools/inspect-save/picker-host';

export default defineUnlistedScript(() => {
  runPickerHost({
    portPrefix: 'swiss-inspect-save',
    scopeKey: '__swissInspect',
    buildPayload: inspectSnapshotPayload,
  });
});
```

- [ ] **Step 6: Esegui i test e la compilazione**

Run: `pnpm exec vitest run src/tools/inspect-save && pnpm compile`
Expected: tutti i test di `inspect-save` PASS (nuovi ed esistenti), `tsc` senza errori.

- [ ] **Step 7: Commit**

```bash
git add src/tools/inspect-save/picker.ts src/tools/inspect-save/picker-host.ts src/tools/inspect-save/picker-host.test.ts entrypoints/inspect-save.ts
git commit -m "refactor: share the inspect picker host with a custom payload builder

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Sessione del picker condivisa nel pannello

**Files:**
- Create: `src/tools/inspect-save/picker-session.ts`
- Create: `src/tools/inspect-save/picker-session.test.ts`
- Modify: `src/tools/inspect-save/session.ts` (sostituzione completa)

**Interfaces:**
- Consumes: `captureElementPng(tabId: number, windowId: number, rect: InspectRect): Promise<ElementCaptureResult>` da `./capture`; `ElementCaptureResult { png: string; clipped: boolean }` da `./element-capture`; messaggi dell’host del Task 1.
- Produces:
  - `export type PickerEndReason = 'cancelled' | 'error' | 'disconnected'`
  - `export interface PickerSessionControl { close(): void; sendCommand(command: PickerCommand): void }`
  - `export interface PickerSessionOptions<T extends { rect: InspectRect }> { tabId: number; windowId: number; file: string; portPrefix: string; toolName: string; screenshot: 'required' | 'optional'; isPayload: (value: unknown) => value is T; signal: AbortSignal; onStatus: (status: string) => void; onResult: (payload: T, capture: ElementCaptureResult | null, captureError?: string) => void; onEnd?: (reason: PickerEndReason) => void; onLocked?: (preview: LockedPreview) => void }`
  - `export function startPickerSession<T extends { rect: InspectRect }>(options: PickerSessionOptions<T>): Promise<PickerSessionControl>`
  - `session.ts` continua a esportare `startInspectSession` con la firma attuale e `type InspectSessionControl` (= `PickerSessionControl`).

- [ ] **Step 1: Scrivi il test della sessione generica**

Crea `src/tools/inspect-save/picker-session.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { captureElementPng } from './capture';
import { startPickerSession } from './picker-session';

const api = vi.hoisted(() => ({
  tabs: { connect: vi.fn() },
  scripting: { executeScript: vi.fn() },
}));
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('./capture', () => ({ captureElementPng: vi.fn() }));

type Emit = (value: Record<string, unknown>) => void;
let emit: Emit = () => {};
let session = '';
let posted: Array<Record<string, unknown>> = [];

const rect = { left: 0, top: 0, width: 10, height: 10, viewportWidth: 100, viewportHeight: 100, scrollX: 0, scrollY: 0 };
const payload = { rect, label: 'x' };
const isPayload = (value: unknown): value is typeof payload =>
  !!value && typeof (value as typeof payload).label === 'string';

beforeEach(() => {
  vi.clearAllMocks();
  posted = [];
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_tabId: number, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    return {
      disconnect: vi.fn(),
      postMessage: (value: Record<string, unknown>) => {
        posted.push(value);
        if (value.type === 'isolate-capture') queueMicrotask(() => emit({ type: 'isolated', session }));
      },
      onMessage: { addListener(fn: Emit) { emit = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
});

async function start(screenshot: 'required' | 'optional') {
  const handlers = { onStatus: vi.fn(), onResult: vi.fn(), onEnd: vi.fn(), onLocked: vi.fn() };
  await startPickerSession({
    tabId: 1,
    windowId: 10,
    file: '/tool.js',
    portPrefix: 'swiss-tool',
    toolName: 'Strumento',
    screenshot,
    isPayload,
    signal: new AbortController().signal,
    ...handlers,
  });
  return handlers;
}

it('injects the given file and connects with the given prefix', async () => {
  await start('required');
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['/tool.js'] });
  expect(api.tabs.connect).toHaveBeenCalledWith(1, expect.objectContaining({
    documentId: 'doc-1',
    name: expect.stringMatching(/^swiss-tool:/),
  }));
});

it('passes the capture to the result handler', async () => {
  vi.mocked(captureElementPng).mockResolvedValueOnce({ png: 'data:image/png;base64,abc', clipped: false });
  const handlers = await start('required');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onResult).toHaveBeenCalledWith(
    payload,
    { png: 'data:image/png;base64,abc', clipped: false },
    undefined,
  ));
  expect(posted).toContainEqual({ type: 'restore-capture', session });
});

it('delivers the payload without png when an optional screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('boom'));
  const handlers = await start('optional');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onResult).toHaveBeenCalledWith(payload, null, 'boom'));
  expect(handlers.onEnd).not.toHaveBeenCalled();
  expect(posted).toContainEqual({ type: 'restore-capture', session });
});

it('ends with an error when a required screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('boom'));
  const handlers = await start('required');
  emit({ type: 'snapshot', session, payload });
  await vi.waitFor(() => expect(handlers.onEnd).toHaveBeenCalledWith('error'));
  expect(handlers.onStatus).toHaveBeenCalledWith('boom');
  expect(handlers.onResult).not.toHaveBeenCalled();
});

it('ignores payloads rejected by the validator', async () => {
  const handlers = await start('optional');
  emit({ type: 'snapshot', session, payload: { rect } });
  await Promise.resolve();
  expect(captureElementPng).not.toHaveBeenCalled();
  expect(handlers.onResult).not.toHaveBeenCalled();
});

it('ends when the page reports an error', async () => {
  const handlers = await start('optional');
  emit({ type: 'error', session, error: "Impossibile leggere l'elemento: boom" });
  expect(handlers.onStatus).toHaveBeenCalledWith("Impossibile leggere l'elemento: boom");
  expect(handlers.onEnd).toHaveBeenCalledWith('error');
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/inspect-save/picker-session.test.ts`
Expected: FAIL, `Failed to resolve import "./picker-session"`.

- [ ] **Step 3: Crea la sessione generica**

Crea `src/tools/inspect-save/picker-session.ts`:

```ts
import { browser, type Browser } from 'wxt/browser';
import { captureElementPng } from './capture';
import type { ElementCaptureResult } from './element-capture';
import type { InspectRect, LockedPreview, PickerCommand } from './types';

export type PickerEndReason = 'cancelled' | 'error' | 'disconnected';

export interface PickerSessionControl {
  close(): void;
  sendCommand(command: PickerCommand): void;
}

export interface PickerSessionOptions<T extends { rect: InspectRect }> {
  tabId: number;
  windowId: number;
  file: string;
  portPrefix: string;
  toolName: string;
  screenshot: 'required' | 'optional';
  isPayload: (value: unknown) => value is T;
  signal: AbortSignal;
  onStatus: (status: string) => void;
  onResult: (payload: T, capture: ElementCaptureResult | null, captureError?: string) => void;
  onEnd?: (reason: PickerEndReason) => void;
  onLocked?: (preview: LockedPreview) => void;
}

export async function startPickerSession<T extends { rect: InspectRect }>(
  options: PickerSessionOptions<T>,
): Promise<PickerSessionControl> {
  const { tabId, windowId, file, portPrefix, toolName, screenshot, isPayload, signal, onStatus, onResult } = options;
  const onEnd = options.onEnd ?? (() => {});
  const onLocked = options.onLocked ?? (() => {});
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: [file as never] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, {
    documentId: injection.documentId,
    name: `${portPrefix}:${session}`,
  });
  let closed = false;
  const timeout = setTimeout(() => {
    if (closed) return;
    close();
    onStatus(`Il selettore non risponde. Attiva di nuovo ${toolName}.`);
    onEnd('error');
  }, 10000);
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    signal.removeEventListener('abort', close);
    port.disconnect();
  };
  signal.addEventListener('abort', close, { once: true });
  let isolateWait: { resolve(): void } | undefined;
  function requestIsolation() {
    return new Promise<void>((resolve, reject) => {
      if (closed || signal.aborted) {
        reject(new Error('Connessione alla pagina terminata. Riprova.'));
        return;
      }
      const timer = setTimeout(() => {
        isolateWait = undefined;
        reject(new Error('Impossibile isolare l\'elemento per la cattura. Riprova.'));
      }, 4000);
      isolateWait = {
        resolve() {
          clearTimeout(timer);
          isolateWait = undefined;
          resolve();
        },
      };
      port.postMessage({ type: 'isolate-capture', session });
    });
  }
  function restoreCapture() {
    try {
      port.postMessage({ type: 'restore-capture', session });
    } catch { /* The port is already closed. */ }
  }
  port.onDisconnect.addListener(() => {
    if (!closed) {
      close();
      onStatus(`Connessione alla pagina terminata. Attiva di nuovo ${toolName}.`);
      onEnd('disconnected');
    }
  });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') {
      clearTimeout(timeout);
      onStatus('Passa col mouse sulle sezioni, clicca per fissare, poi Conferma. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'locked') {
      const preview = message.preview as LockedPreview;
      if (!preview?.selector) return;
      onLocked(preview);
      onStatus('Sezione fissata. Regola con ↑ ↓ e premi Conferma.');
    } else if (message.type === 'cancelled') {
      close();
      onStatus('Selezione annullata.');
      onEnd('cancelled');
    } else if (message.type === 'isolated') {
      isolateWait?.resolve();
    } else if (message.type === 'snapshot' && isPayload(message.payload)) {
      clearTimeout(timeout);
      const payload = message.payload as T;
      void (async () => {
        let capture: ElementCaptureResult | null = null;
        let captureError: string | undefined;
        try {
          onStatus('Cattura dell\'anteprima…');
          await requestIsolation();
          capture = await captureElementPng(tabId, windowId, payload.rect);
        } catch (error) {
          captureError = error instanceof Error ? error.message : String(error);
        }
        restoreCapture();
        close();
        if (capture || screenshot === 'optional') {
          onResult(payload, capture, captureError);
        } else {
          onStatus(captureError ?? 'Cattura non riuscita. Riprova.');
          onEnd('error');
        }
      })();
    } else if (message.type === 'error') {
      close();
      onStatus(String(message.error));
      onEnd('error');
    }
  });
  return {
    close,
    sendCommand(command: PickerCommand) {
      if (!closed && !signal.aborted) port.postMessage({ type: 'command', session, command });
    },
  };
}
```

- [ ] **Step 4: Trasforma `session.ts` in wrapper**

Sostituisci l’intero contenuto di `src/tools/inspect-save/session.ts`:

```ts
import { startPickerSession, type PickerEndReason, type PickerSessionControl } from './picker-session';
import type { InspectSnapshot, LockedPreview, SnapshotPayload } from './types';

function isPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as SnapshotPayload;
  return typeof item.tag === 'string'
    && typeof item.selector === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && Array.isArray(item.sections);
}

export type InspectSessionControl = PickerSessionControl;

export function startInspectSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: InspectSnapshot) => void,
  onEnd: (reason: PickerEndReason) => void = () => {},
  onLocked: (preview: LockedPreview) => void = () => {},
): Promise<InspectSessionControl> {
  return startPickerSession<SnapshotPayload>({
    tabId,
    windowId,
    signal,
    file: '/inspect-save.js',
    portPrefix: 'swiss-inspect-save',
    toolName: 'Ispeziona e salva',
    screenshot: 'required',
    isPayload,
    onStatus,
    onEnd,
    onLocked,
    onResult: (payload, capture) => onResult({
      ...payload,
      png: capture!.png,
      clipped: payload.clipped || capture!.clipped,
    }),
  });
}
```

- [ ] **Step 5: Esegui test e compilazione**

Run: `pnpm exec vitest run src/tools/inspect-save && pnpm compile`
Expected: PASS, compresi `session.test.ts` e `InspectSaveTool.test.tsx` senza modifiche; `tsc` senza errori.

- [ ] **Step 6: Commit**

```bash
git add src/tools/inspect-save/picker-session.ts src/tools/inspect-save/picker-session.test.ts src/tools/inspect-save/session.ts
git commit -m "refactor: extract a generic picker session with optional screenshots

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Tipi, percorso DOM e pulizia del markup

**Files:**
- Create: `src/tools/browser-context/types.ts`
- Create: `src/tools/browser-context/test-fixtures.ts`
- Create: `src/tools/browser-context/path.ts`, `src/tools/browser-context/path.test.ts`
- Create: `src/tools/browser-context/markup.ts`, `src/tools/browser-context/markup.test.ts`

**Interfaces:**
- Consumes: `InspectRect` da `../inspect-save/types`.
- Produces:
  - `types.ts`: `ViewportInfo { width; height; devicePixelRatio }`, `RenderedBox { left; top; width; height }`, `StateRules { hover: string[]; focus: string[]; active: string[] }`, `PseudoRules { before: string[]; after: string[] }`, `CssContext { matched; media; states: StateRules; inherited; pseudos: PseudoRules; resolved; variables }` (array di stringhe), `ContextPayload { element; path; url; viewport; box; rect: InspectRect; markup; css: CssContext; unreadableSheets: string[] }`, `ContextResult extends ContextPayload { png?: string }`.
  - `test-fixtures.ts`: `samplePayload(overrides?: Partial<ContextPayload>): ContextPayload`.
  - `path.ts`: `OUTLINE_CLASS = 'swiss-inspector-outline'`, `selectorSegment(element: Element): string`, `selectorPath(element: Element): string`.
  - `markup.ts`: `MARKUP_LIMIT = 60_000`, `formatKilobytes(bytes: number): string`, `shortenDataUri(value: string): string`, `truncateMarkup(html: string): string`, `cleanMarkup(element: Element): string`.

- [ ] **Step 1: Crea tipi e fixture**

Crea `src/tools/browser-context/types.ts`:

```ts
import type { InspectRect } from '../inspect-save/types';

export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface RenderedBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StateRules {
  hover: string[];
  focus: string[];
  active: string[];
}

export interface PseudoRules {
  before: string[];
  after: string[];
}

export interface CssContext {
  matched: string[];
  media: string[];
  states: StateRules;
  inherited: string[];
  pseudos: PseudoRules;
  resolved: string[];
  variables: string[];
}

export interface ContextPayload {
  element: string;
  path: string;
  url: string;
  viewport: ViewportInfo;
  box: RenderedBox;
  rect: InspectRect;
  markup: string;
  css: CssContext;
  unreadableSheets: string[];
}

export interface ContextResult extends ContextPayload {
  png?: string;
}
```

Crea `src/tools/browser-context/test-fixtures.ts`:

```ts
import type { ContextPayload } from './types';

export function samplePayload(overrides: Partial<ContextPayload> = {}): ContextPayload {
  return {
    element: 'div.card',
    path: 'main#app > div.card',
    url: 'https://example.test/pricing',
    viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
    box: { left: 560, top: 180, width: 320, height: 412 },
    rect: { left: 560, top: 180, width: 320, height: 412, viewportWidth: 1440, viewportHeight: 900, scrollX: 0, scrollY: 0 },
    markup: '<div class="card">Hi</div>',
    css: {
      matched: ['/* assets/app.css */\n.card { padding: 24px; }'],
      media: [],
      states: { hover: [], focus: [], active: [] },
      inherited: [],
      pseudos: { before: [], after: [] },
      resolved: ['padding: 24px;'],
      variables: [],
    },
    unreadableSheets: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: Scrivi i test di percorso e markup**

Crea `src/tools/browser-context/path.test.ts`:

```ts
import { beforeEach, expect, it } from 'vitest';
import { selectorPath, selectorSegment } from './path';

beforeEach(() => { document.body.innerHTML = ''; });

it('prefers the id', () => {
  document.body.innerHTML = '<main id="app" class="shell"></main>';
  expect(selectorSegment(document.querySelector('main')!)).toBe('main#app');
});

it('keeps up to three classes and skips state and overlay classes', () => {
  document.body.innerHTML = '<div class="active card swiss-inspector-outline card--featured hover wide tall"></div>';
  expect(selectorSegment(document.querySelector('div')!)).toBe('div.card.card--featured.wide');
});

it('uses nth-of-type only when siblings share the tag', () => {
  document.body.innerHTML = '<ul><li></li><li></li></ul><p><span></span></p>';
  expect(selectorSegment(document.querySelectorAll('li')[1]!)).toBe('li:nth-of-type(2)');
  expect(selectorSegment(document.querySelector('span')!)).toBe('span');
});

it('builds the path up to the nearest id', () => {
  document.body.innerHTML = '<main id="app"><section class="pricing"><div class="card"></div></section></main>';
  expect(selectorPath(document.querySelector('.card')!)).toBe('main#app > section.pricing > div.card');
});

it('limits the path to eight segments', () => {
  document.body.innerHTML = '<div><div><div><div><div><div><div><div><div><b></b></div></div></div></div></div></div></div></div></div>';
  expect(selectorPath(document.querySelector('b')!).split(' > ')).toHaveLength(8);
});
```

Crea `src/tools/browser-context/markup.test.ts`:

```ts
import { expect, it } from 'vitest';
import { MARKUP_LIMIT, cleanMarkup, formatKilobytes, shortenDataUri, truncateMarkup } from './markup';

function element(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild!;
}

it('removes swiss knife attributes and the outline class', () => {
  const html = cleanMarkup(element('<div class="swiss-inspector-outline" data-swiss-inspect=""><span class="a swiss-inspector-outline">x</span></div>'));
  expect(html).toBe('<div><span class="a">x</span></div>');
});

it('shortens long data uris', () => {
  const src = `data:image/png;base64,${'A'.repeat(4000)}`;
  expect(cleanMarkup(element(`<img src="${src}">`))).toBe('<img src="data:image/png;base64,…(3 KB)">');
  expect(shortenDataUri(`data:text/plain,${'a'.repeat(3000)}`)).toBe('data:text/plain,…(3 KB)');
});

it('keeps short data uris and other attributes', () => {
  expect(shortenDataUri('data:image/gif;base64,R0lGOD')).toBe('data:image/gif;base64,R0lGOD');
  expect(cleanMarkup(element('<a href="/pricing" title="Prezzi">x</a>'))).toBe('<a href="/pricing" title="Prezzi">x</a>');
});

it('shortens long svg path data', () => {
  const d = `M0 0 ${'L10 10 '.repeat(50)}`;
  const html = cleanMarkup(element(`<svg><path d="${d}"></path></svg>`));
  expect(html).toContain(`d="${d.slice(0, 60)}…"`);
});

it('truncates markup above the limit', () => {
  const result = truncateMarkup('x'.repeat(MARKUP_LIMIT + 10));
  expect(result).toBe(`${'x'.repeat(MARKUP_LIMIT)}\n<!-- truncated: element markup exceeds 60 KB -->`);
  expect(truncateMarkup('<b></b>')).toBe('<b></b>');
});

it('formats kilobytes with a minimum of 1', () => {
  expect(formatKilobytes(10)).toBe('1 KB');
  expect(formatKilobytes(14_500)).toBe('14 KB');
});
```

- [ ] **Step 3: Verifica che i test falliscano**

Run: `pnpm exec vitest run src/tools/browser-context`
Expected: FAIL, import `./path` e `./markup` non risolti.

- [ ] **Step 4: Implementa `path.ts`**

```ts
export const OUTLINE_CLASS = 'swiss-inspector-outline';
const STATE_CLASS = /^(active|hover|focus|selected|open)$/i;

function escapeCss(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`);
}

export function selectorSegment(element: Element): string {
  const tag = element.localName;
  if (element.id) return `${tag}#${escapeCss(element.id)}`;
  const classes = [...element.classList]
    .filter(name => name && name !== OUTLINE_CLASS && !STATE_CLASS.test(name))
    .slice(0, 3)
    .map(name => `.${escapeCss(name)}`)
    .join('');
  if (classes) return `${tag}${classes}`;
  const parent = element.parentElement;
  if (!parent) return tag;
  const siblings = [...parent.children].filter(child => child.localName === tag);
  return siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(element) + 1})` : tag;
}

export function selectorPath(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && segments.length < 8) {
    segments.unshift(selectorSegment(current));
    if (current.id) break;
    current = current.parentElement;
  }
  return segments.join(' > ');
}
```

- [ ] **Step 5: Implementa `markup.ts`**

```ts
import { OUTLINE_CLASS } from './path';

export const MARKUP_LIMIT = 60_000;
const LONG_VALUE = 200;

export function formatKilobytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function shortenDataUri(value: string): string {
  if (!value.startsWith('data:') || value.length <= LONG_VALUE) return value;
  const comma = value.indexOf(',');
  if (comma < 0) return value;
  const meta = value.slice(5, comma);
  const data = value.slice(comma + 1);
  const bytes = /;base64$/i.test(meta) ? Math.floor((data.length * 3) / 4) : data.length;
  return `data:${meta},…(${formatKilobytes(bytes)})`;
}

function cleanElement(element: Element) {
  for (const attribute of [...element.attributes]) {
    if (attribute.name.toLowerCase().startsWith('data-swiss-')) {
      element.removeAttribute(attribute.name);
    } else if (attribute.value.startsWith('data:')) {
      element.setAttribute(attribute.name, shortenDataUri(attribute.value));
    }
  }
  if (element.localName === 'path') {
    const d = element.getAttribute('d');
    if (d && d.length > LONG_VALUE) element.setAttribute('d', `${d.slice(0, 60)}…`);
  }
  if (element.classList.contains(OUTLINE_CLASS)) {
    element.classList.remove(OUTLINE_CLASS);
    if (!element.classList.length) element.removeAttribute('class');
  }
}

export function truncateMarkup(html: string): string {
  return html.length > MARKUP_LIMIT
    ? `${html.slice(0, MARKUP_LIMIT)}\n<!-- truncated: element markup exceeds 60 KB -->`
    : html;
}

export function cleanMarkup(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  cleanElement(clone);
  clone.querySelectorAll('*').forEach(cleanElement);
  return truncateMarkup(clone.outerHTML);
}
```

- [ ] **Step 6: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 7: Commit**

```bash
git add src/tools/browser-context/types.ts src/tools/browser-context/test-fixtures.ts src/tools/browser-context/path.ts src/tools/browser-context/path.test.ts src/tools/browser-context/markup.ts src/tools/browser-context/markup.test.ts
git commit -m "feat: add browser context payload types, DOM path and markup cleanup

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Scansione dei fogli di stile

**Files:**
- Create: `src/tools/browser-context/css-rules.ts`
- Create: `src/tools/browser-context/css-rules.test.ts`

**Interfaces:**
- Consumes: nessuna dipendenza interna.
- Produces:
  - `OVERLAY_ATTR = 'data-swiss-inspect'`
  - `interface RuleEntry { rule: CSSStyleRule; source: string; wrappers: string[]; active: boolean }`
  - `interface SourcedSheet { sheet: CSSStyleSheet; source: string }`
  - `interface ScanEnvironment { matchesMedia(query: string): boolean; supports(condition: string): boolean }`
  - `interface SheetScan { entries: RuleEntry[]; unreadable: string[] }`
  - `splitDeclarations(text: string): string[]`
  - `formatRule(selector: string, declarations: string[]): string`
  - `isNoiseRule(selectorText: string): boolean`
  - `atRuleHeader(cssText: string): string`
  - `wrapRule(ruleText: string, wrappers: string[]): string`
  - `formatEntry(entry: RuleEntry, declarations: string[]): string`
  - `sourceLabel(href: string | null | undefined, pageUrl: string, styleIndex: number): string`
  - `listSheets(doc: Document): SourcedSheet[]`
  - `scanStyleSheets(sheets: SourcedSheet[], env: ScanEnvironment, pageUrl: string): SheetScan`

- [ ] **Step 1: Scrivi il test**

Crea `src/tools/browser-context/css-rules.test.ts`:

```ts
import { expect, it } from 'vitest';
import {
  formatEntry,
  formatRule,
  isNoiseRule,
  listSheets,
  scanStyleSheets,
  sourceLabel,
  splitDeclarations,
  wrapRule,
  type RuleEntry,
} from './css-rules';

function sheetFrom(css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  return style.sheet as CSSStyleSheet;
}

it('splits declarations outside quotes and parentheses', () => {
  expect(splitDeclarations('color: red; background: url(data:image/png;base64,AA;BB); content: "a;b";')).toEqual([
    'color: red',
    'background: url(data:image/png;base64,AA;BB)',
    'content: "a;b"',
  ]);
});

it('formats a rule like devtools', () => {
  expect(formatRule('.a', ['color: red', 'margin: 0'])).toBe('.a { color: red;\n  margin: 0; }');
});

it('filters universal and tag-soup resets only', () => {
  expect(isNoiseRule('*')).toBe(true);
  expect(isNoiseRule('a, abbr, b, span')).toBe(true);
  expect(isNoiseRule('html, *')).toBe(true);
  expect(isNoiseRule('h1')).toBe(false);
  expect(isNoiseRule('html, body')).toBe(false);
  expect(isNoiseRule('.card')).toBe(false);
});

it('labels rule sources', () => {
  expect(sourceLabel('https://example.test/assets/app.css', 'https://example.test/pricing', 0)).toBe('/assets/app.css');
  expect(sourceLabel('https://cdn.example.net/ui.css', 'https://example.test/', 0)).toBe('cdn.example.net/ui.css');
  expect(sourceLabel(null, 'https://example.test/', 3)).toBe('<style> #3');
  expect(sourceLabel(undefined, 'https://example.test/', 0)).toBe('<style>');
});

it('wraps rules in their at-rules and prefixes the source', () => {
  expect(wrapRule('.a { color: red; }', ['@media (min-width: 1px)', '@layer base']))
    .toBe('@media (min-width: 1px) { @layer base { .a { color: red; } } }');
  const entry = { rule: { selectorText: '.a' }, source: 'app.css', wrappers: ['@layer base'], active: true } as unknown as RuleEntry;
  expect(formatEntry(entry, ['color: red'])).toBe('/* app.css */\n@layer base { .a { color: red; } }');
});

it('scans style rules with at-rule context', () => {
  const sheet = sheetFrom([
    '.a { color: red }',
    '@media (min-width: 900px) { .a { margin: 0 } }',
    '@supports (display:grid) { .a { display: grid } }',
    '@supports (foo:bar) { .a { gap: 1px } }',
    '@layer base { .a { padding: 1px } }',
    '@container (min-width: 1px) { .a { gap: 2px } }',
  ].join('\n'));
  const scan = scanStyleSheets(
    [{ sheet, source: 'app.css' }],
    { matchesMedia: () => false, supports: condition => condition.includes('grid') },
    'https://example.test/',
  );
  expect(scan.unreadable).toEqual([]);
  expect(scan.entries.map(entry => ({ selector: entry.rule.selectorText, wrappers: entry.wrappers, active: entry.active, source: entry.source }))).toEqual([
    { selector: '.a', wrappers: [], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@media (min-width: 900px)'], active: false, source: 'app.css' },
    { selector: '.a', wrappers: ['@supports (display:grid)'], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@layer base'], active: true, source: 'app.css' },
    { selector: '.a', wrappers: ['@container (min-width: 1px) /* container condition not evaluated */'], active: true, source: 'app.css' },
  ]);
});

it('records unreadable cross-origin sheets by host', () => {
  const blocked = {
    href: 'https://fonts.example.com/css?family=Inter',
    get cssRules(): CSSRuleList { throw new Error('SecurityError'); },
  } as unknown as CSSStyleSheet;
  const scan = scanStyleSheets(
    [{ sheet: blocked, source: 'fonts.example.com/css' }, { sheet: blocked, source: 'fonts.example.com/css' }],
    { matchesMedia: () => true, supports: () => true },
    'https://example.test/',
  );
  expect(scan.unreadable).toEqual(['fonts.example.com']);
  expect(scan.entries).toEqual([]);
});

it('lists document sheets with sources and skips the overlay', () => {
  const style = document.createElement('style');
  const overlay = document.createElement('style');
  overlay.setAttribute('data-swiss-inspect', '');
  const link = document.createElement('link');
  const fakeDocument = {
    location: { href: 'https://example.test/pricing' },
    querySelectorAll: () => [style, overlay],
    styleSheets: [
      { href: null, ownerNode: style },
      { href: 'https://example.test/assets/app.css', ownerNode: link },
      { href: null, ownerNode: overlay },
    ],
    adoptedStyleSheets: [{ href: null }],
  } as unknown as Document;
  expect(listSheets(fakeDocument).map(item => item.source)).toEqual([
    '<style> #1',
    '/assets/app.css',
    'adopted stylesheet #1',
  ]);
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/browser-context/css-rules.test.ts`
Expected: FAIL, import `./css-rules` non risolto.

- [ ] **Step 3: Implementa `css-rules.ts`**

```ts
export const OVERLAY_ATTR = 'data-swiss-inspect';

const STYLE_RULE = 1;
const IMPORT_RULE = 3;
const MEDIA_RULE = 4;
const SUPPORTS_RULE = 12;

export interface RuleEntry {
  rule: CSSStyleRule;
  source: string;
  wrappers: string[];
  active: boolean;
}

export interface SourcedSheet {
  sheet: CSSStyleSheet;
  source: string;
}

export interface ScanEnvironment {
  matchesMedia(query: string): boolean;
  supports(condition: string): boolean;
}

export interface SheetScan {
  entries: RuleEntry[];
  unreadable: string[];
}

// Split "a: b; c: d" on semicolons outside quotes and parentheses:
// values like url(data:…;base64,…) contain literal semicolons.
export function splitDeclarations(text: string): string[] {
  const declarations: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
    } else if (character === ';' && depth === 0) {
      const declaration = text.slice(start, index).trim();
      if (declaration) declarations.push(declaration);
      start = index + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) declarations.push(tail);
  return declarations;
}

export function formatRule(selector: string, declarations: string[]): string {
  return `${selector} { ${declarations.join(';\n  ')}${declarations.length ? ';' : ''} }`;
}

// Universal rules and tag-soup resets match every element and say nothing
// about the selected one. A single bare tag selector is real styling.
export function isNoiseRule(selectorText: string): boolean {
  const segments = selectorText.split(',').map(segment => segment.trim());
  const generic = segments.every(segment => /^(\*|::?[a-z-]+|[a-z][a-z0-9-]*)$/i.test(segment));
  return generic && (segments.length > 3 || segments.includes('*'));
}

export function atRuleHeader(cssText: string): string {
  const brace = cssText.indexOf('{');
  return (brace < 0 ? cssText : cssText.slice(0, brace)).trim();
}

export function wrapRule(ruleText: string, wrappers: string[]): string {
  return wrappers.reduceRight((inner, wrapper) => `${wrapper} { ${inner} }`, ruleText);
}

export function formatEntry(entry: RuleEntry, declarations: string[]): string {
  return `/* ${entry.source} */\n${wrapRule(formatRule(entry.rule.selectorText, declarations), entry.wrappers)}`;
}

export function sourceLabel(href: string | null | undefined, pageUrl: string, styleIndex: number): string {
  if (href) {
    try {
      const url = new URL(href, pageUrl);
      return url.host === new URL(pageUrl).host ? url.pathname : `${url.host}${url.pathname}`;
    } catch {
      return href;
    }
  }
  return styleIndex > 0 ? `<style> #${styleIndex}` : '<style>';
}

function hostOf(href: string, pageUrl: string) {
  try {
    return new URL(href, pageUrl).host || href;
  } catch {
    return href;
  }
}

export function listSheets(doc: Document): SourcedSheet[] {
  const pageUrl = doc.location?.href ?? '';
  const styles = [...doc.querySelectorAll('style')].filter(node => !node.hasAttribute(OVERLAY_ATTR));
  const list: SourcedSheet[] = [];
  for (const sheet of [...doc.styleSheets]) {
    const owner = sheet.ownerNode as Element | null | undefined;
    if (owner && typeof owner.hasAttribute === 'function' && owner.hasAttribute(OVERLAY_ATTR)) continue;
    const index = owner ? styles.indexOf(owner as HTMLStyleElement) + 1 : 0;
    list.push({ sheet, source: sourceLabel(sheet.href, pageUrl, index) });
  }
  const adopted = (doc as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
  adopted.forEach((sheet, index) => list.push({ sheet, source: `adopted stylesheet #${index + 1}` }));
  return list;
}

export function scanStyleSheets(sheets: SourcedSheet[], env: ScanEnvironment, pageUrl: string): SheetScan {
  const entries: RuleEntry[] = [];
  const unreadable = new Set<string>();

  function readSheet(sheet: CSSStyleSheet, source: string, wrappers: string[], active: boolean) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      unreadable.add(sheet.href ? hostOf(sheet.href, pageUrl) : source);
      return;
    }
    visit(rules, source, wrappers, active);
  }

  function visit(rules: CSSRuleList, source: string, wrappers: string[], active: boolean) {
    for (const rule of Array.from(rules)) {
      try {
        if (rule.type === STYLE_RULE) {
          entries.push({ rule: rule as CSSStyleRule, source, wrappers, active });
        } else if (rule.type === IMPORT_RULE) {
          const imported = (rule as CSSImportRule).styleSheet;
          if (imported) readSheet(imported, sourceLabel(imported.href, pageUrl, 0), wrappers, active);
        } else if (rule.type === MEDIA_RULE) {
          const media = rule as CSSMediaRule;
          const query = media.media.mediaText;
          visit(media.cssRules, source, [...wrappers, `@media ${query}`], active && env.matchesMedia(query));
        } else if ('cssRules' in rule) {
          const group = rule as CSSGroupingRule;
          const header = atRuleHeader(rule.cssText);
          if (rule.type === SUPPORTS_RULE || header.startsWith('@supports')) {
            const condition = (rule as CSSSupportsRule).conditionText ?? header.replace(/^@supports\s*/i, '');
            if (env.supports(condition)) visit(group.cssRules, source, [...wrappers, header], active);
          } else if (header.startsWith('@container')) {
            visit(group.cssRules, source, [...wrappers, `${header} /* container condition not evaluated */`], active);
          } else if (header.startsWith('@layer')) {
            visit(group.cssRules, source, [...wrappers, header], active);
          } else {
            visit(group.cssRules, source, wrappers, active);
          }
        }
      } catch {
        // Unsupported rule type or unreadable nested sheet.
      }
    }
  }

  for (const { sheet, source } of sheets) readSheet(sheet, source, [], true);
  return { entries, unreadable: [...unreadable] };
}
```

- [ ] **Step 4: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context/css-rules.test.ts && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/tools/browser-context/css-rules.ts src/tools/browser-context/css-rules.test.ts
git commit -m "feat: scan stylesheets with rule sources and at-rule context

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Regole corrispondenti, stati, pseudo-elementi, ereditarietà e variabili

**Files:**
- Create: `src/tools/browser-context/css-match.ts`
- Create: `src/tools/browser-context/css-match.test.ts`

**Interfaces:**
- Consumes (Task 4): `RuleEntry`, `formatEntry`, `formatRule`, `isNoiseRule`, `splitDeclarations`, `scanStyleSheets`. (Task 3): `CssContext`.
- Produces:
  - `RULE_LIMITS = { matched: 40, media: 15, inherited: 12, group: 20, variables: 40 } as const`
  - `INHERITED_PROPERTIES: Set<string>`
  - `matchedRules(element: Element, entries: RuleEntry[]): string[]`
  - `otherBreakpointRules(element: Element, entries: RuleEntry[]): string[]`
  - `statesInSelector(element: Element, selectorText: string): Set<'hover' | 'focus' | 'active'>`
  - `stateRules(element: Element, entries: RuleEntry[], matched: string[]): StateRules`
  - `pseudoElementRules(element: Element, entries: RuleEntry[], pseudo: 'before' | 'after'): string[]`
  - `inheritedDeclarations(style: CSSStyleDeclaration): string[]`
  - `inheritedRules(element: Element, entries: RuleEntry[]): string[]`
  - `referencedVariables(texts: string[], readValue: (name: string) => string): string[]`
  - `collectRuleContext(element: Element, entries: RuleEntry[], view: Pick<Window, 'getComputedStyle'>): Omit<CssContext, 'resolved'>`

- [ ] **Step 1: Scrivi il test**

Crea `src/tools/browser-context/css-match.test.ts`:

```ts
import { beforeEach, expect, it } from 'vitest';
import { scanStyleSheets } from './css-rules';
import {
  collectRuleContext,
  inheritedRules,
  matchedRules,
  otherBreakpointRules,
  referencedVariables,
  stateRules,
} from './css-match';

function setup(css: string, html: string) {
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  document.body.innerHTML = html;
  const { entries } = scanStyleSheets(
    [{ sheet: style.sheet as CSSStyleSheet, source: 'assets/app.css' }],
    { matchesMedia: query => query.includes('1px'), supports: () => true },
    'https://example.test/',
  );
  return { entries, element: document.querySelector('.card')! };
}

function fakeView(pseudoContent: Partial<Record<string, string>>, variables: Record<string, string> = {}) {
  return {
    getComputedStyle: (_element: Element, pseudo?: string | null) => ({
      content: pseudo ? pseudoContent[pseudo] ?? 'none' : 'normal',
      getPropertyValue: (name: string) => variables[name] ?? '',
    }),
  } as unknown as Pick<Window, 'getComputedStyle'>;
}

beforeEach(() => { document.body.innerHTML = ''; });

it('lists matching rules without resets and appends the inline style', () => {
  const { entries, element } = setup(
    '* { box-sizing: border-box } a, abbr, b, span { margin: 0 } .card { padding: 24px; border-radius: var(--radius) } @media (min-width: 1px) { .card { gap: 4px } } .other { color: red }',
    '<div class="card" style="top: 1px">x</div>',
  );
  expect(matchedRules(element, entries)).toEqual([
    '/* assets/app.css */\n.card { padding: 24px;\n  border-radius: var(--radius); }',
    '/* assets/app.css */\n@media (min-width: 1px) { .card { gap: 4px; } }',
    'element.style { top: 1px; }',
  ]);
});

it('lists rules for inactive breakpoints separately', () => {
  const { entries, element } = setup('@media (min-width: 900px) { .card { margin: 0 } }', '<div class="card"></div>');
  expect(matchedRules(element, entries)).toEqual([]);
  expect(otherBreakpointRules(element, entries)).toEqual(['/* assets/app.css */\n@media (min-width: 900px) { .card { margin: 0; } }']);
});

it('groups interaction states and skips rules already matched', () => {
  const { entries, element } = setup(
    '.card:hover { color: blue } .card:focus-visible { outline: 2px solid } .other:active { color: red }',
    '<div class="card"></div>',
  );
  expect(stateRules(element, entries, [])).toEqual({
    hover: ['/* assets/app.css */\n.card:hover { color: blue; }'],
    focus: ['/* assets/app.css */\n.card:focus-visible { outline: 2px solid; }'],
    active: [],
  });
  const hover = '/* assets/app.css */\n.card:hover { color: blue; }';
  expect(stateRules(element, entries, [hover]).hover).toEqual([]);
});

it('keeps only inheritable declarations from ancestors', () => {
  const { entries, element } = setup('body { color: red; margin: 0 } .card { color: blue }', '<div class="card"></div>');
  expect(inheritedRules(element, entries)).toEqual(['/* assets/app.css */\nbody { color: red; }']);
});

it('collects pseudo-elements only when rendered and skips universal ones', () => {
  const { entries, element } = setup(
    '.card::before { content: "x" } *::before { box-sizing: inherit } .card::after { content: "y" }',
    '<div class="card"></div>',
  );
  const context = collectRuleContext(element, entries, fakeView({ '::before': '"x"' }));
  expect(context.pseudos).toEqual({
    before: ['/* assets/app.css */\n.card::before { content: "x"; }'],
    after: [],
  });
});

it('resolves the variables referenced by matched and inherited rules', () => {
  const { entries, element } = setup('.card { padding: var(--space); gap: var( --gap, 1px) }', '<div class="card"></div>');
  const context = collectRuleContext(element, entries, fakeView({}, { '--space': ' 24px' }));
  expect(context.variables).toEqual(['--space: 24px;', '--gap: (unset);']);
  expect(referencedVariables(['a { b: var(--x) }', 'c { d: var(--x) }'], () => '1px')).toEqual(['--x: 1px;']);
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/browser-context/css-match.test.ts`
Expected: FAIL, import `./css-match` non risolto.

- [ ] **Step 3: Implementa `css-match.ts`**

```ts
import { formatEntry, formatRule, isNoiseRule, splitDeclarations, type RuleEntry } from './css-rules';
import type { CssContext, PseudoRules, StateRules } from './types';

export const RULE_LIMITS = { matched: 40, media: 15, inherited: 12, group: 20, variables: 40 } as const;

export const INHERITED_PROPERTIES = new Set([
  'border-collapse', 'border-spacing', 'caption-side', 'color', 'cursor',
  'direction', 'empty-cells', 'font', 'font-family', 'font-feature-settings',
  'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight',
  'hyphens', 'letter-spacing', 'line-height', 'list-style', 'list-style-image',
  'list-style-position', 'list-style-type', 'overflow-wrap', 'quotes',
  'tab-size', 'text-align', 'text-align-last', 'text-indent', 'text-shadow',
  'text-transform', 'visibility', 'white-space', 'word-break', 'word-spacing',
]);

type StateName = keyof StateRules;

const STATE_PSEUDO = /:(hover|focus-visible|focus-within|focus|active)\b/gi;
const PSEUDO_ELEMENT = /::?(before|after)\b/i;

function safeMatches(element: Element, selector: string) {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function declarationsOf(entry: RuleEntry) {
  return splitDeclarations(entry.rule.style.cssText);
}

export function matchedRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.matched) break;
    const selector = entry.rule.selectorText;
    if (!entry.active || isNoiseRule(selector) || !safeMatches(element, selector)) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  const inline = (element as HTMLElement).style?.cssText;
  if (inline) rules.push(formatRule('element.style', splitDeclarations(inline)));
  return rules;
}

export function otherBreakpointRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.media) break;
    const selector = entry.rule.selectorText;
    if (entry.active || isNoiseRule(selector) || !safeMatches(element, selector)) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  return rules;
}

// :hover/:focus/:active never match a static snapshot, so test the selector
// with the state pseudo-classes stripped.
export function statesInSelector(element: Element, selectorText: string): Set<StateName> {
  const states = new Set<StateName>();
  for (const segment of selectorText.split(',')) {
    const trimmed = segment.trim();
    const names = [...trimmed.matchAll(STATE_PSEUDO)].map(match => match[1]!.toLowerCase());
    if (!names.length) continue;
    const stripped = trimmed.replace(STATE_PSEUDO, '').trim();
    if (!stripped || !safeMatches(element, stripped)) continue;
    names.forEach(name => states.add(name.startsWith('focus') ? 'focus' : name as StateName));
  }
  return states;
}

export function stateRules(element: Element, entries: RuleEntry[], matched: string[]): StateRules {
  const states: StateRules = { hover: [], focus: [], active: [] };
  for (const entry of entries) {
    const selector = entry.rule.selectorText;
    if (!entry.active || isNoiseRule(selector)) continue;
    const found = statesInSelector(element, selector);
    if (!found.size) continue;
    const declarations = declarationsOf(entry);
    if (!declarations.length) continue;
    const text = formatEntry(entry, declarations);
    if (matched.includes(text)) continue;
    for (const state of found) {
      if (states[state].length < RULE_LIMITS.group) states[state].push(text);
    }
  }
  return states;
}

export function pseudoElementRules(element: Element, entries: RuleEntry[], pseudo: keyof PseudoRules): string[] {
  const rules: string[] = [];
  for (const entry of entries) {
    if (rules.length >= RULE_LIMITS.group) break;
    if (!entry.active) continue;
    const hit = entry.rule.selectorText.split(',').some(segment => {
      const trimmed = segment.trim();
      const match = trimmed.match(PSEUDO_ELEMENT);
      if (!match || match[1]!.toLowerCase() !== pseudo) return false;
      const base = trimmed.slice(0, match.index).trim();
      return !!base && base !== '*' && safeMatches(element, base);
    });
    if (!hit) continue;
    const declarations = declarationsOf(entry);
    if (declarations.length) rules.push(formatEntry(entry, declarations));
  }
  return rules;
}

export function inheritedDeclarations(style: CSSStyleDeclaration): string[] {
  const declarations: string[] = [];
  for (let index = 0; index < style.length; index++) {
    const property = style[index]!;
    if (!INHERITED_PROPERTIES.has(property)) continue;
    const priority = style.getPropertyPriority(property);
    declarations.push(`${property}: ${style.getPropertyValue(property).trim()}${priority ? ' !important' : ''}`);
  }
  return declarations;
}

export function inheritedRules(element: Element, entries: RuleEntry[]): string[] {
  const rules: string[] = [];
  for (let ancestor = element.parentElement; ancestor && rules.length < RULE_LIMITS.inherited; ancestor = ancestor.parentElement) {
    for (const entry of entries) {
      if (rules.length >= RULE_LIMITS.inherited) break;
      const selector = entry.rule.selectorText;
      if (!entry.active || isNoiseRule(selector) || !safeMatches(ancestor, selector)) continue;
      const declarations = inheritedDeclarations(entry.rule.style);
      if (!declarations.length) continue;
      const text = formatEntry(entry, declarations);
      if (!rules.includes(text)) rules.push(text);
    }
  }
  return rules;
}

export function referencedVariables(texts: string[], readValue: (name: string) => string): string[] {
  const names = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1]!);
  }
  return [...names].slice(0, RULE_LIMITS.variables).map(name => {
    const value = readValue(name).trim();
    return `${name}: ${value || '(unset)'};`;
  });
}

export function collectRuleContext(
  element: Element,
  entries: RuleEntry[],
  view: Pick<Window, 'getComputedStyle'>,
): Omit<CssContext, 'resolved'> {
  const matched = matchedRules(element, entries);
  const inherited = inheritedRules(element, entries);
  const computed = view.getComputedStyle(element);
  const pseudos: PseudoRules = { before: [], after: [] };
  for (const pseudo of ['before', 'after'] as const) {
    let content = 'none';
    try {
      content = view.getComputedStyle(element, `::${pseudo}`).content;
    } catch { /* Pseudo-element styles are unavailable. */ }
    if (content && content !== 'none') pseudos[pseudo] = pseudoElementRules(element, entries, pseudo);
  }
  return {
    matched,
    media: otherBreakpointRules(element, entries),
    states: stateRules(element, entries, matched),
    inherited,
    pseudos,
    variables: referencedVariables([...matched, ...inherited], name => computed.getPropertyValue(name)),
  };
}
```

- [ ] **Step 4: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context/css-match.test.ts && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/tools/browser-context/css-match.ts src/tools/browser-context/css-match.test.ts
git commit -m "feat: match authored, state, pseudo, inherited rules and variables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Valori calcolati diversi dal default

**Files:**
- Create: `src/tools/browser-context/resolved.ts`
- Create: `src/tools/browser-context/resolved.test.ts`

**Interfaces:**
- Consumes: `OVERLAY_ATTR` da `./css-rules`.
- Produces:
  - `RESOLVED_LIMIT = 200`
  - `type StyleValues = Map<string, string>`
  - `SHORTHAND_GROUPS: Array<[string, (property: string) => boolean]>`
  - `diffComputed(computed: StyleValues, baseline: StyleValues, shorthands: StyleValues): string[]`
  - `readResolvedValues(element: Element, view: Window): string[]`

- [ ] **Step 1: Scrivi il test**

Crea `src/tools/browser-context/resolved.test.ts`:

```ts
import { expect, it } from 'vitest';
import { RESOLVED_LIMIT, diffComputed, readResolvedValues } from './resolved';

const values = (entries: Record<string, string>) => new Map(Object.entries(entries));

it('keeps only properties that differ from the baseline', () => {
  const computed = values({ display: 'flex', color: 'rgb(0, 0, 0)', 'z-index': '2' });
  const baseline = values({ display: 'block', color: 'rgb(0, 0, 0)', 'z-index': 'auto' });
  expect(diffComputed(computed, baseline, new Map())).toEqual(['display: flex;', 'z-index: 2;']);
});

it('drops vendor, logical and mirrored colour properties', () => {
  const computed = values({
    '-webkit-locale': 'it',
    'inline-size': '10px',
    'margin-inline-start': '4px',
    'inset-block-start': '1px',
    color: 'rgb(255, 0, 0)',
    'caret-color': 'rgb(255, 0, 0)',
    'text-decoration-color': 'rgb(0, 0, 255)',
  });
  expect(diffComputed(computed, new Map(), new Map())).toEqual([
    'color: rgb(255, 0, 0);',
    'text-decoration-color: rgb(0, 0, 255);',
  ]);
});

it('drops border and outline colours that only follow the text colour', () => {
  const computed = values({
    color: 'rgb(20, 20, 20)',
    'border-top-color': 'rgb(20, 20, 20)',
    'border-right-color': 'rgb(20, 20, 20)',
    'border-bottom-color': 'rgb(20, 20, 20)',
    'border-left-color': 'rgb(20, 20, 20)',
    'border-block-start-color': 'rgb(0, 0, 255)',
    'border-inline-end-width': '3px',
    'outline-color': 'rgb(255, 0, 0)',
  });
  expect(diffComputed(computed, new Map(), values({ border: '0px none rgb(20, 20, 20)' }))).toEqual([
    'color: rgb(20, 20, 20);',
    'outline-color: rgb(255, 0, 0);',
  ]);
});

it('folds longhands into their computed shorthand', () => {
  const computed = values({ 'margin-top': '8px', 'margin-bottom': '8px', 'border-top-left-radius': '4px', 'padding-left': '2px' });
  const shorthands = values({ margin: '8px 0px', 'border-radius': '4px 0px 0px', padding: '' });
  expect(diffComputed(computed, new Map(), shorthands)).toEqual([
    'margin: 8px 0px;',
    'border-radius: 4px 0px 0px;',
    'padding-left: 2px;',
  ]);
});

it('caps the list', () => {
  const computed = new Map(Array.from({ length: 250 }, (_, index) => [`p-${String(index).padStart(3, '0')}`, '1']));
  expect(diffComputed(computed, new Map(), new Map())).toHaveLength(RESOLVED_LIMIT);
});

it('reads values through a temporary iframe and removes it', () => {
  const element = document.createElement('div');
  document.body.append(element);
  const result = readResolvedValues(element, window);
  expect(Array.isArray(result)).toBe(true);
  expect(document.querySelector('iframe[data-swiss-inspect]')).toBeNull();
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/browser-context/resolved.test.ts`
Expected: FAIL, import `./resolved` non risolto.

- [ ] **Step 3: Implementa `resolved.ts`**

```ts
import { OVERLAY_ATTR } from './css-rules';

export const RESOLVED_LIMIT = 200;

export type StyleValues = Map<string, string>;

const NOISE_PROPERTIES = new Set([
  'block-size', 'inline-size', 'min-block-size', 'min-inline-size',
  'max-block-size', 'max-inline-size', 'perspective-origin', 'transform-origin',
]);
const NOISE_PREFIXES = ['border-block', 'border-inline', 'inset-', 'margin-block', 'margin-inline', 'padding-block', 'padding-inline'];
const COLOR_MIRRORS = new Set([
  'border-bottom-color', 'border-left-color', 'border-right-color', 'border-top-color',
  'caret-color', 'column-rule-color', 'outline-color', 'text-decoration-color', 'text-emphasis-color',
]);

export const SHORTHAND_GROUPS: Array<[string, (property: string) => boolean]> = [
  ['margin', property => property.startsWith('margin-')],
  ['padding', property => property.startsWith('padding-')],
  ['border-radius', property => /^border-.+-radius$/.test(property)],
  ['border', property => property.startsWith('border-') && !property.endsWith('-radius') && !property.startsWith('border-image')],
];

export function diffComputed(computed: StyleValues, baseline: StyleValues, shorthands: StyleValues): string[] {
  const color = computed.get('color');
  const changed = new Set<string>();
  for (const [property, value] of computed) {
    if (property.startsWith('-') || NOISE_PROPERTIES.has(property)) continue;
    if (NOISE_PREFIXES.some(prefix => property.startsWith(prefix))) continue;
    if (COLOR_MIRRORS.has(property) && value === color) continue;
    if (value !== (baseline.get(property) ?? '')) changed.add(property);
  }
  const lines: string[] = [];
  for (const [shorthand, belongs] of SHORTHAND_GROUPS) {
    const longhands = [...changed].filter(belongs);
    if (!longhands.length) continue;
    const value = shorthands.get(shorthand);
    if (!value) continue;
    lines.push(`${shorthand}: ${value};`);
    longhands.forEach(property => changed.delete(property));
  }
  for (const property of [...changed].sort()) lines.push(`${property}: ${computed.get(property)};`);
  return lines.slice(0, RESOLVED_LIMIT);
}

function readStyle(style: CSSStyleDeclaration): StyleValues {
  const result: StyleValues = new Map();
  for (let index = 0; index < style.length; index++) {
    const property = style[index]!;
    result.set(property, style.getPropertyValue(property));
  }
  return result;
}

// Compare with a pristine element of the same tag so only properties that
// something actually set are reported.
export function readResolvedValues(element: Element, view: Window): string[] {
  const doc = element.ownerDocument;
  const iframe = doc.createElement('iframe');
  iframe.setAttribute(OVERLAY_ATTR, '');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden;';
  try {
    doc.documentElement.append(iframe);
    const probeDocument = iframe.contentDocument;
    const probeWindow = iframe.contentWindow;
    if (!probeDocument || !probeWindow) return [];
    const probe = probeDocument.createElementNS(element.namespaceURI ?? 'http://www.w3.org/1999/xhtml', element.localName);
    (probeDocument.body ?? probeDocument.documentElement).append(probe);
    const computed = view.getComputedStyle(element);
    const shorthands: StyleValues = new Map(SHORTHAND_GROUPS.map(([name]) => [name, computed.getPropertyValue(name)]));
    return diffComputed(readStyle(computed), readStyle(probeWindow.getComputedStyle(probe)), shorthands);
  } catch {
    return [];
  } finally {
    iframe.remove();
  }
}
```

- [ ] **Step 4: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context/resolved.test.ts && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/tools/browser-context/resolved.ts src/tools/browser-context/resolved.test.ts
git commit -m "feat: report computed values that differ from browser defaults

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Formatter del report

**Files:**
- Create: `src/tools/browser-context/report.ts`
- Create: `src/tools/browser-context/report.test.ts`

**Interfaces:**
- Consumes: `ContextPayload` (Task 3), `formatKilobytes` (Task 3), `samplePayload` (Task 3).
- Produces:
  - `interface ReportOptions { screenshotFile?: string }`
  - `fence(body: string, language: string): string[]`
  - `markdownDestination(file: string): string`
  - `unreadableNote(hosts: string[]): string | null`
  - `formatReport(payload: ContextPayload, options?: ReportOptions): string`
  - `reportName(element: string): string`
  - `reportStamp(date: Date): string` → `YYYYMMDD-HHmmss`
  - `estimateTokens(text: string): number`
  - `formatReportStats(text: string): string` → `Report: 14 KB · ~3750 token`

- [ ] **Step 1: Scrivi il test**

Crea `src/tools/browser-context/report.test.ts`:

```ts
import { expect, it } from 'vitest';
import {
  estimateTokens,
  fence,
  formatReport,
  formatReportStats,
  markdownDestination,
  reportName,
  reportStamp,
  unreadableNote,
} from './report';
import { samplePayload } from './test-fixtures';

const FENCE = '`'.repeat(3);

it('formats the full report with only non-empty sections', () => {
  expect(formatReport(samplePayload())).toBe([
    '# div.card',
    '',
    '- Page: https://example.test/pricing',
    '- Viewport: 1440 × 900 px, 2x pixel ratio',
    '- Rendered size: 320 × 412 px at (560, 180)',
    '- DOM path: main#app > div.card',
    '',
    '## Markup',
    '',
    `${FENCE}html`,
    '<div class="card">Hi</div>',
    FENCE,
    '',
    '## Styles',
    '',
    '### Matching rules, as authored',
    '',
    `${FENCE}css`,
    '/* assets/app.css */\n.card { padding: 24px; }',
    FENCE,
    '',
    '### Computed values that differ from the browser default',
    '',
    `${FENCE}css`,
    'padding: 24px;',
    FENCE,
    '',
  ].join('\n'));
});

it('orders every style section as in the spec', () => {
  const payload = samplePayload({
    css: {
      matched: ['m'],
      media: ['b'],
      states: { hover: ['h'], focus: ['f'], active: ['a'] },
      inherited: ['i'],
      pseudos: { before: ['pb'], after: ['pa'] },
      resolved: ['r1;', 'r2;'],
      variables: ['--v: 1px;'],
    },
  });
  const headings = formatReport(payload).split('\n').filter(line => line.startsWith('### '));
  expect(headings).toEqual([
    '### Matching rules, as authored',
    '### Other breakpoints (not currently active)',
    '### :hover',
    '### :focus',
    '### :active',
    '### Inherited from ancestors',
    '### ::before',
    '### ::after',
    '### Computed values that differ from the browser default',
    '### CSS variables referenced above',
  ]);
  expect(formatReport(payload)).toContain('r1;\nr2;');
});

it('adds the screenshot line only when a file is given', () => {
  expect(formatReport(samplePayload())).not.toContain('![Screenshot');
  expect(formatReport(samplePayload(), { screenshotFile: 'card-1.png' })).toContain('\n\n![Screenshot of div.card](card-1.png)\n\n## Markup');
  expect(markdownDestination('card (1).png')).toBe('<card (1).png>');
});

it('notes unreadable stylesheets', () => {
  expect(unreadableNote([])).toBeNull();
  expect(unreadableNote(['a.test'])).toBe('> 1 stylesheet could not be read (cross-origin): a.test');
  expect(unreadableNote(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('> 7 stylesheets could not be read (cross-origin): a, b, c, d, e and 2 more');
  expect(formatReport(samplePayload({ unreadableSheets: ['fonts.example.com'] }))).toContain('- DOM path: main#app > div.card\n\n> 1 stylesheet');
});

it('reports when no styles were found', () => {
  const empty = samplePayload({
    css: { matched: [], media: [], states: { hover: [], focus: [], active: [] }, inherited: [], pseudos: { before: [], after: [] }, resolved: [], variables: [] },
  });
  expect(formatReport(empty)).toContain('## Styles\n\nNo matching styles or non-default computed values were found.\n');
});

it('uses a longer fence when the body contains backticks', () => {
  expect(fence('a ``` b', 'html')).toEqual(['````html', 'a ``` b', '````']);
});

it('derives file names and timestamps', () => {
  expect(reportName('div.card.card--featured')).toBe('card');
  expect(reportName('span.weather__summary')).toBe('weather-summary');
  expect(reportName('main#app')).toBe('app');
  expect(reportName('li:nth-of-type(2)')).toBe('li');
  expect(reportName('###')).toBe('element');
  expect(reportStamp(new Date(2026, 8, 6, 4, 3, 2))).toBe('20260906-040302');
});

it('estimates size and tokens', () => {
  expect(estimateTokens('abcde')).toBe(2);
  expect(formatReportStats('a'.repeat(15_000))).toBe('Report: 15 KB · ~3750 token');
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/browser-context/report.test.ts`
Expected: FAIL, import `./report` non risolto.

- [ ] **Step 3: Implementa `report.ts`**

```ts
import { formatKilobytes } from './markup';
import type { ContextPayload } from './types';

export interface ReportOptions {
  screenshotFile?: string;
}

const MAX_HOSTS = 5;

export function fence(body: string, language: string): string[] {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map(match => match[0].length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return [`${ticks}${language}`, body, ticks];
}

export function markdownDestination(file: string) {
  return /[\s()<>]/.test(file) ? `<${file}>` : file;
}

export function unreadableNote(hosts: string[]): string | null {
  if (!hosts.length) return null;
  const shown = hosts.slice(0, MAX_HOSTS).join(', ');
  const extra = hosts.length > MAX_HOSTS ? ` and ${hosts.length - MAX_HOSTS} more` : '';
  const noun = hosts.length === 1 ? 'stylesheet' : 'stylesheets';
  return `> ${hosts.length} ${noun} could not be read (cross-origin): ${shown}${extra}`;
}

export function formatReport(payload: ContextPayload, options: ReportOptions = {}): string {
  const { element, path, url, viewport, box, markup, css } = payload;
  const lines = [
    `# ${element}`,
    '',
    `- Page: ${url}`,
    `- Viewport: ${viewport.width} × ${viewport.height} px, ${viewport.devicePixelRatio}x pixel ratio`,
    `- Rendered size: ${box.width} × ${box.height} px at (${box.left}, ${box.top})`,
    `- DOM path: ${path}`,
  ];
  const note = unreadableNote(payload.unreadableSheets);
  if (note) lines.push('', note);
  if (options.screenshotFile) {
    lines.push('', `![Screenshot of ${element}](${markdownDestination(options.screenshotFile)})`);
  }
  lines.push('', '## Markup', '', ...fence(markup, 'html'), '', '## Styles');
  let sections = 0;
  const section = (heading: string, body: string[], separator = '\n\n') => {
    if (!body.length) return;
    sections++;
    lines.push('', `### ${heading}`, '', ...fence(body.join(separator), 'css'));
  };
  section('Matching rules, as authored', css.matched);
  section('Other breakpoints (not currently active)', css.media);
  section(':hover', css.states.hover);
  section(':focus', css.states.focus);
  section(':active', css.states.active);
  section('Inherited from ancestors', css.inherited);
  section('::before', css.pseudos.before);
  section('::after', css.pseudos.after);
  section('Computed values that differ from the browser default', css.resolved, '\n');
  section('CSS variables referenced above', css.variables, '\n');
  if (!sections) lines.push('', 'No matching styles or non-default computed values were found.');
  return `${lines.join('\n')}\n`;
}

// "span.weather__summary" → "weather-summary": the first id or class names the
// capture better than the tag.
export function reportName(element: string): string {
  const match = element.match(/[#.]([^#.:\s>]+)/);
  const raw = match ? match[1]! : element.split(/[#.:\s>]/)[0]!;
  const base = raw
    .replace(/\\/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return base.slice(0, 40) || 'element';
}

export function reportStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatReportStats(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  return `Report: ${formatKilobytes(bytes)} · ~${estimateTokens(text).toLocaleString('it-IT')} token`;
}
```

- [ ] **Step 4: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context/report.test.ts && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/tools/browser-context/report.ts src/tools/browser-context/report.test.ts
git commit -m "feat: format the browser context markdown report

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Raccolta nella pagina, sessione ed entrypoint

**Files:**
- Create: `src/tools/browser-context/collect.ts`, `src/tools/browser-context/collect.test.ts`
- Create: `src/tools/browser-context/session.ts`, `src/tools/browser-context/session.test.ts`
- Create: `entrypoints/browser-context.ts`

**Interfaces:**
- Consumes: `listSheets`, `scanStyleSheets`, `ScanEnvironment` (Task 4); `collectRuleContext` (Task 5); `readResolvedValues` (Task 6); `cleanMarkup` (Task 3); `selectorSegment`, `selectorPath` (Task 3); `startPickerSession`, `PickerSessionControl`, `PickerEndReason` (Task 2); `runPickerHost` (Task 1).
- Produces:
  - `scanEnvironment(view: Window): ScanEnvironment`
  - `buildContextPayload(element: Element, view: Window): ContextPayload`
  - `isContextPayload(value: unknown): value is ContextPayload`
  - `interface BrowserContextHandlers { onStatus(status: string): void; onResult(result: ContextResult, captureError?: string): void; onEnd(reason: PickerEndReason): void; onLocked(preview: LockedPreview): void }`
  - `startBrowserContextSession(tabId: number, windowId: number, signal: AbortSignal, handlers: BrowserContextHandlers): Promise<PickerSessionControl>`
  - Script iniettato `/browser-context.js`, port `swiss-browser-context:<uuid>`, chiave globale `__swissBrowserContext`.

- [ ] **Step 1: Scrivi i test**

Crea `src/tools/browser-context/collect.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { buildContextPayload, scanEnvironment } from './collect';

beforeEach(() => {
  document.head.innerHTML = '<style>.card { padding: 24px } body { color: red }</style>';
  document.body.innerHTML = '<main id="app"><div class="card" data-swiss-inspect-x="1">Hi</div></main>';
  Element.prototype.scrollIntoView = vi.fn();
});

it('builds a serialisable payload for the element', () => {
  const element = document.querySelector('.card')!;
  const payload = buildContextPayload(element, window);
  expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  expect(payload.element).toBe('div.card');
  expect(payload.path).toBe('main#app > div.card');
  expect(payload.url).toBe('https://example.test/path/');
  expect(payload.markup).toBe('<div class="card">Hi</div>');
  expect(payload.css.matched).toContain('/* <style> */\n.card { padding: 24px; }');
  expect(payload.css.inherited).toContain('/* <style> */\nbody { color: red; }');
  expect(payload.unreadableSheets).toEqual([]);
  expect(payload.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: 1 });
  expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
});

it('treats missing media and supports APIs as non-matching', () => {
  const env = scanEnvironment({} as Window);
  expect(env.matchesMedia('(min-width: 1px)')).toBe(false);
  expect(env.supports('(display: grid)')).toBe(false);
});
```

Nota: in jsdom `sheet.ownerNode` è `undefined`, quindi l’origine è `<style>` senza numero; nel browser reale sarà `<style> #1`.

Crea `src/tools/browser-context/session.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest';
import { startPickerSession } from '../inspect-save/picker-session';
import { isContextPayload, startBrowserContextSession } from './session';
import { samplePayload } from './test-fixtures';

vi.mock('../inspect-save/picker-session', () => ({
  startPickerSession: vi.fn(async () => ({ close: vi.fn(), sendCommand: vi.fn() })),
}));

beforeEach(() => vi.clearAllMocks());

it('validates context payloads', () => {
  expect(isContextPayload(samplePayload())).toBe(true);
  expect(isContextPayload({})).toBe(false);
  expect(isContextPayload({ ...samplePayload(), css: undefined })).toBe(false);
  expect(isContextPayload(null)).toBe(false);
});

it('starts an optional-screenshot session and maps the png', async () => {
  const handlers = { onStatus: vi.fn(), onResult: vi.fn(), onEnd: vi.fn(), onLocked: vi.fn() };
  const signal = new AbortController().signal;
  await startBrowserContextSession(1, 10, signal, handlers);
  const options = vi.mocked(startPickerSession).mock.calls[0]![0];
  expect(options).toMatchObject({
    tabId: 1,
    windowId: 10,
    signal,
    file: '/browser-context.js',
    portPrefix: 'swiss-browser-context',
    toolName: 'Browser context',
    screenshot: 'optional',
  });

  const payload = samplePayload();
  options.onResult(payload, { png: 'data:image/png;base64,abc', clipped: false });
  expect(handlers.onResult).toHaveBeenCalledWith({ ...payload, png: 'data:image/png;base64,abc' }, undefined);
  options.onResult(payload, null, 'boom');
  expect(handlers.onResult).toHaveBeenLastCalledWith({ ...payload, png: undefined }, 'boom');
});
```

- [ ] **Step 2: Verifica che i test falliscano**

Run: `pnpm exec vitest run src/tools/browser-context/collect.test.ts src/tools/browser-context/session.test.ts`
Expected: FAIL, import `./collect` e `./session` non risolti.

- [ ] **Step 3: Implementa `collect.ts`**

```ts
import { collectRuleContext } from './css-match';
import { listSheets, scanStyleSheets, type ScanEnvironment } from './css-rules';
import { cleanMarkup } from './markup';
import { selectorPath, selectorSegment } from './path';
import { readResolvedValues } from './resolved';
import type { ContextPayload } from './types';

export function scanEnvironment(view: Window): ScanEnvironment {
  return {
    matchesMedia(query) {
      try {
        return view.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    supports(condition) {
      try {
        return (view as Window & { CSS: typeof CSS }).CSS.supports(condition);
      } catch {
        return false;
      }
    },
  };
}

export function buildContextPayload(element: Element, view: Window): ContextPayload {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const rect = element.getBoundingClientRect();
  const pageUrl = view.location.href;
  const scan = scanStyleSheets(listSheets(element.ownerDocument), scanEnvironment(view), pageUrl);
  const rules = collectRuleContext(element, scan.entries, view);
  return {
    element: selectorSegment(element),
    path: selectorPath(element),
    url: pageUrl,
    viewport: { width: view.innerWidth, height: view.innerHeight, devicePixelRatio: view.devicePixelRatio || 1 },
    box: {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    rect: {
      left: rect.left + view.scrollX,
      top: rect.top + view.scrollY,
      width: rect.width,
      height: rect.height,
      viewportWidth: view.innerWidth,
      viewportHeight: view.innerHeight,
      scrollX: view.scrollX,
      scrollY: view.scrollY,
    },
    markup: cleanMarkup(element),
    css: { ...rules, resolved: readResolvedValues(element, view) },
    unreadableSheets: scan.unreadable,
  };
}
```

- [ ] **Step 4: Implementa `session.ts`**

```ts
import { startPickerSession, type PickerEndReason, type PickerSessionControl } from '../inspect-save/picker-session';
import type { LockedPreview } from '../inspect-save/types';
import type { ContextPayload, ContextResult } from './types';

export function isContextPayload(value: unknown): value is ContextPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as ContextPayload;
  return typeof item.element === 'string'
    && typeof item.path === 'string'
    && typeof item.url === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && !!item.box
    && !!item.viewport
    && !!item.css
    && Array.isArray(item.css.matched)
    && Array.isArray(item.unreadableSheets);
}

export interface BrowserContextHandlers {
  onStatus(status: string): void;
  onResult(result: ContextResult, captureError?: string): void;
  onEnd(reason: PickerEndReason): void;
  onLocked(preview: LockedPreview): void;
}

export function startBrowserContextSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  handlers: BrowserContextHandlers,
): Promise<PickerSessionControl> {
  return startPickerSession<ContextPayload>({
    tabId,
    windowId,
    signal,
    file: '/browser-context.js',
    portPrefix: 'swiss-browser-context',
    toolName: 'Browser context',
    screenshot: 'optional',
    isPayload: isContextPayload,
    onStatus: status => handlers.onStatus(status),
    onEnd: reason => handlers.onEnd(reason),
    onLocked: preview => handlers.onLocked(preview),
    onResult: (payload, capture, captureError) => handlers.onResult({ ...payload, png: capture?.png }, captureError),
  });
}
```

- [ ] **Step 5: Crea l’entrypoint**

Crea `entrypoints/browser-context.ts`:

```ts
import { buildContextPayload } from '../src/tools/browser-context/collect';
import { runPickerHost } from '../src/tools/inspect-save/picker-host';

export default defineUnlistedScript(() => {
  runPickerHost({
    portPrefix: 'swiss-browser-context',
    scopeKey: '__swissBrowserContext',
    buildPayload: buildContextPayload,
  });
});
```

- [ ] **Step 6: Esegui test, compilazione e build**

Run: `pnpm exec vitest run src/tools/browser-context && pnpm compile && pnpm build`
Expected: test PASS; `tsc` senza errori; la build produce `.output/chrome-mv3/browser-context.js` (verifica con `ls .output/chrome-mv3/browser-context.js`).

- [ ] **Step 7: Commit**

```bash
git add src/tools/browser-context/collect.ts src/tools/browser-context/collect.test.ts src/tools/browser-context/session.ts src/tools/browser-context/session.test.ts entrypoints/browser-context.ts
git commit -m "feat: collect browser context in the page and connect the session

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Download di report e screenshot

**Files:**
- Create: `src/tools/browser-context/download.ts`
- Create: `src/tools/browser-context/download.test.ts`

**Interfaces:**
- Consumes: `formatReport`, `reportName`, `reportStamp` (Task 7); `ContextResult` (Task 3).
- Produces:
  - `DOWNLOAD_FOLDER = 'swiss-knife/browser-context'`
  - `type DownloadOutcome = 'complete' | 'no-screenshot' | 'screenshot-failed'`
  - `waitForDownload(id: number, timeoutMs?: number): Promise<boolean>`
  - `downloadReport(result: ContextResult, now?: Date): Promise<DownloadOutcome>`

- [ ] **Step 1: Scrivi il test**

Crea `src/tools/browser-context/download.test.ts`:

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  downloads: {
    download: vi.fn(),
    search: vi.fn(),
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));
vi.mock('wxt/browser', () => ({ browser: api }));

import { downloadReport, waitForDownload } from './download';
import { samplePayload } from './test-fixtures';

const texts: string[] = [];
class FakeBlob {
  constructor(parts: string[]) {
    texts.push(parts.join(''));
  }
}

const now = new Date(2026, 8, 16, 14, 30, 12);

beforeEach(() => {
  vi.clearAllMocks();
  texts.length = 0;
  vi.stubGlobal('Blob', FakeBlob);
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('saves the png first and links its final file name in the report', async () => {
  api.downloads.download.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
  api.downloads.search.mockResolvedValue([{
    id: 7,
    state: 'complete',
    filename: 'C:\\Users\\me\\Downloads\\swiss-knife\\browser-context\\card-20260916-143012 (1).png',
  }]);
  const outcome = await downloadReport({ ...samplePayload(), png: 'data:image/png;base64,abc' }, now);
  expect(outcome).toBe('complete');
  expect(api.downloads.download).toHaveBeenNthCalledWith(1, {
    url: 'data:image/png;base64,abc',
    filename: 'swiss-knife/browser-context/card-20260916-143012.png',
    saveAs: false,
    conflictAction: 'uniquify',
  });
  expect(api.downloads.download).toHaveBeenNthCalledWith(2, {
    url: 'blob:report',
    filename: 'swiss-knife/browser-context/card-20260916-143012.md',
    saveAs: false,
    conflictAction: 'uniquify',
  });
  expect(texts[0]).toContain('![Screenshot of div.card](<card-20260916-143012 (1).png>)');
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
});

it('saves only the report when there is no screenshot', async () => {
  api.downloads.download.mockResolvedValueOnce(9);
  const outcome = await downloadReport(samplePayload(), now);
  expect(outcome).toBe('no-screenshot');
  expect(api.downloads.download).toHaveBeenCalledTimes(1);
  expect(texts[0]).not.toContain('![Screenshot');
});

it('saves the report without image when the png download is interrupted', async () => {
  api.downloads.download.mockResolvedValueOnce(7).mockResolvedValueOnce(8);
  api.downloads.search.mockResolvedValue([{ id: 7, state: 'in_progress', filename: '' }]);
  api.downloads.onChanged.addListener.mockImplementation((listener: (delta: unknown) => void) => {
    queueMicrotask(() => listener({ id: 7, state: { current: 'interrupted' } }));
  });
  const outcome = await downloadReport({ ...samplePayload(), png: 'data:image/png;base64,abc' }, now);
  expect(outcome).toBe('screenshot-failed');
  expect(texts[0]).not.toContain('![Screenshot');
  expect(api.downloads.onChanged.removeListener).toHaveBeenCalled();
});

it('gives up waiting after the timeout', async () => {
  vi.useFakeTimers();
  api.downloads.search.mockResolvedValue([{ id: 3, state: 'in_progress' }]);
  const waiting = waitForDownload(3, 50);
  await vi.advanceTimersByTimeAsync(60);
  await expect(waiting).resolves.toBe(false);
});
```

- [ ] **Step 2: Verifica che il test fallisca**

Run: `pnpm exec vitest run src/tools/browser-context/download.test.ts`
Expected: FAIL, import `./download` non risolto.

- [ ] **Step 3: Implementa `download.ts`**

```ts
import { browser } from 'wxt/browser';
import { formatReport, reportName, reportStamp } from './report';
import type { ContextResult } from './types';

export const DOWNLOAD_FOLDER = 'swiss-knife/browser-context';
const WAIT_MS = 20_000;

export type DownloadOutcome = 'complete' | 'no-screenshot' | 'screenshot-failed';

interface DownloadDelta {
  id: number;
  state?: { current?: string };
}

export function waitForDownload(id: number, timeoutMs = WAIT_MS): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.downloads.onChanged.removeListener(listener);
      resolve(ok);
    };
    const listener = (delta: DownloadDelta) => {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') finish(true);
      else if (delta.state?.current === 'interrupted') finish(false);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    browser.downloads.onChanged.addListener(listener);
    // The download may already be over before the listener was attached.
    void browser.downloads.search({ id }).then(([item]) => {
      if (item?.state === 'complete') finish(true);
      else if (item?.state === 'interrupted') finish(false);
    }, () => {});
  });
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export async function downloadReport(result: ContextResult, now = new Date()): Promise<DownloadOutcome> {
  const base = `${DOWNLOAD_FOLDER}/${reportName(result.element)}-${reportStamp(now)}`;
  let screenshotFile: string | undefined;
  let outcome: DownloadOutcome = 'no-screenshot';
  if (result.png) {
    outcome = 'screenshot-failed';
    try {
      const id = await browser.downloads.download({
        url: result.png,
        filename: `${base}.png`,
        saveAs: false,
        conflictAction: 'uniquify',
      });
      if (await waitForDownload(id)) {
        const [item] = await browser.downloads.search({ id });
        screenshotFile = basename(item?.filename || `${base}.png`);
        outcome = 'complete';
      }
    } catch { /* The report is still saved, without the image. */ }
  }
  const url = URL.createObjectURL(new Blob([formatReport(result, { screenshotFile })], { type: 'text/markdown;charset=utf-8' }));
  try {
    await browser.downloads.download({
      url,
      filename: `${base}.md`,
      saveAs: false,
      conflictAction: 'uniquify',
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return outcome;
}
```

- [ ] **Step 4: Esegui i test**

Run: `pnpm exec vitest run src/tools/browser-context/download.test.ts && pnpm compile`
Expected: PASS; `tsc` senza errori.

- [ ] **Step 5: Commit**

```bash
git add src/tools/browser-context/download.ts src/tools/browser-context/download.test.ts
git commit -m "feat: download the browser context report with its screenshot

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Pannello, stili e registrazione nel catalogo

**Files:**
- Create: `src/tools/browser-context/BrowserContextTool.tsx`
- Create: `src/tools/browser-context/BrowserContextTool.test.tsx`
- Create: `src/tools/browser-context/browser-context.css`
- Create: `src/tools/browser-context/browser-context.css.test.ts`
- Modify: `src/tools/registry.ts` (import e voce in fondo)
- Modify: `src/App.test.tsx:44-52` (ordine predefinito) e nuovo test

**Interfaces:**
- Consumes: `startBrowserContextSession`, `BrowserContextHandlers` (Task 8); `PickerSessionControl`, `PickerEndReason` (Task 2); `formatReport`, `formatReportStats` (Task 7); `downloadReport` (Task 9); `ContextResult` (Task 3); `LockedPreview`, `PickerCommand` da `../inspect-save/types`; `activeTab`, `explainError` da `../../lib/browser`.
- Produces: `export function BrowserContextTool(): JSX.Element`; voce di registro `browser-context`.

- [ ] **Step 1: Scrivi il test del componente**

Crea `src/tools/browser-context/BrowserContextTool.test.tsx`:

```tsx
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureElementPng } from '../inspect-save/capture';
import { BrowserContextTool } from './BrowserContextTool';
import { downloadReport } from './download';
import { samplePayload } from './test-fixtures';

const api = vi.hoisted(() => {
  const event = () => ({ addListener: vi.fn(), removeListener: vi.fn() });
  return {
    tabs: { query: vi.fn(), connect: vi.fn(), onActivated: event(), onUpdated: event(), onRemoved: event() },
    windows: { getCurrent: vi.fn() },
    scripting: { executeScript: vi.fn() },
  };
});
vi.mock('wxt/browser', () => ({ browser: api }));
vi.mock('../inspect-save/capture', () => ({ captureElementPng: vi.fn() }));
vi.mock('./download', () => ({ downloadReport: vi.fn() }));

let root: Root;
let host: HTMLDivElement;
let message: ((value: Record<string, unknown>) => void) | undefined;
let portPostMessage: ReturnType<typeof vi.fn>;
let session = '';
const writeText = vi.fn();

function button(label: string) {
  return [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label));
}

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

async function capture(payload = samplePayload()) {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'snapshot', session, payload }));
  await flush();
}

beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(navigator, { clipboard: { writeText } });
  writeText.mockResolvedValue(undefined);
  vi.mocked(captureElementPng).mockResolvedValue({ png: 'data:image/png;base64,abc', clipped: false });
  vi.mocked(downloadReport).mockResolvedValue('complete');
  api.windows.getCurrent.mockResolvedValue({ id: 10 });
  api.tabs.query.mockResolvedValue([{ id: 1, windowId: 10, url: 'https://page.test/' }]);
  api.scripting.executeScript.mockResolvedValue([{ documentId: 'doc-1' }]);
  api.tabs.connect.mockImplementation((_id: number, options: { name: string }) => {
    session = options.name.split(':')[1]!;
    portPostMessage = vi.fn();
    return {
      disconnect: vi.fn(),
      postMessage: (value: Record<string, unknown>) => {
        portPostMessage(value);
        if (value.type === 'isolate-capture') queueMicrotask(() => message?.({ type: 'isolated', session }));
      },
      onMessage: { addListener(fn: (value: Record<string, unknown>) => void) { message = fn; } },
      onDisconnect: { addListener: vi.fn() },
    };
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<BrowserContextTool />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it('injects its own picker script', async () => {
  expect(host.querySelector('h2')?.textContent).toBe('Browser context');
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 1 }, files: ['/browser-context.js'] });
  expect(api.tabs.connect).toHaveBeenCalledWith(1, expect.objectContaining({ name: expect.stringMatching(/^swiss-browser-context:/) }));
  expect(host.textContent).toContain('Clicca un elemento');
});

it('copies the report automatically and shows the result', async () => {
  await capture();
  expect(writeText).toHaveBeenCalledTimes(1);
  const copied = writeText.mock.calls[0]![0] as string;
  expect(copied).toContain('# div.card');
  expect(copied).not.toContain('![Screenshot');
  expect(host.textContent).toContain('Report copiato negli appunti.');
  expect(host.textContent).toContain('320 × 412');
  expect(host.textContent).toMatch(/Report: \d+ KB · ~\d+ token/);
  expect(button('Copia immagine')?.disabled).toBe(false);
  expect(host.querySelector('.context-report pre')?.textContent).toBe(copied);
  expect(host.querySelector('.context-preview-box img')?.getAttribute('src')).toBe('data:image/png;base64,abc');
});

it('asks for a manual copy when the automatic copy is refused', async () => {
  writeText.mockRejectedValue(new Error('Document is not focused'));
  await capture();
  expect(host.textContent).toContain('Chrome non ha permesso la copia automatica. Premi Copia report.');
  expect(host.querySelector('textarea')).toBeNull();
  await act(async () => { button('Copia report')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.querySelector<HTMLTextAreaElement>('textarea')?.value).toContain('# div.card');
});

it('keeps the report when the screenshot fails', async () => {
  vi.mocked(captureElementPng).mockRejectedValueOnce(new Error('capture failed'));
  await capture();
  expect(host.textContent).toContain('Anteprima non disponibile: il report non include lo screenshot.');
  expect(button('Copia immagine')?.disabled).toBe(true);
  expect(writeText).toHaveBeenCalledTimes(1);
});

it('reports that the image cannot be copied', async () => {
  await capture();
  await act(async () => { button('Copia immagine')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.textContent).toContain('Impossibile copiare l’immagine. Usa Scarica report.');
});

it('downloads the report', async () => {
  await capture();
  await act(async () => { button('Scarica report')!.click(); await Promise.resolve(); });
  await flush();
  expect(downloadReport).toHaveBeenCalledWith(expect.objectContaining({ element: 'div.card', png: 'data:image/png;base64,abc' }));
  expect(host.textContent).toContain('Report salvato in Download/swiss-knife/browser-context.');
});

it('explains a download without the screenshot', async () => {
  vi.mocked(downloadReport).mockResolvedValueOnce('screenshot-failed');
  await capture();
  await act(async () => { button('Scarica report')!.click(); await Promise.resolve(); });
  await flush();
  expect(host.textContent).toContain('Screenshot non salvato; report scaricato senza immagine.');
});

it('invalidates the result when the tab changes and ignores late messages', async () => {
  await capture();
  expect(host.textContent).toContain('div.card');
  const late = session;
  await act(async () => api.tabs.onActivated.addListener.mock.calls[0]![0]({ windowId: 10 }));
  expect(host.textContent).not.toContain('div.card');
  expect(host.textContent).toContain('Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.');
  await act(async () => message?.({ type: 'snapshot', session: late, payload: samplePayload({ element: 'div.late' }) }));
  await flush();
  expect(host.textContent).not.toContain('div.late');
});

it('sends confirm from the lock bar and shows the collecting status', async () => {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'locked', session, preview: { tag: 'div', tagLabel: 'Div', selector: 'div.card', dimensions: '320 × 412' } }));
  await act(async () => { button('Conferma')!.click(); await Promise.resolve(); });
  expect(portPostMessage).toHaveBeenCalledWith({ type: 'command', session, command: 'confirm' });
  expect(host.textContent).toContain('Raccolta del contesto…');
});

it('cancels with Escape while picking', async () => {
  await act(async () => { button('Seleziona')!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(host.textContent).toContain('Selezione annullata.');
  expect(button('Seleziona')).toBeTruthy();
});
```

Crea `src/tools/browser-context/browser-context.css.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/browser-context/browser-context.css', 'utf8');

it('keeps the preview png inside the panel', () => {
  expect(css).toMatch(/\.context-preview-box\s*\{[^}]*overflow:\s*hidden/s);
  expect(css).toMatch(/\.context-preview-box img\s*\{[^}]*max-width:\s*100%/s);
  expect(css).toMatch(/\.context-preview-box img\s*\{[^}]*object-fit:\s*contain/s);
});

it('wraps long selectors and the report preview', () => {
  expect(css).toMatch(/\.context-pill\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  expect(css).toMatch(/\.context-report pre\s*\{[^}]*white-space:\s*pre-wrap/s);
  expect(css).toMatch(/\.context-report pre\s*\{[^}]*overflow-wrap:\s*anywhere/s);
});

it('does not inherit control colours', () => {
  expect(css).not.toMatch(/color:\s*inherit/);
});
```

- [ ] **Step 2: Verifica che i test falliscano**

Run: `pnpm exec vitest run src/tools/browser-context/BrowserContextTool.test.tsx src/tools/browser-context/browser-context.css.test.ts`
Expected: FAIL, import `./BrowserContextTool` non risolto e file CSS assente.

- [ ] **Step 3: Implementa il componente**

Crea `src/tools/browser-context/BrowserContextTool.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Download, Expand, Image as ImageIcon, MousePointerClick, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { activeTab, explainError } from '../../lib/browser';
import type { PickerEndReason, PickerSessionControl } from '../inspect-save/picker-session';
import type { LockedPreview, PickerCommand } from '../inspect-save/types';
import { downloadReport } from './download';
import { formatReport, formatReportStats } from './report';
import { startBrowserContextSession } from './session';
import type { ContextResult } from './types';
import './browser-context.css';

const CANCELLED = 'Selezione annullata.';
const KEY_COMMANDS: Record<string, PickerCommand> = {
  ArrowUp: 'navigate-up',
  ArrowDown: 'navigate-down',
  Enter: 'confirm',
};

export function BrowserContextTool() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const [result, setResult] = useState<ContextResult | null>(null);
  const [lockedPreview, setLockedPreview] = useState<LockedPreview | null>(null);
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const generation = useRef(0);
  const target = useRef<number | undefined>(undefined);
  const abort = useRef(new AbortController());
  const session = useRef<PickerSessionControl | null>(null);
  const hadPageStateRef = useRef(false);
  const busyRef = useRef(false);
  const lockedRef = useRef(false);
  hadPageStateRef.current = !!result || active || busy || !!lockedPreview;
  busyRef.current = busy;
  lockedRef.current = !!lockedPreview;

  const report = useMemo(() => (result ? formatReport(result) : ''), [result]);

  const resetSession = useCallback(() => {
    generation.current++;
    abort.current.abort();
    session.current?.close();
    session.current = null;
    abort.current = new AbortController();
  }, []);

  const invalidatePageState = useCallback((message?: string, clearResult = false) => {
    resetSession();
    setActive(false);
    setBusy(false);
    setLockedPreview(null);
    setDownloading(false);
    if (clearResult) {
      setResult(null);
      setFeedback('');
      setFeedbackError(false);
      setCopyFallback('');
      setPreviewOpen(false);
    }
    if (message) {
      setStatus(message);
      setStatusError(false);
    }
  }, [resetSession]);

  const sendCommand = useCallback((command: PickerCommand) => {
    if (!session.current) return;
    if (command === 'confirm' && lockedRef.current) {
      setStatus('Raccolta del contesto…');
      setStatusError(false);
    }
    session.current.sendCommand(command);
  }, []);

  useEffect(() => {
    let windowId: number | undefined;
    let disposed = false;
    void (async () => {
      try {
        const win = await browser.windows.getCurrent();
        if (!disposed) windowId = win.id;
      } catch { /* still invalidate conservatively */ }
    })();
    const invalidate = () => {
      const message = hadPageStateRef.current ? 'Scheda cambiata. Avvia lo strumento per lavorare su questa pagina.' : '';
      invalidatePageState(message || undefined, true);
    };
    const activated = (info: { windowId: number }) => {
      if (windowId === undefined || info.windowId === windowId) invalidate();
    };
    const updated = (id: number, info: { status?: string; url?: string }) => {
      if ((target.current === id || (busyRef.current && target.current === undefined)) && (info.status === 'loading' || info.url)) invalidate();
    };
    const removed = (id: number) => { if (target.current === id) invalidate(); };
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    browser.tabs.onRemoved.addListener(removed);
    return () => {
      disposed = true;
      resetSession();
      browser.tabs.onActivated.removeListener(activated);
      browser.tabs.onUpdated.removeListener(updated);
      browser.tabs.onRemoved.removeListener(removed);
    };
  }, [invalidatePageState, resetSession]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        invalidatePageState(CANCELLED);
        return;
      }
      const command = KEY_COMMANDS[event.key];
      if (!command) return;
      event.preventDefault();
      event.stopPropagation();
      sendCommand(command);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active, invalidatePageState, sendCommand]);

  function showFeedback(message: string, isError = false) {
    setFeedback(message);
    setFeedbackError(isError);
  }

  async function copyReport(text: string, automatic: boolean, gen: number) {
    try {
      await navigator.clipboard.writeText(text);
      if (gen !== generation.current) return;
      setCopyFallback('');
      showFeedback('Report copiato negli appunti.');
    } catch {
      if (gen !== generation.current) return;
      if (automatic) {
        showFeedback('Chrome non ha permesso la copia automatica. Premi Copia report.');
      } else {
        setCopyFallback(text);
        showFeedback('Impossibile scrivere negli appunti. Seleziona e copia il testo qui sotto.', true);
      }
    }
  }

  async function copyImage() {
    if (!result?.png) return;
    const gen = generation.current;
    try {
      const blob = await (await fetch(result.png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (gen === generation.current) showFeedback('Immagine copiata negli appunti.');
    } catch {
      if (gen === generation.current) showFeedback('Impossibile copiare l’immagine. Usa Scarica report.', true);
    }
  }

  async function saveReport() {
    if (!result || downloading) return;
    const gen = generation.current;
    setDownloading(true);
    try {
      const outcome = await downloadReport(result);
      if (gen !== generation.current) return;
      showFeedback(outcome === 'screenshot-failed'
        ? 'Screenshot non salvato; report scaricato senza immagine.'
        : 'Report salvato in Download/swiss-knife/browser-context.');
    } catch (reason) {
      if (gen === generation.current) showFeedback(explainError(reason), true);
    } finally {
      if (gen === generation.current) setDownloading(false);
    }
  }

  async function startPicker() {
    resetSession();
    setBusy(true);
    setActive(true);
    setStatusError(false);
    setResult(null);
    setLockedPreview(null);
    setFeedback('');
    setFeedbackError(false);
    setCopyFallback('');
    setPreviewOpen(false);
    setStatus('Avvio del selettore…');
    const gen = generation.current;
    try {
      const tab = await activeTab();
      if (gen !== generation.current) return;
      target.current = tab.id;
      if (tab.windowId == null) throw new Error('Finestra della scheda non disponibile.');
      const control = await startBrowserContextSession(tab.id, tab.windowId, abort.current.signal, {
        onStatus: next => { if (gen === generation.current) setStatus(next); },
        onLocked: preview => { if (gen === generation.current) setLockedPreview(preview); },
        onEnd: (reason: PickerEndReason) => {
          if (gen !== generation.current) return;
          setActive(false);
          setBusy(false);
          setLockedPreview(null);
          setStatusError(reason !== 'cancelled');
        },
        onResult: next => {
          if (gen !== generation.current) return;
          setResult(next);
          setLockedPreview(null);
          setActive(false);
          setBusy(false);
          setStatus('');
          setStatusError(false);
          void copyReport(formatReport(next), true, gen);
        },
      });
      if (gen !== generation.current) control.close();
      else session.current = control;
    } catch (reason) {
      if (gen === generation.current) {
        setActive(false);
        setBusy(false);
        setStatusError(true);
        setStatus(explainError(reason));
      }
    }
  }

  async function togglePicker() {
    if (active) {
      invalidatePageState(CANCELLED);
      return;
    }
    await startPicker();
  }

  return (
    <section className="context-tool" aria-label="Strumento browser context">
      <div className="section-heading context-heading">
        <h2>Browser context</h2>
        <button
          type="button"
          className={active ? 'context-action is-active' : 'context-action'}
          onClick={() => void togglePicker()}
        >
          <MousePointerClick aria-hidden="true" /> {active ? 'Clicca un elemento' : 'Seleziona'}
        </button>
      </div>
      <p className="muted">Seleziona un elemento della pagina per copiarne markup, CSS e anteprima in un formato leggibile da un agente AI.</p>

      {(status || (busy && active)) && (
        <div className={`context-status ${statusError ? 'is-error' : ''}`}>
          <p role={statusError ? 'alert' : 'status'}>{status}</p>
          {busy && active && (
            <button type="button" onClick={() => invalidatePageState(CANCELLED)}>
              <X aria-hidden="true" /> Annulla
            </button>
          )}
        </div>
      )}

      {active && lockedPreview && (
        <div className="context-lock-bar" role="toolbar" aria-label="Conferma selezione">
          <div className="context-pills">
            <span className="context-pill">{lockedPreview.selector}</span>
            <span className="context-pill">{lockedPreview.dimensions}</span>
          </div>
          <div className="context-lock-actions">
            <button type="button" onClick={() => sendCommand('navigate-up')} aria-label="Amplia la selezione">
              <ArrowUp aria-hidden="true" /> Amplia
            </button>
            <button type="button" onClick={() => sendCommand('navigate-down')} aria-label="Restringi la selezione">
              <ArrowDown aria-hidden="true" /> Restringi
            </button>
            <button type="button" className="context-action-primary" onClick={() => sendCommand('confirm')}>
              <Check aria-hidden="true" /> Conferma
            </button>
          </div>
        </div>
      )}

      {!result && !busy && !status && (
        <p className="context-empty">Premi Seleziona, fissa un elemento e premi Conferma.</p>
      )}

      {result && (
        <div className="context-summary">
          <div className="context-pills">
            <span className="context-pill">{result.element}</span>
            <span className="context-pill">{result.box.width} × {result.box.height}</span>
          </div>

          {result.png ? (
            <div className="context-preview-box">
              <img src={result.png} alt={`Anteprima di ${result.element}`} />
              <button type="button" className="context-preview-expand" aria-label="Ingrandisci anteprima" onClick={() => setPreviewOpen(true)}>
                <Expand aria-hidden="true" />
              </button>
            </div>
          ) : (
            <p className="context-warning" role="status">Anteprima non disponibile: il report non include lo screenshot.</p>
          )}

          <p className="context-stats">{formatReportStats(report)}</p>

          <div className="context-actions">
            <button type="button" className="context-action-primary" onClick={() => void copyReport(report, false, generation.current)}>
              <Copy aria-hidden="true" /> Copia report
            </button>
            <button type="button" disabled={!result.png} onClick={() => void copyImage()}>
              <ImageIcon aria-hidden="true" /> Copia immagine
            </button>
            <button type="button" disabled={downloading} onClick={() => void saveReport()}>
              <Download aria-hidden="true" /> Scarica report
            </button>
          </div>

          {feedback && (
            <p className={`context-feedback ${feedbackError ? 'is-error' : ''}`} role={feedbackError ? 'alert' : 'status'}>{feedback}</p>
          )}

          <details className="context-report">
            <summary>Anteprima report</summary>
            <pre>{report}</pre>
          </details>
        </div>
      )}

      {copyFallback && (
        <textarea className="context-copy-fallback" readOnly value={copyFallback} aria-label="Report da copiare manualmente" />
      )}

      {previewOpen && result?.png && (
        <div className="context-dialog-backdrop" role="presentation" onClick={() => setPreviewOpen(false)}>
          <section className="context-dialog" role="dialog" aria-modal="true" aria-label="Anteprima elemento" onClick={event => event.stopPropagation()}>
            <img src={result.png} alt={`Anteprima ingrandita di ${result.element}`} />
          </section>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Crea gli stili**

Crea `src/tools/browser-context/browser-context.css`:

```css
.context-tool {
  display: grid;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
  overflow-x: hidden;
}
.context-tool p { margin: 0; }
.context-heading {
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
}
.context-heading h2 {
  min-width: 0;
  flex: 1 1 auto;
  overflow-wrap: anywhere;
}
.context-action {
  flex: 0 0 auto;
  min-height: 30px;
  max-width: 100%;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: .78rem;
  font-weight: 600;
  white-space: nowrap;
}
.context-action svg { width: 15px; height: 15px; flex-shrink: 0; }
.context-action.is-active {
  background: var(--state-success, #34c759);
  color: #fff;
  border-color: transparent;
}
.context-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--muted);
  font-size: .84rem;
  min-width: 0;
}
.context-status p { min-width: 0; overflow-wrap: anywhere; }
.context-status.is-error {
  background: var(--state-danger-bg);
  color: var(--state-danger-text);
}
.context-status button {
  min-height: 28px;
  padding: 4px 10px;
  font-size: .78rem;
  flex-shrink: 0;
}
.context-lock-bar {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  min-width: 0;
}
.context-lock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.context-lock-actions button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: .82rem;
}
.context-lock-actions button svg { width: 15px; height: 15px; flex-shrink: 0; }
.context-empty {
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  color: var(--muted);
  font-size: .88rem;
  text-align: center;
}
.context-summary {
  display: grid;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
}
.context-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.context-pill {
  display: block;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  font: .78rem/1.35 var(--font-mono);
  color: var(--muted);
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
}
.context-preview-box {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: repeating-conic-gradient(rgba(0,0,0,.04) 0 25%, transparent 0 50%) 50% / 16px 16px;
}
.context-preview-box img {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: auto;
  max-height: 160px;
  object-fit: contain;
  object-position: center;
  background: transparent;
}
.context-preview-expand {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, .92);
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
}
.context-warning {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--state-warning-bg);
  color: var(--state-warning-text);
  font-size: .82rem;
  overflow-wrap: anywhere;
}
.context-stats {
  color: var(--muted);
  font: .78rem/1.35 var(--font-mono);
}
.context-actions {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.context-actions button {
  width: 100%;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  white-space: normal;
  text-align: center;
}
.context-actions button svg { width: 15px; height: 15px; flex-shrink: 0; }
.context-action-primary {
  background: var(--ios-accent, #6366f1);
  color: #fff;
  border-color: transparent;
}
.context-feedback {
  color: var(--muted);
  font-size: .82rem;
  overflow-wrap: anywhere;
}
.context-feedback.is-error { color: var(--danger); }
.context-report {
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg);
  min-width: 0;
  max-width: 100%;
}
.context-report summary {
  cursor: pointer;
  padding: 10px 12px;
  font-size: .72rem;
  font-weight: 700;
  letter-spacing: .06em;
  color: var(--muted);
}
.context-report[open] summary { border-bottom: 1px solid var(--line); }
.context-report pre {
  margin: 0;
  padding: 10px 12px;
  max-height: 280px;
  overflow: auto;
  background: var(--surface);
  color: var(--fg);
  font: .72rem/1.45 var(--font-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.context-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .45);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 20;
}
.context-dialog {
  width: min(560px, calc(100vw - 32px));
  max-width: 100%;
  max-height: min(80vh, 720px);
  overflow: auto;
  background: var(--bg);
  border-radius: 16px;
  padding: 12px;
  border: 1px solid var(--line);
  box-shadow: var(--ios-card-shadow);
}
.context-dialog img {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: auto;
  object-fit: contain;
}
.context-copy-fallback {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 120px;
  font-family: var(--font-mono);
  font-size: .75rem;
}
```

- [ ] **Step 5: Registra lo strumento e aggiorna il test del catalogo**

In `src/tools/registry.ts`:

1. Aggiungi `import { BrowserContextTool } from './browser-context/BrowserContextTool';` dopo l’import di `PasswordGeneratorTool`.
2. Sostituisci la voce finale dell’array:

```ts
}, {
  id: 'iframes', name: 'Elenca iframe', icon: PanelsTopLeft,
  description: 'Trova i contenuti incorporati e apri il loro URL in una nuova scheda.',
  component: IframeTool,
}, {
  id: 'browser-context', name: 'Browser context', icon: Crosshair,
  description: 'Seleziona un elemento e copia HTML e CSS pronti per un agente AI.',
  component: BrowserContextTool,
}];
```

3. Aggiungi `Crosshair` all’import da `lucide-react` in fondo al file, in ordine alfabetico: `import { Binary, Camera, Contrast, Crosshair, FileText, FormInput, KeyRound, Palette, PanelsTopLeft, QrCode, ScanEye, Smile, SquareDashedMousePointer } from 'lucide-react';`.

In `src/App.test.tsx`, nel test `uses the requested default order on a fresh installation`, sostituisci la riga `'Ispeziona e salva', 'Codifica e converti', 'Generatore password', 'Elenca iframe',` con `'Ispeziona e salva', 'Codifica e converti', 'Generatore password', 'Elenca iframe', 'Browser context',`. Poi aggiungi dopo il test `lists Generatore password in the catalog`:

```tsx
it('lists Browser context at the end of the catalog', () => {
  const names = [...host.querySelectorAll('.tool-card strong')].map(node => node.textContent);
  expect(names.at(-1)).toBe('Browser context');
  expect(host.querySelectorAll('#tool-browser-context')).toHaveLength(1);
});
```

- [ ] **Step 6: Esegui tutta la suite, compilazione e build**

Run: `pnpm test && pnpm compile && pnpm build`
Expected: tutti i test PASS; `tsc` senza errori; build completata.

- [ ] **Step 7: Commit**

```bash
git add src/tools/browser-context/BrowserContextTool.tsx src/tools/browser-context/BrowserContextTool.test.tsx src/tools/browser-context/browser-context.css src/tools/browser-context/browser-context.css.test.ts src/tools/registry.ts src/App.test.tsx
git commit -m "feat: add the Browser context tool to the side panel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Documentazione, licenze e verifica nel browser

**Files:**
- Modify: `README.md` (conteggio strumenti, tabella, nuova sezione)
- Modify: `AGENTS.md` (voce architettura)
- Modify: `PRIVACY.md` (elenco dei risultati temporanei, IT e EN)
- Modify: `public/THIRD-PARTY-NOTICES.txt` (voce Pinpoint)

**Interfaces:**
- Consumes: comportamento completato nei Task 1–10.
- Produces: documentazione aggiornata e build verificata.

- [ ] **Step 1: Controlla le modifiche non committate dell’utente**

Run: `git diff --stat README.md PRIVACY.md AGENTS.md public/THIRD-PARTY-NOTICES.txt`
Expected: `README.md` ha già una modifica dell’utente (riga dei link «Sito · … · Privacy»). **Non committarla senza chiedere.** Prima del commit dello Step 7 chiedi all’utente se includerla o se committare solo le altre modifiche; senza risposta, lascia `README.md` non committato e segnalalo.

- [ ] **Step 2: Aggiorna README**

In `README.md`:

1. Sostituisci `**12 strumenti per lavorare sulle pagine web**` con `**13 strumenti per lavorare sulle pagine web**`.
2. Dopo la riga di tabella `| **Elenca iframe** | … |` aggiungi:

```markdown
| **Browser context** | Seleziona un elemento e copia markup, CSS e anteprima in un report Markdown per agenti AI. |
```

3. Alla fine della sezione `### Elenca iframe`, subito prima di `## Permessi e privacy`, aggiungi:

```markdown
### Browser context

Premi **Seleziona**, fai clic su un elemento per fissarlo, regola la selezione con **Amplia**/**Restringi** (o ↑/↓) e premi **Conferma**. Il report viene copiato negli appunti, pronto da incollare in un agente AI come Claude Code, Codex, Copilot o Cursor. **Esc** annulla.

Il report è in inglese e contiene URL, viewport, dimensioni, percorso DOM, markup e le regole CSS che colpiscono l’elemento così come sono scritte, con file di origine e contesto `@media`, `@supports`, `@layer` o `@container`. Include anche le regole di altri breakpoint, gli stati `:hover`/`:focus`/`:active`, gli stili ereditati, `::before`/`::after`, i valori calcolati diversi dal default del browser e le variabili CSS usate. Dal pannello puoi copiare di nuovo il report, copiare l’immagine o scaricare `.md` e `.png` in `Download/swiss-knife/browser-context/`.

I fogli di stile cross-origin non sono leggibili e vengono elencati nel report; le condizioni `@container` non vengono valutate; il contenuto delle shadow root non compare nel markup. Il markup lungo viene tagliato a 60 KB e i `data:` URI vengono abbreviati. Il report può contenere testi e URL della pagina: controllalo prima di condividerlo. Lo strumento riprende l’approccio di [Pinpoint](https://github.com/MarcellM01/Pinpoint) (MIT).
```

- [ ] **Step 3: Aggiorna AGENTS.md**

Dopo la voce `- \`src/tools/inspect-save/\`: …` aggiungi:

```markdown
- `src/tools/inspect-save/picker-host.ts` e `picker-session.ts`: host nella pagina e sessione nel pannello condivisi dai picker con blocco e conferma. Il picker riceve la funzione che costruisce il payload; `screenshot: 'optional'` consegna il risultato anche se la cattura PNG fallisce. Riusali invece di duplicare port, isolamento e cattura.
- `src/tools/browser-context/`: report Markdown in inglese per agenti AI (markup pulito, regole CSS con origine e at-rule, stati, pseudo-elementi, ereditarietà, valori calcolati diversi dal default, variabili). `entrypoints/browser-context.ts` usa `runPickerHost` con `buildContextPayload`. Copia automatica con ripiego manuale, download in `swiss-knife/browser-context/`.
```

- [ ] **Step 4: Aggiorna PRIVACY.md**

Nella sezione italiana sostituisci `(screenshot, palette estratte, elementi ispezionati,\nelenchi di iframe)` con `(screenshot, palette estratte, elementi ispezionati,\nreport di contesto per agenti AI, elenchi di iframe)`. Nella sezione inglese `## What is processed, and where it stays` trova l’elenco equivalente dei risultati temporanei (leggi il file per il testo esatto) e aggiungi `browser context reports for AI agents` nella stessa posizione.

- [ ] **Step 5: Aggiungi la voce di licenza**

In `public/THIRD-PARTY-NOTICES.txt`, dopo l’ultima voce, aggiungi:

```text

============================================================================
Pinpoint (MarcellM01/Pinpoint)
Uso: Browser context (approccio e logica di raccolta CSS adattati)
Fonte del testo: https://github.com/MarcellM01/Pinpoint/blob/main/LICENSE
============================================================================

MIT License

Copyright (c) 2026 TinySuite

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

- [ ] **Step 6: Verifica completa e prova reale**

Run: `pnpm compile && pnpm test && pnpm build`
Expected: tutto verde.

Prova in Chrome caricando `.output/chrome-mv3` come estensione non pacchettizzata (o con lo script CDP del progetto, se l’utente lo richiede) su una pagina di prova con: una regola in un foglio esterno, una `@media` attiva e una non attiva, `@supports`, una variabile CSS, una regola `:hover`, un `::before` e un foglio cross-origin (per esempio Google Fonts). Controlla:

1. Il report copiato contiene le sezioni attese, commenti di origine, involucri at-rule e la nota sui fogli cross-origin.
2. **Scarica report** crea `.md` e `.png` in `Download/swiss-knife/browser-context/` e il link all’immagine si apre in un visualizzatore Markdown.
3. Conferma dal pulsante sulla pagina: se la copia automatica è rifiutata compare «Premi Copia report» e il pulsante funziona.
4. Cambio scheda e navigazione invalidano il risultato.
5. Regressione di Ispeziona e salva: selezione, conferma, PNG, copia e download funzionano come prima.

Annota quali prove sono state eseguite davvero e quali no.

- [ ] **Step 7: Commit**

Dopo aver chiarito con l’utente il punto dello Step 1:

```bash
git add AGENTS.md PRIVACY.md public/THIRD-PARTY-NOTICES.txt README.md
git commit -m "docs: document the Browser context tool and Pinpoint license

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Se l’utente non vuole includere la sua modifica al README, escludi `README.md` dal `git add` e segnalalo nel riepilogo finale.
