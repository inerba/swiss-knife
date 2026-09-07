# Inspect-save lock-and-confirm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a page click, pin the inspected element so the user can walk parent/child and only then confirm the PNG/Info snapshot.

**Architecture:** The picker gains a `pinned` state distinct from the existing pointer-hysteresis `locked` flag. Click calls `pin()`, not `choose()`. The port emits `locked` (preview only); `snapshot` fires only on Conferma/Invio. The side panel shows ↑ ↓ Conferma while pinned. Esc still cancels the whole session.

**Tech Stack:** WXT, Chrome MV3, React 19, TypeScript, Vitest + jsdom, Lucide (`Check`, `ArrowUp`, `ArrowDown`), pnpm.

## Global Constraints

- UI copy is Italian; icons come from `lucide-react` only.
- No new Chrome permissions. No `debugger`. No html2canvas.
- Do not change overlay visuals (guides, padding, margin, radius) or the isolated PNG pipeline.
- Header button stays «Clicca una sezione» while hover or pinned; «Seleziona» only after confirm or Esc.
- Esc / Annulla always ends the whole inspection (not back to hover).
- Existing `locked` / `shouldFollowPointer` in `picker.ts` is pointer hysteresis after ↑/↓ during hover. The new click-to-pin flag MUST be named `pinned`.
- Functions passed to `browser.scripting.executeScript` stay serializable; inspect-save keeps using `/inspect-save.js`.
- Tab/navigation change invalidates picker, locked preview, and snapshot as today.

---

## File structure

Modify:

- `src/tools/inspect-save/types.ts` — `LockedPreview`
- `src/tools/inspect-save/picker.ts` — `pinned`, `pin()`, Conferma button, click ≠ capture
- `src/tools/inspect-save/picker.test.ts` — `shouldIgnorePointerWhenPinned`
- `src/tools/inspect-save/session.ts` — handle `locked`, `onLocked`
- `entrypoints/inspect-save.ts` — forward `onLock`
- `src/tools/inspect-save/InspectSaveTool.tsx` — pinned controls
- `src/tools/inspect-save/InspectSaveTool.test.tsx` — lock / confirm / Esc / panel buttons
- `src/tools/inspect-save/inspect-save.css` — lock action row
- `README.md` — click fissa, poi Conferma

Do not modify `src/App.tsx`, `wxt.config.ts`, overlay-model, isolate-capture, or element-capture beyond what session already calls after `snapshot`.

---

### Task 1: LockedPreview type and pointer-ignore helper

**Files:**
- Modify: `src/tools/inspect-save/types.ts`
- Modify: `src/tools/inspect-save/picker.ts` (helper only)
- Test: `src/tools/inspect-save/picker.test.ts`

**Interfaces:**
- Consumes: existing `shouldFollowPointer`
- Produces:
  - `export interface LockedPreview { tag: string; tagLabel: string; selector: string; dimensions: string; }`
  - `export function shouldIgnorePointerWhenPinned(pinned: boolean): boolean`

- [ ] **Step 1: Write the failing test**

Add to `src/tools/inspect-save/picker.test.ts`:

```ts
import { shouldIgnorePointerWhenPinned } from './picker';

describe('shouldIgnorePointerWhenPinned', () => {
  it('ignores pointer moves only after the selection is pinned', () => {
    expect(shouldIgnorePointerWhenPinned(false)).toBe(false);
    expect(shouldIgnorePointerWhenPinned(true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm exec vitest run src/tools/inspect-save/picker.test.ts`

