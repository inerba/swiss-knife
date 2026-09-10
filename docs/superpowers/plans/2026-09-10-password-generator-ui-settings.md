# Password Generator UI Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Includi/Regole an iOS settings list, add an editable symbol set, and add a Compila-form-style settings dialog with factory reset.

**Architecture:** Extend `PasswordOptions` with `symbolSet`. Normalize, validate, and generate from that string. Rebuild the two grouped lists in `PasswordGeneratorTool` (toggle on the right, no alphabets). Same store for panel and dialog; **Ripristina valori predefiniti** writes `defaultPasswordGeneratorPreferences`.

**Tech Stack:** WXT, React 19, TypeScript, Vitest + jsdom, existing `tool-dialog` / `dialog-backdrop` in `src/style.css`, Lucide `Settings`.

## Global Constraints

- Italian UI; Lucide icons only.
- `design.md`: toggle track 42×26, thumb 22×22, checked `translateX(16px)` and `--state-success`; inspector input 28px, radius 7px, mono 12px; card radius `--ios-card-radius`.
- One store: `passwordGeneratorPreferences`. Never persist the generated password.
- Live regen including the symbols field `input`. Copy does not regenerate.
- Factory `SYMBOLS` is `!@#$%^&*()-_=+[]{};:,.<>?`.
- Empty `symbolSet` while symbols are on: `Inserisci almeno un simbolo.`
- Do not modify `src/App.tsx`, permissions, or `AGENTS.md`.
- Do not edit `.cursor/plans/password_generator_design_69ddc24d.plan.md`.

---

## File structure

Modify:

- `src/tools/password-generator/generate.ts` — `symbolSet` on `PasswordOptions`; `normalizeSymbolSet`; pools from custom set.
- `src/tools/password-generator/generate.test.ts` — all fixtures include `symbolSet: SYMBOLS`; new cases.
- `src/tools/password-generator/preferences.ts` — default `symbolSet: SYMBOLS`; normalize.
- `src/tools/password-generator/preferences.test.ts`
- `src/tools/password-generator/password-generator.css` — iOS grouped rows, 42×26 toggles on the right.
- `src/tools/password-generator/password-generator.css.test.ts`
- `src/tools/password-generator/PasswordGeneratorTool.tsx` — layout, symbols field, settings dialog.
- `src/tools/password-generator/PasswordGeneratorTool.test.tsx`
- `README.md` — editable symbols, settings, reset.

Do not add a second preferences key.

---

### Task 1: Custom symbol set in generation

**Files:**
- Modify: `src/tools/password-generator/generate.ts`
- Modify: `src/tools/password-generator/generate.test.ts`

**Interfaces:**
- Consumes: existing `PasswordOptions` flags and `SYMBOLS`.
- Produces:
  - `PasswordOptions.symbolSet: string`
  - `export function normalizeSymbolSet(value: unknown): string`
  - `characterPools` uses `normalizeSymbolSet(options.symbolSet)` then similar-strip
  - `validateOptions` returns `Inserisci almeno un simbolo.` when `options.symbols` is true and the normalized set is empty

`normalizeSymbolSet`:

- non-string / missing → `SYMBOLS`
- otherwise: strip whitespace, keep first occurrence of each char, slice to 64
- empty string input → `''` (do not replace with `SYMBOLS`)

- [ ] **Step 1: Write the failing tests**

Add `symbolSet: SYMBOLS` to `allOn`. Then:

```ts
import { normalizeSymbolSet, SYMBOLS } from './generate';

describe('normalizeSymbolSet', () => {
  it('dedupes, strips whitespace, and preserves an explicit empty string', () => {
    expect(normalizeSymbolSet(' !aa@ @\n')).toBe('!a@');
    expect(normalizeSymbolSet(undefined)).toBe(SYMBOLS);
    expect(normalizeSymbolSet('')).toBe('');
  });
});

describe('validateOptions', () => {
  it('requires at least one symbol when the symbols group is on', () => {
    expect(validateOptions({ ...allOn, symbolSet: '' })).toBe('Inserisci almeno un simbolo.');
  });
});

describe('generatePassword', () => {
  it('draws symbols only from the custom set', () => {
    const result = generatePassword({
      ...allOn, numbers: false, lowercase: false, uppercase: false,
      excludeSimilar: false, excludeSequences: false, excludeRepeats: false,
      startWithLetter: false, symbolSet: '!@#', length: 8,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.password).toMatch(/^[!@#]{8}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tools/password-generator/generate.test.ts`