Expected: FAIL — `shouldIgnorePointerWhenPinned` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/tools/inspect-save/types.ts` after `PickerCommand`:

```ts
export interface LockedPreview {
  tag: string;
  tagLabel: string;
  selector: string;
  dimensions: string;
}
```

In `src/tools/inspect-save/picker.ts` next to `shouldFollowPointer`:

```ts
export function shouldIgnorePointerWhenPinned(pinned: boolean) {
  return pinned;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx pnpm exec vitest run src/tools/inspect-save/picker.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/inspect-save/types.ts src/tools/inspect-save/picker.ts src/tools/inspect-save/picker.test.ts
git commit -m "feat: add pinned-pointer helper and LockedPreview type"
```

---

### Task 2: Session treats `locked` as preview, not capture

**Files:**
- Modify: `src/tools/inspect-save/session.ts`
- Test: `src/tools/inspect-save/InspectSaveTool.test.tsx`

**Interfaces:**
- Consumes: `LockedPreview` from `types.ts`
- Produces: `startInspectSession(..., onLocked: (preview: LockedPreview) => void = () => {})`  
  Message `{ type: 'locked', session, preview }` does not call `captureElementPng` or `close()`.

- [ ] **Step 1: Write the failing test**

In `InspectSaveTool.test.tsx`, add a `lockedPreview` constant and this test (it will fail until the tool stores locked state; that is Task 4 — for this task only extend `session` and assert **no isolate-capture** after `locked`):

```ts
const lockedPreview = {
  tag: 'div',
  tagLabel: 'Div',
  selector: 'div.card',
  dimensions: '320 × 230',
};

it('does not capture a png when the picker only locks an element', async () => {
  const { captureElementPng } = await import('./capture');
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'locked', session, preview: lockedPreview }));
  await act(async () => Promise.resolve());
  expect(captureElementPng).not.toHaveBeenCalled();
  expect(portPostMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'isolate-capture' }));
  expect(startButton()?.textContent).toContain('Clicca una sezione');
});
```

`capture` is already mocked in this file. After Task 2, `isolate-capture` must not run on `locked`. The header label assertion already holds because `active` stays true. If `captureElementPng` is only imported via the mock, use:

```ts
import { captureElementPng } from './capture';
```

at the top of the test file (the mock already replaces it) and `expect(vi.mocked(captureElementPng)).not.toHaveBeenCalled()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx pnpm exec vitest run src/tools/inspect-save/InspectSaveTool.test.tsx`

Expected: FAIL if session currently ignores `locked` but a later snapshot-shaped handler misfires — or the test passes vacuously. If it passes because `locked` is ignored, keep the test; Task 4 will assert visible Conferma.

- [ ] **Step 3: Handle `locked` in session.ts**

Add import `LockedPreview`. Extend the signature with a last optional callback:

```ts
export async function startInspectSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: InspectSnapshot) => void,
  onEnd: (reason: 'cancelled' | 'error' | 'disconnected') => void = () => {},
  onLocked: (preview: LockedPreview) => void = () => {},
): Promise<InspectSessionControl> {
```

Add:

```ts
function isLockedPreview(value: unknown): value is LockedPreview {
  if (!value || typeof value !== 'object') return false;
  const item = value as LockedPreview;
  return typeof item.tag === 'string'
    && typeof item.tagLabel === 'string'
    && typeof item.selector === 'string'
    && typeof item.dimensions === 'string';
}
```

In `port.onMessage`, after `ready` and before `cancelled`:

```ts
} else if (message.type === 'locked' && isLockedPreview(message.preview)) {
  clearTimeout(timeout);
  onStatus('Elemento fissato. Usa ↑ ↓ per regolare, poi Conferma.');
  onLocked(message.preview);
```

Do not `close()`, do not capture.

- [ ] **Step 4: Run the lock test**

Run: `npx pnpm exec vitest run src/tools/inspect-save/InspectSaveTool.test.tsx`

Expected: the new test PASSes (no isolate-capture). Existing snapshot tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/inspect-save/session.ts src/tools/inspect-save/InspectSaveTool.test.tsx
git commit -m "feat: treat inspect locked message as preview only"
```

---

### Task 3: Picker click pins; Conferma captures

**Files:**
- Modify: `src/tools/inspect-save/picker.ts`
- Modify: `entrypoints/inspect-save.ts`
- Test: `src/tools/inspect-save/picker.test.ts` (helper already done); behavior covered by Task 4 UI tests plus this unit check if you export `previewFromElement` — prefer keeping preview building inside `pin()`.

**Interfaces:**
- Consumes: `LockedPreview`, `shouldIgnorePointerWhenPinned`, `sampleElement` (already imported)
- Produces:
  - `installInspectPicker(onPick, onCancel, onLock: (preview: LockedPreview) => void)`
  - Click / overlay (except Conferma/naviga) → `pin()`, never `choose()`
  - `handleCommand('confirm')` / Invio / button Conferma → `choose(pointed)`
  - While `pinned`, `move` returns immediately

- [ ] **Step 1: Write the failing test for ignore-when-pinned in move logic**

Already covered by `shouldIgnorePointerWhenPinned`. Add a comment in `picker.test.ts` that click-vs-choose is asserted from the panel tests. Then implement.

- [ ] **Step 2: Change `installInspectPicker` signature**

```ts
export function installInspectPicker(
  onPick: (payload: SnapshotPayload, element: Element) => void,
  onCancel: () => void,
  onLock: (preview: LockedPreview) => void,
): InspectPickerControl {
```

Add `let pinned = false;` next to `choosing`.

Import `LockedPreview` from `./types`.

In `register`, create a confirm button after `nav`:

```ts
const confirm = doc.createElement('button');
confirm.type = 'button';
confirm.textContent = 'Conferma';
confirm.setAttribute('aria-label', 'Conferma la selezione');
confirm.style.cssText = 'margin-left:auto;min-height:28px;padding:0 10px;border:0;border-radius:8px;background:#4f46e5;color:#fff;cursor:pointer;font:600 12px/1 system-ui;display:none;';
nav.append(confirm);
```

`tooltip.style.pointerEvents` stays `none` in hover; in `pin()` set `tooltip.style.pointerEvents = 'auto'`.

- [ ] **Step 3: Implement pin, ignore pointer, change click**

```ts
function previewFromElement(element: Element): LockedPreview {
  const sampled = sampleElement(element);
  const rect = element.getBoundingClientRect();
  return {
    tag: sampled.tag,
    tagLabel: sampled.tagLabel,
    selector: sampled.selector,
    dimensions: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
  };
}

function pin(element?: Element) {
  if (disposed || choosing || !element) return;
  pointed = element;
  pinned = true;
  confirm.style.display = 'inline-flex';
  tooltip.style.pointerEvents = 'auto';
  draw(element);
  try { confirm.focus({ preventScroll: true }); } catch { /* side panel may keep focus */ }
  onLock(previewFromElement(element));
}
```

`move`:

```ts
const move = (event: PointerEvent) => {
  if (disposed || choosing || pinned || fromOverlay(event)) return;
  if (shouldIgnorePointerWhenPinned(pinned)) return;
  if (!shouldFollowPointer(locked, lockX, lockY, event.clientX, event.clientY)) return;
  // ... existing hover follow
};
```

`click`:

```ts
const click = (event: MouseEvent) => {
  if (fromOverlay(event)) return;
  block(event);
  pin(pointed ?? resolveElement(event));
};
```

`expand` / `shrink`: after `draw(pointed)`, if `pinned` call `onLock(previewFromElement(pointed))` so the panel labels stay in sync.

`key`: Escape → `cancel()` (whole session). Enter → `choose(pointed)` only if `pointed` (works in hover and pinned). Arrow keys unchanged.

Confirm button:

```ts
confirm.addEventListener('click', event => navEvent(event, () => void choose(pointed)));
confirm.addEventListener('pointerdown', event => navEvent(event, () => {}));
```

Assign `handlers` as today (`choose` still confirm).

- [ ] **Step 4: Wire onLock in the content script**

```ts
pickerControl = installInspectPicker(
  (payload, element) => {
    pickedElement = element;
    send({ type: 'snapshot', payload });
  },
  () => send({ type: 'cancelled' }),
  preview => send({ type: 'locked', preview }),
);
```

- [ ] **Step 5: Compile picker**

Run: `npx pnpm compile`

Expected: no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/tools/inspect-save/picker.ts entrypoints/inspect-save.ts
git commit -m "feat: pin inspect selection on click until confirm"
```

---

### Task 4: Panel ↑ ↓ Conferma while pinned

**Files:**
- Modify: `src/tools/inspect-save/InspectSaveTool.tsx`
- Modify: `src/tools/inspect-save/inspect-save.css`
- Test: `src/tools/inspect-save/InspectSaveTool.test.tsx`

**Interfaces:**
- Consumes: `LockedPreview`, `startInspectSession` 7th argument `onLocked`
- Produces: panel state `lockedPreview: LockedPreview | null`; buttons Amplia, Restringi, Conferma

- [ ] **Step 1: Write the failing UI tests**

```ts
it('shows lock controls after locked and captures only on confirm', async () => {
  const { captureElementPng } = await import('./capture');
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'ready', session }));
  await act(async () => message?.({ type: 'locked', session, preview: lockedPreview }));
  expect(host.textContent).toContain('div.card');
  expect(host.textContent).toContain('Conferma');
  expect(host.textContent).not.toContain('Copia codice');
  expect(startButton()?.textContent).toContain('Clicca una sezione');

  const confirm = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Conferma'));
  await act(async () => { confirm!.click(); await Promise.resolve(); });
  expect(portPostMessage).toHaveBeenCalledWith({ type: 'command', session, command: 'confirm' });
  expect(vi.mocked(captureElementPng)).not.toHaveBeenCalled();

  await act(async () => message?.({ type: 'snapshot', session, payload: samplePayload }));
  await act(async () => Promise.resolve());
  expect(vi.mocked(captureElementPng)).toHaveBeenCalled();
  expect(host.textContent).toContain('Copia codice');
  expect(startButton()?.textContent).toContain('Seleziona');
});