Expected: FAIL — `symbolSet` / `normalizeSymbolSet` missing.

- [ ] **Step 3: Implement**

```ts
export function normalizeSymbolSet(value: unknown) {
  if (typeof value !== 'string') return SYMBOLS;
  const unique: string[] = [];
  for (const char of value) {
    if (/\s/.test(char) || unique.includes(char)) continue;
    unique.push(char);
    if (unique.length === 64) break;
  }
  return unique.join('');
}
```

In `characterPools`:

```ts
const symbols = options.symbols ? stripSimilar(normalizeSymbolSet(options.symbolSet), options.excludeSimilar) : '';
```

In `validateOptions`, after the “no groups” check:

```ts
if (options.symbols && normalizeSymbolSet(options.symbolSet).length === 0) return 'Inserisci almeno un simbolo.';
```

Add `symbolSet: string` to `PasswordOptions`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/generate.test.ts`

Expected: PASS (update every `PasswordOptions` literal in this file with `symbolSet: SYMBOLS`).

---

### Task 2: Persist symbolSet

**Files:**
- Modify: `src/tools/password-generator/preferences.ts`
- Modify: `src/tools/password-generator/preferences.test.ts`

**Interfaces:**
- Consumes: `normalizeSymbolSet`, `SYMBOLS`, `PasswordOptions`
- Produces: `defaultPasswordGeneratorPreferences.symbolSet === SYMBOLS`; normalize copies `symbolSet` via `normalizeSymbolSet`

- [ ] **Step 1: Write the failing tests**

```ts
it('keeps an explicit empty symbol set and ignores a stored password', () => {
  const value = { ...defaultPasswordGeneratorPreferences, symbolSet: '', password: 'N0tSaved!' };
  expect(normalizePasswordGeneratorPreferences(value)).toEqual({ ...defaultPasswordGeneratorPreferences, symbolSet: '' });
});