it('sends navigate commands from the lock panel buttons', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'locked', session, preview: lockedPreview }));
  const up = [...host.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'Amplia la selezione');
  await act(async () => { up!.click(); await Promise.resolve(); });
  expect(portPostMessage).toHaveBeenCalledWith({ type: 'command', session, command: 'navigate-up' });
});

it('clears a locked preview on Escape without capturing', async () => {
  await act(async () => { startButton()!.click(); await Promise.resolve(); });
  await act(async () => message?.({ type: 'locked', session, preview: lockedPreview }));
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(host.textContent).not.toContain('Conferma');
  expect(startButton()?.textContent).toContain('Seleziona');
});
```

Import `captureElementPng` from `./capture` at the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx pnpm exec vitest run src/tools/inspect-save/InspectSaveTool.test.tsx`

Expected: FAIL — no Conferma button.

- [ ] **Step 3: Implement panel state**

```ts
import { ArrowDown, ArrowUp, Check, Copy, Download, Expand, FileCode, MousePointerClick, X } from 'lucide-react';
import type { LockedPreview, ... } from './types';
```

```ts
const [lockedPreview, setLockedPreview] = useState<LockedPreview | null>(null);
```

In `invalidatePageState` and `startPicker`, `setLockedPreview(null)`.

`hadPageStateRef.current = !!snapshot || active || busy || !!lockedPreview;`