it('fills a missing symbol set with the factory alphabet', () => {
  const { symbolSet: _, ...rest } = defaultPasswordGeneratorPreferences;
  expect(normalizePasswordGeneratorPreferences(rest).symbolSet).toBe(defaultPasswordGeneratorPreferences.symbolSet);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/password-generator/preferences.test.ts`

Expected: FAIL until `symbolSet` exists on defaults.

- [ ] **Step 3: Implement**

```ts
export const defaultPasswordGeneratorPreferences: PasswordGeneratorPreferences = {
  length: 16, numbers: true, lowercase: true, uppercase: true, symbols: true,
  symbolSet: SYMBOLS,
  excludeSimilar: true, excludeSequences: true, excludeRepeats: false, startWithLetter: true,
};
```

In `normalizePasswordGeneratorPreferences`:

```ts
symbolSet: Object.prototype.hasOwnProperty.call(raw, 'symbolSet') ? normalizeSymbolSet(raw.symbolSet) : SYMBOLS,
```

Use `hasOwnProperty` so `symbolSet: ''` is kept and a missing key becomes `SYMBOLS`. Import `SYMBOLS` and `normalizeSymbolSet` from `./generate`.

- [ ] **Step 4: Run tests**

Run: `pnpm test src/tools/password-generator/preferences.test.ts src/tools/password-generator`

Expected: PASS, including existing UI tests once defaults include `symbolSet`.

---

### Task 3: iOS grouped-list CSS

**Files:**
- Modify: `src/tools/password-generator/password-generator.css`
- Modify: `src/tools/password-generator/password-generator.css.test.ts`

**Interfaces:** none. Classes: `.pw-list`, `.pw-row`, `.pw-row-symbols`, `.pw-toggle` (checkbox only, 42×26, no `grid-row: 1 / span 2`).

- [ ] **Step 1: Replace the CSS contract test**

```ts
it('uses iOS grouped rows, 42px success toggles on the right, and inspector symbol input', () => {
  expect(css).toMatch(/\.pw-list\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).toMatch(/\.pw-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
  expect(css).toMatch(/\.pw-toggle\s*\{[^}]*width:\s*42px/s);
  expect(css).toMatch(/\.pw-toggle\s*\{[^}]*height:\s*26px/s);
  expect(css).toMatch(/\.pw-toggle:checked::before\s*\{[^}]*translateX\(16px\)/s);
  expect(css).toMatch(/\.pw-toggle:checked\s*\{[^}]*background:\s*var\(--state-success\)/s);
  expect(css).not.toMatch(/grid-row:\s*1\s*\/\s*span 2/);
  expect(css).toMatch(/#pw-symbols-set\s*\{[^}]*font-family:\s*var\(--font-mono\)/s);
  expect(css).toMatch(/#pw-symbols-set\s*\{[^}]*min-height:\s*28px/s);
  expect(css).not.toMatch(/\.pw-toggle:checked\s*\{[^}]*background:\s*var\(--accent\)/s);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/password-generator/password-generator.css.test.ts`

Expected: FAIL against the current left-toggle CSS.

- [ ] **Step 3: Restyle**

- `.pw-list`: white card, `border-radius: var(--ios-card-radius)`, `border: 1px solid var(--ui-border)`, overflow hidden, no extra padding on the fieldset (legend outside or as first padded caption).
- `.pw-row`: `grid-template-columns: minmax(0,1fr) auto`, `align-items: center`, `padding: 10px 12px`, divider `border-bottom: 1px solid var(--ui-border-muted)`.
- Label stack left: title 13px, `small` 11px muted, no wrap dump.
- `.pw-toggle` is only the checkbox: 42×26, radius 26px, thumb 22×22 at 2px, checked background `--state-success`, `::before { transform: translateX(16px) }`.
- `.pw-row-symbols`: areas `label toggle` / `field field`. `#pw-symbols-set` inspector input, width 100%, mono 12px, height 28px, radius 7px, disabled opacity .55.
- Remove `.pw-toggle { grid-row: 1 / span 2 }` and left-side 36×22 rules.

- [ ] **Step 4: Run CSS test**

Run: `pnpm test src/tools/password-generator/password-generator.css.test.ts`

Expected: PASS

---

### Task 4: Panel layout, symbols field, settings dialog

**Files:**
- Modify: `src/tools/password-generator/PasswordGeneratorTool.tsx`
- Modify: `src/tools/password-generator/PasswordGeneratorTool.test.tsx`

**Interfaces:**
- Consumes: `SYMBOLS`, `normalizeSymbolSet`, `defaultPasswordGeneratorPreferences`, `generatePassword`
- Produces: `#pw-symbols-set`, settings `role="dialog"` titled Impostazioni generatore, button Ripristina valori predefiniti

- [ ] **Step 1: Write the failing UI tests**

Keep existing tests. Add:

```ts
it('does not dump letter alphabets and live-updates from the symbols field', async () => {
  expect(host.textContent).not.toContain('abcdefghijklmnopqrstuvwxyz');
  const field = host.querySelector<HTMLInputElement>('#pw-symbols-set')!;
  expect(field.value).toBe('!@#$%^&*()-_=+[]{};:,.<>?');
  await act(async () => {
    field.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '!?');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await toggle('pw-numbers');
  await toggle('pw-lowercase');
  await toggle('pw-uppercase');
  expect(valueField().value).toMatch(/^[!?]{16}$/);
});

it('opens settings and restores factory defaults including the symbol set', async () => {
  await toggle('pw-repeats');
  const open = host.querySelector<HTMLButtonElement>('[aria-label="Impostazioni generatore password"]')!;
  await act(async () => open.click());
  expect(host.querySelector('#pw-settings-title')?.textContent).toBe('Impostazioni generatore');
  const restore = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Ripristina valori predefiniti'))!;
  await act(async () => restore.click());
  expect(host.querySelector<HTMLInputElement>('#pw-repeats')!.checked).toBe(false);
  expect(host.querySelector<HTMLInputElement>('#pw-symbols-set')!.value).toBe('!@#$%^&*()-_=+[]{};:,.<>?');
  expect(host.querySelector<HTMLInputElement>('#pw-length-input')!.value).toBe('16');
});
```

Empty symbols case:

```ts
it('shows an inline error when symbols are on and the set is empty', async () => {
  const field = host.querySelector<HTMLInputElement>('#pw-symbols-set')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(valueField().value).toBe('');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Inserisci almeno un simbolo.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tools/password-generator/PasswordGeneratorTool.test.tsx`

Expected: FAIL — no `#pw-symbols-set` / settings button.

- [ ] **Step 3: Implement the component**

Header:

```tsx
<div className="section-heading">
  <h2 id="pw-title"><KeyRound aria-hidden="true" /> Generatore password</h2>
  <button type="button" className="icon-button" aria-label="Impostazioni generatore password" onClick={() => setSettings(true)}><Settings /></button>
</div>
```

Replace the two `.pw-panel.pw-rows` fieldsets with `.pw-list` lists:

- Include rows: Numeri / Lettere minuscole / Lettere maiuscole without `<small>` alphabets.
- Simboli row: label, `#pw-symbols` toggle, `#pw-symbols-set` `value={options.symbolSet}` `disabled={!options.symbols}` `onInput` → `apply({ ...options, symbolSet: (event.target as HTMLInputElement).value })` (store the raw field string; `generatePassword` / validate use `normalizeSymbolSet`). Showing raw while typing is OK; after debounce persist `normalizeSymbolSet` **or** persist raw and normalize on load. Spec: persist normalized unique chars, empty stays empty. On each input call `apply({ ...options, symbolSet: normalizeSymbolSet(event.target.value) })` except that would prevent typing spaces (stripped immediately). **Keep the visible field as `options.symbolSet` already normalized on each input** (spaces vanish as typed — acceptable) OR keep a local `symbolDraft` and normalize on blur/save.

Use a `symbolDraft` string in React state, initialized from options. `onInput` updates draft and `apply({ ...options, symbolSet: normalizeSymbolSet(event.target.value) })` for generation (empty draft → empty set → error). Display `symbolDraft` in the input so the user can type. On restore defaults, set draft to `SYMBOLS`.

Settings dialog (reuse `dialog-backdrop` / `tool-dialog`): duplicate length + include + rules controls bound to the same `apply`, plus:

```tsx
<button type="button" onClick={() => { apply(defaultPasswordGeneratorPreferences); setSymbolDraft(SYMBOLS); }}>Ripristina valori predefiniti</button>
<button type="button" onClick={() => setSettings(false)}>Chiudi</button>
```

Ids in the dialog must not collide: prefix `pw-settings-` for dialog inputs (`pw-settings-numbers`, …). Main panel keeps `pw-numbers`, `pw-symbols-set` (one symbols field on the panel is enough for the test; dialog can use `pw-settings-symbols-set` synced to the same state).

Reset must update both panel and dialog fields because they share `options`.

- [ ] **Step 4: Run UI tests**

Run: `pnpm test src/tools/password-generator/PasswordGeneratorTool.test.tsx`

Expected: PASS. The live-symbols test turns off the other three groups after setting `!?`; length stays 16.

---

### Task 5: README

**Files:**
- Modify: `README.md` section **Generatore password**

Add: you can edit the symbol alphabet in the Simboli row; the gear opens settings with the same options; **Ripristina valori predefiniti** restores factory values including symbols. Still no password in storage.

- [ ] **Step 1: Update the section**
- [ ] **Step 2: `pnpm compile` && `pnpm test` && `pnpm build`**

Expected: compile clean, all tests pass, WXT build succeeds.

---

## Spec coverage

- iOS rows, no alphabets, 42×26 toggles → Task 3–4
- Editable `symbolSet`, empty error, custom generation → Task 1–4
- Settings dialog + factory reset, one store → Task 4
- Preferences normalize empty vs missing → Task 2
- README → Task 5