Pass `onLocked` into `startInspectSession`:

```ts
const session = await startInspectSession(
  tab.id,
  windowId,
  abort.current.signal,
  next => { if (gen === generation.current) setStatus(next); },
  result => {
    if (gen !== generation.current) return;
    setLockedPreview(null);
    setSnapshot(result);
    setActive(false);
    setBusy(false);
    setStatus('');
    setError(false);
  },
  () => {
    if (gen !== generation.current) return;
    setLockedPreview(null);
    setActive(false);
    setBusy(false);
  },
  preview => {
    if (gen !== generation.current) return;
    setLockedPreview(preview);
  },
);
```

In the status block, when `lockedPreview` is set, render:

```tsx
{lockedPreview && active && (
  <div className="inspect-lock-bar">
    <p>
      <span className="inspect-pill">{lockedPreview.selector}</span>
      {' '}
      {lockedPreview.dimensions}
    </p>
    <div className="inspect-lock-actions">
      <button type="button" aria-label="Amplia la selezione" onClick={() => sessionClose.current?.sendCommand('navigate-up')}>
        <ArrowUp aria-hidden="true" />
      </button>
      <button type="button" aria-label="Restringi la selezione" onClick={() => sessionClose.current?.sendCommand('navigate-down')}>
        <ArrowDown aria-hidden="true" />
      </button>
      <button type="button" className="inspect-action-primary" onClick={() => sessionClose.current?.sendCommand('confirm')}>
        <Check aria-hidden="true" /> Conferma
      </button>
    </div>
  </div>
)}
```

Do not render the snapshot Info block while `active` (even if an old snapshot lingered — `startPicker` already clears it).

Empty copy:

```tsx
<p className="inspect-empty">Premi Seleziona, clicca una sezione, regola con ↑ ↓ e conferma.</p>
```

CSS in `inspect-save.css`:

```css
.inspect-lock-bar {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface);
  min-width: 0;
}
.inspect-lock-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.inspect-lock-actions button {
  min-height: 32px;
}
```

- [ ] **Step 4: Run the tool tests**

Run: `npx pnpm exec vitest run src/tools/inspect-save/InspectSaveTool.test.tsx`

Expected: PASS including lock, confirm, Esc, navigate buttons, and existing snapshot tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/inspect-save/InspectSaveTool.tsx src/tools/inspect-save/InspectSaveTool.test.tsx src/tools/inspect-save/inspect-save.css
git commit -m "feat: show inspect confirm controls after lock"
```

---

### Task 5: Docs and verification

**Files:**
- Modify: `README.md` (section Ispeziona e salva)
- Modify: `AGENTS.md` (inspect-save bullet: click pins, Conferma captures)

**Interfaces:**
- Consumes: behavior from Tasks 1–4
- Produces: docs that match the shipped flow

- [ ] **Step 1: Update README**

Replace the inspect-save how-to so it says: Seleziona → hover → click fissa (overlay resta) → ↑/↓ o pulsanti nel pannello e nella card → Conferma o Invio cattura → Esc chiude tutto. Do not say that click immediately saves.

- [ ] **Step 2: Update AGENTS.md**

In the `src/tools/inspect-save/` bullet, add that the click pins the element and snapshot/PNG run only after Conferma.

- [ ] **Step 3: Run compile, test, build**

```bash
npx pnpm compile
npx pnpm test
npx pnpm build
```

Expected: compile clean, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: describe inspect-save lock and confirm flow"
```

---

## Self-review

**Spec coverage**
- Click pins, no PNG → Tasks 2–3
- ↑/↓ after click (page card, panel, keys) → Tasks 3–4
- Conferma / Invio capture → Tasks 3–4
- Esc ends everything → Task 3 (picker cancel) + Task 4 (panel listener already calls `invalidatePageState`)
- Header label stays «Clicca una sezione» → Task 4 tests
- New Seleziona clears previous card → existing test still valid
- Overlay visuals / PNG isolation unchanged → not edited

**Name check:** `pinned` vs existing `locked` hysteresis; port message type is `locked` / `LockedPreview` as in the spec.

**No placeholders.**
