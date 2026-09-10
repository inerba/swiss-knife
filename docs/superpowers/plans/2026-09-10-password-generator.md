# Password Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a catalog tool that generates cryptographically secure passwords in the side panel, with live controls, copy/hide, strength feedback, and preferences that never store the password.

**Architecture:** New module `src/tools/password-generator/` with pure generation (Web Crypto + rejection sampling), strength rating, local preferences, and a compact panel UI. Register once at the end of `src/tools/registry.ts`. No `App.tsx` branches, no page scripts, no new permissions, no extra npm dependencies.

**Tech Stack:** WXT, Chrome MV3, React 19, TypeScript, Vitest + jsdom, `crypto.getRandomValues()`, Lucide `KeyRound` / `LockKeyhole` / `Eye` / `EyeOff` / `RefreshCw` / `Copy` / `ShieldCheck`, pnpm.

## Global Constraints

- UI copy is Italian; visible icons come from `lucide-react` only.
- Tool `id` is `password-generator`; catalog name is `Generatore password`; icon is `KeyRound`.
- Randomness: only `crypto.getRandomValues()`. Never `Math.random()`. Uniform index via 32-bit rejection sampling.
- Live regeneration on every control change, including range `input`. Copy must not regenerate. Hide/show must not change the value.
- Persist options under `passwordGeneratorPreferences`; never persist the generated password.
- Debounce preference writes by 300 ms.
- `design.md` wins over the visual mockup: success-green iOS toggles, pill buttons 30px, card radius `--ios-card-radius`, indigo accent only on primary actions.
- No new Chrome permissions. No page access. No logging of passwords.

---

## File structure

Create:

- `src/tools/password-generator/generate.ts` — alphabets, validation, unbiased sampling, constraints, shuffle.
- `src/tools/password-generator/generate.test.ts`
- `src/tools/password-generator/strength.ts` — Debole / Media / Buona / Robusta.
- `src/tools/password-generator/strength.test.ts`
- `src/tools/password-generator/preferences.ts` — storage key, defaults, normalize, load/save.
- `src/tools/password-generator/preferences.test.ts`
- `src/tools/password-generator/PasswordGeneratorTool.tsx`
- `src/tools/password-generator/PasswordGeneratorTool.test.tsx`
- `src/tools/password-generator/password-generator.css`
- `src/tools/password-generator/password-generator.css.test.ts`

Modify:

- `src/tools/registry.ts` — one new entry at the end of `tools`; import `KeyRound`.
- `src/App.test.tsx` — catalog lists Generatore password; opening it does not write the password to storage.
- `README.md` — intro list plus a section after Codifica.

Do not modify `src/App.tsx`, `wxt.config.ts`, `AGENTS.md`, or `package.json`.

---

### Task 1: Unbiased generation and validation

**Files:**
- Create: `src/tools/password-generator/generate.test.ts`
- Create: `src/tools/password-generator/generate.ts`

**Interfaces:**
- Consumes: `crypto.getRandomValues` on `Uint32Array`.
- Produces:
  - `export const MIN_LENGTH = 4`
  - `export const MAX_LENGTH = 64`
  - `export const SEQUENCE_ATTEMPTS = 200`
  - `export const DIGITS = '0123456789'`
  - `export const LOWER = 'abcdefghijklmnopqrstuvwxyz'`
  - `export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'`
  - `export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?'`
  - `export const SIMILAR = '0Oo1lIi'`
  - `export type PasswordOptions` with `length`, `numbers`, `lowercase`, `uppercase`, `symbols`, `excludeSimilar`, `excludeSequences`, `excludeRepeats`, `startWithLetter`
  - `export type GenerateResult = { ok: true; password: string } | { ok: false; error: string }`
  - `export function randomIndex(n: number): number`
  - `export function characterPools(options: PasswordOptions)` returning `{ digits, lower, upper, symbols, letters, combined, active: Array<'digits' | 'lower' | 'upper' | 'symbols'> }`
  - `export function validateOptions(options: PasswordOptions): string | null`
  - `export function hasSequence(password: string): boolean`
  - `export function generatePassword(options: PasswordOptions): GenerateResult`

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIGITS, LOWER, MAX_LENGTH, MIN_LENGTH, SYMBOLS, UPPER,
  characterPools, generatePassword, hasSequence, randomIndex, validateOptions,
  type PasswordOptions,
} from './generate';

const allOn: PasswordOptions = {
  length: 16, numbers: true, lowercase: true, uppercase: true, symbols: true,
  excludeSimilar: true, excludeSequences: true, excludeRepeats: false, startWithLetter: true,
};

afterEach(() => { vi.restoreAllMocks(); });

function feedUint32(...values: number[]) {
  let i = 0;
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(target => {
    const view = target as Uint32Array;
    view[0] = values[Math.min(i, values.length - 1)]!;
    i++;
    return target;
  });
}

describe('randomIndex', () => {
  it('rejects values at or above the unbiased threshold then uses modulo', () => {
    const n = 3;
    const threshold = Math.floor(0x100000000 / n) * n;
    feedUint32(threshold, 1);
    expect(randomIndex(n)).toBe(1);
    expect(crypto.getRandomValues).toHaveBeenCalledTimes(2);
  });
});

describe('validateOptions', () => {
  it('requires at least one character group', () => {
    expect(validateOptions({ ...allOn, numbers: false, lowercase: false, uppercase: false, symbols: false }))
      .toBe('Seleziona almeno un gruppo di caratteri.');
  });
  it('rejects length shorter than the number of active groups', () => {
    expect(validateOptions({ ...allOn, length: 3 })).toBe('La lunghezza è troppo corta per i gruppi selezionati.');
  });
  it('requires letters when the password must start with a letter', () => {
    expect(validateOptions({ ...allOn, lowercase: false, uppercase: false }))
      .toBe('Attiva le lettere minuscole o maiuscole.');
  });
  it('rejects unique-character length above the filtered pool', () => {
    expect(validateOptions({ ...allOn, numbers: false, uppercase: false, symbols: false, lowercase: true, excludeSimilar: true, excludeRepeats: true, length: 24 }))
      .toBe('Regole troppo restrittive.');
  });
});

describe('hasSequence', () => {
  it('detects forward and reverse letter and digit runs of three', () => {
    expect(hasSequence('abcx')).toBe(true);
    expect(hasSequence('cbax')).toBe(true);
    expect(hasSequence('x123')).toBe(true);
    expect(hasSequence('x321')).toBe(true);
    expect(hasSequence('x890')).toBe(false);
    expect(hasSequence('aaa!')).toBe(false);
  });
});

describe('generatePassword', () => {
  it('includes every selected category, starts with a letter, and omits similar characters', () => {
    for (let i = 0; i < 20; i++) {
      const result = generatePassword(allOn);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.password).toHaveLength(16);
      expect(result.password).toMatch(/[2-9]/);
      expect(result.password).toMatch(/[a-hjkmnp-z]/);
      expect(result.password).toMatch(/[A-HJ-NP-Z]/);
      expect(result.password).toMatch(/[!@#$%^&*()\-_=+[\]{};:,.<>?]/);
      expect(result.password[0]).toMatch(/[a-zA-Z]/);
      expect(result.password).not.toMatch(/[0Oo1lIi]/);
      expect(hasSequence(result.password)).toBe(false);
    }
  });
  it('never repeats characters when that rule is on', () => {
    const result = generatePassword({ ...allOn, excludeRepeats: true, excludeSequences: false, length: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.password).size).toBe(20);
  });
});

describe('characterPools', () => {
  it('exposes the four default alphabets and strips similar glyphs', () => {
    expect(DIGITS + LOWER + UPPER + SYMBOLS).toContain('a');
    const pools = characterPools(allOn);
    expect(pools.digits).toBe('23456789');
    expect(pools.lower).not.toMatch(/[oil]/);
    expect(pools.active).toEqual(['digits', 'lower', 'upper', 'symbols']);
    expect(MIN_LENGTH).toBe(4);
    expect(MAX_LENGTH).toBe(64);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tools/password-generator/generate.test.ts`

Expected: FAIL because `./generate` cannot be resolved.

- [ ] **Step 3: Write the implementation**

```ts
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 64;
export const SEQUENCE_ATTEMPTS = 200;
export const DIGITS = '0123456789';
export const LOWER = 'abcdefghijklmnopqrstuvwxyz';
export const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';
export const SIMILAR = '0Oo1lIi';

export type PasswordOptions = {
  length: number;
  numbers: boolean;
  lowercase: boolean;
  uppercase: boolean;
  symbols: boolean;
  excludeSimilar: boolean;
  excludeSequences: boolean;
  excludeRepeats: boolean;
  startWithLetter: boolean;
};

export type GenerateResult = { ok: true; password: string } | { ok: false; error: string };

type PoolName = 'digits' | 'lower' | 'upper' | 'symbols';

export function randomIndex(n: number) {
  if (n < 1) throw new Error('Generazione non disponibile in questo ambiente.');
  const threshold = Math.floor(0x100000000 / n) * n;
  const view = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(view);
    if (view[0]! < threshold) return view[0]! % n;
  }
}

function stripSimilar(alphabet: string, excludeSimilar: boolean) {
  return excludeSimilar ? [...alphabet].filter(char => !SIMILAR.includes(char)).join('') : alphabet;
}

function pick(alphabet: string) {
  return alphabet[randomIndex(alphabet.length)]!;
}

export function characterPools(options: PasswordOptions) {
  const digits = options.numbers ? stripSimilar(DIGITS, options.excludeSimilar) : '';
  const lower = options.lowercase ? stripSimilar(LOWER, options.excludeSimilar) : '';
  const upper = options.uppercase ? stripSimilar(UPPER, options.excludeSimilar) : '';
  const symbols = options.symbols ? stripSimilar(SYMBOLS, options.excludeSimilar) : '';
  const active = (['digits', 'lower', 'upper', 'symbols'] as const).filter(name => ({ digits, lower, upper, symbols }[name]).length > 0);
  return { digits, lower, upper, symbols, letters: lower + upper, combined: digits + lower + upper + symbols, active };
}

function poolOf(pools: ReturnType<typeof characterPools>, name: PoolName) {
  return pools[name];
}

export function validateOptions(options: PasswordOptions) {
  const selected = [options.numbers, options.lowercase, options.uppercase, options.symbols].filter(Boolean).length;
  if (selected === 0) return 'Seleziona almeno un gruppo di caratteri.';
  const pools = characterPools(options);
  if (pools.active.length === 0) return 'Regole troppo restrittive.';
  if (options.length < pools.active.length) return 'La lunghezza è troppo corta per i gruppi selezionati.';
  if (options.startWithLetter && pools.letters.length === 0) return 'Attiva le lettere minuscole o maiuscole.';
  if (options.excludeRepeats && options.length > pools.combined.length) return 'Regole troppo restrittive.';
  return null;
}

function sequenceCode(char: string) {
  if (/[0-9]/.test(char)) return { kind: 'digit' as const, value: char.charCodeAt(0) };
  if (/[a-z]/i.test(char)) return { kind: 'letter' as const, value: char.toLowerCase().charCodeAt(0) };
  return null;
}

export function hasSequence(password: string) {
  for (let i = 0; i < password.length - 2; i++) {
    const a = sequenceCode(password[i]!);
    const b = sequenceCode(password[i + 1]!);
    const c = sequenceCode(password[i + 2]!);
    if (!a || !b || !c || a.kind !== b.kind || b.kind !== c.kind) continue;
    if (b.value - a.value === 1 && c.value - b.value === 1) return true;
    if (b.value - a.value === -1 && c.value - b.value === -1) return true;
  }
  return false;
}

function shuffleTail(chars: string[], start: number) {
  for (let i = chars.length - 1; i > start; i--) {
    const j = start + randomIndex(i - start + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
}

function take(alphabet: string, used: Set<string>, unique: boolean) {
  const available = unique ? [...alphabet].filter(char => !used.has(char)).join('') : alphabet;
  if (!available) return null;
  const char = pick(available);
  if (unique) used.add(char);
  return char;
}

function buildPassword(options: PasswordOptions) {
  const pools = characterPools(options);
  const used = new Set<string>();
  const unique = options.excludeRepeats;
  const chars: string[] = [];
  if (options.startWithLetter) {
    const first = take(pools.letters, used, unique);
    if (!first) return null;
    chars.push(first);
  }
  for (const name of pools.active) {
    const alphabet = poolOf(pools, name);
    if (chars.some(char => alphabet.includes(char))) continue;
    const next = take(alphabet, used, unique);
    if (!next) return null;
    chars.push(next);
  }
  while (chars.length < options.length) {
    const next = take(pools.combined, used, unique);
    if (!next) return null;
    chars.push(next);
  }
  shuffleTail(chars, options.startWithLetter ? 1 : 0);
  return chars.join('');
}

export function generatePassword(options: PasswordOptions): GenerateResult {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    return { ok: false, error: 'Generazione non disponibile in questo ambiente.' };
  }
  const error = validateOptions(options);
  if (error) return { ok: false, error };
  const attempts = options.excludeSequences ? SEQUENCE_ATTEMPTS : 1;
  for (let i = 0; i < attempts; i++) {
    const password = buildPassword(options);
    if (!password) return { ok: false, error: 'Regole troppo restrittive.' };
    if (!options.excludeSequences || !hasSequence(password)) return { ok: true, password };
  }
  return { ok: false, error: 'Regole troppo restrittive.' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/generate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/password-generator/generate.ts src/tools/password-generator/generate.test.ts
git commit -m "feat: add unbiased local password generation"
```

Skip this commit unless the user asked for implementation commits. The spec commit already landed; keep later code uncommitted if the working tree has unrelated staged work.

---

### Task 2: Strength rating

**Files:**
- Create: `src/tools/password-generator/strength.test.ts`
- Create: `src/tools/password-generator/strength.ts`

**Interfaces:**
- Consumes: `DIGITS`, `LOWER`, `UPPER`, `SYMBOLS`, `hasSequence` from `generate.ts`
- Produces:
  - `export type PasswordStrength = 'Debole' | 'Media' | 'Buona' | 'Robusta'`
  - `export function ratePassword(password: string): PasswordStrength`

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, it } from 'vitest';
import { ratePassword } from './strength';

it('rates short passwords as Debole even with mixed categories', () => {
  expect(ratePassword('Ab1!xyz')).toBe('Debole');
});

it('rates a 16-character four-category password without runs or repeats as Robusta', () => {
  expect(ratePassword('Kd9!mP2@qL7#zX4$')).toBe('Robusta');
});

it('drops a step when a sequence or a repeated character is present', () => {
  expect(ratePassword('Kd9!mP2@qL7#abc$')).toBe('Buona');
  expect(ratePassword('Kd9!mP2@qL7#zX4K')).toBe('Buona');
});
```

Verify `Kd9!mP2@qL7#zX4$`: length 16 (+3), four categories (+2), no sequence, no repeat → 5 → Robusta.

`Kd9!mP2@qL7#abc$`: has `abc` → 4 → Buona.

`Kd9!mP2@qL7#zX4K`: second `K` → 4 → Buona.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/password-generator/strength.test.ts`

Expected: FAIL because `./strength` cannot be resolved.

- [ ] **Step 3: Write the implementation**

```ts
import { DIGITS, LOWER, SYMBOLS, UPPER, hasSequence } from './generate';

export type PasswordStrength = 'Debole' | 'Media' | 'Buona' | 'Robusta';

function categories(password: string) {
  return [DIGITS, LOWER, UPPER, SYMBOLS].filter(alphabet => [...password].some(char => alphabet.includes(char))).length;
}

export function ratePassword(password: string): PasswordStrength {
  if (password.length < 8) return 'Debole';
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  const count = categories(password);
  if (count >= 3) score++;
  if (count >= 4) score++;
  if (hasSequence(password)) score = Math.max(0, score - 1);
  if (new Set(password).size < password.length) score = Math.max(0, score - 1);
  if (score <= 1) return 'Debole';
  if (score === 2) return 'Media';
  if (score === 3) return 'Buona';
  return 'Robusta';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/strength.test.ts`

Expected: PASS

---

### Task 3: Preferences without the password

**Files:**
- Create: `src/tools/password-generator/preferences.test.ts`
- Create: `src/tools/password-generator/preferences.ts`

**Interfaces:**
- Consumes: `PasswordOptions`, `MIN_LENGTH`, `MAX_LENGTH` from `generate.ts`; `browser` from `wxt/browser`
- Produces:
  - `export const PASSWORD_GENERATOR_PREFERENCES_KEY = 'passwordGeneratorPreferences'`
  - `export type PasswordGeneratorPreferences = PasswordOptions`
  - `export const defaultPasswordGeneratorPreferences: PasswordGeneratorPreferences`
  - `export function normalizePasswordGeneratorPreferences(value: unknown): PasswordGeneratorPreferences`
  - `export async function loadPasswordGeneratorPreferences()`
  - `export async function savePasswordGeneratorPreferences(value: PasswordGeneratorPreferences)`

Defaults: `length: 16`, four groups `true`, `excludeSimilar: true`, `excludeSequences: true`, `excludeRepeats: false`, `startWithLetter: true`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { defaultPasswordGeneratorPreferences, normalizePasswordGeneratorPreferences } from './preferences';

describe('password generator preferences', () => {
  it('uses safe defaults for absent or invalid stored values', () => {
    expect(normalizePasswordGeneratorPreferences(undefined)).toEqual(defaultPasswordGeneratorPreferences);
    expect(normalizePasswordGeneratorPreferences({ length: 99, numbers: 'yes', password: 'secret' })).toEqual(defaultPasswordGeneratorPreferences);
  });
  it('keeps a valid option set and ignores a stored password field', () => {
    const value = { ...defaultPasswordGeneratorPreferences, length: 24, excludeRepeats: true, password: 'N0tSaved!' };
    expect(normalizePasswordGeneratorPreferences(value)).toEqual({ ...defaultPasswordGeneratorPreferences, length: 24, excludeRepeats: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/password-generator/preferences.test.ts`

Expected: FAIL because `./preferences` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Follow `src/tools/emoji/preferences.ts`: `browser.storage.local.get/set` with the key above. `normalize` reads each boolean with `=== true` / `=== false` (missing keys fall back to defaults). `length` must be an integer in `MIN_LENGTH..MAX_LENGTH`. Extra keys such as `password` are dropped because the return object is built field-by-field.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/preferences.test.ts`

Expected: PASS

---

### Task 4: Panel CSS tokens

**Files:**
- Create: `src/tools/password-generator/password-generator.css.test.ts`
- Create: `src/tools/password-generator/password-generator.css`

**Interfaces:** none (stylesheet only). Classes: `.pw-tool`, `.pw-card`, `.pw-toggle input:checked`, `.pw-generate`, `.pw-strength`.

- [ ] **Step 1: Write the failing CSS contract tests**

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/tools/password-generator/password-generator.css', 'utf8');

it('uses design-system cards, pills and success toggles instead of the mockup indigo switches', () => {
  expect(css).toMatch(/\.pw-card\s*\{[^}]*border-radius:\s*var\(--ios-card-radius\)/s);
  expect(css).toMatch(/\.pw-generate\s*\{[^}]*border-radius:\s*999px/s);
  expect(css).toMatch(/\.pw-toggle input:checked\s*\{[^}]*background:\s*var\(--state-success\)/s);
  expect(css).not.toMatch(/\.pw-toggle input:checked\s*\{[^}]*background:\s*#6366f1/s);
  expect(css).not.toMatch(/\.pw-toggle input:checked\s*\{[^}]*background:\s*var\(--accent\)/s);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/tools/password-generator/password-generator.css.test.ts`

Expected: FAIL (file missing).

- [ ] **Step 3: Write CSS**

Reuse codec spacing (`display: grid; gap: 12px`), inspector-like number input (`border-radius: 7px; min-height: 28px`), range `accent-color: var(--accent)`, compact iOS toggle (track 36×22, thumb 18×18, checked `background: var(--state-success)` and `translateX(14px)`). Primary **Genera** uses `--accent` like `.codec-submit`. Password field uses `--font-mono` and `overflow-wrap: anywhere`. Strength uses semantic state colors. Include `@media (prefers-reduced-motion: reduce)` to drop transitions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/password-generator.css.test.ts`

Expected: PASS

---

### Task 5: Tool UI

**Files:**
- Create: `src/tools/password-generator/PasswordGeneratorTool.test.tsx`
- Create: `src/tools/password-generator/PasswordGeneratorTool.tsx`

**Interfaces:**
- Consumes: `generatePassword`, `MIN_LENGTH`, `MAX_LENGTH`, `characterPools`, `type PasswordOptions` from `generate.ts`; `ratePassword` from `strength.ts`; `defaultPasswordGeneratorPreferences`, `loadPasswordGeneratorPreferences`, `savePasswordGeneratorPreferences` from `preferences.ts`
- Produces: `export function PasswordGeneratorTool()`

- [ ] **Step 1: Write the failing UI tests**

Mock preferences like EmojiTool: `load` resolves to defaults, `save` is a spy. Mock clipboard `writeText`. Render with `createRoot`.

Cover:

1. On mount a 16-character password is in `#pw-value`; **Copia** is enabled.
2. Toggling **Numeri** off changes the field (live regen). Turning off all four groups shows `Seleziona almeno un gruppo di caratteri.`, empties the field, disables **Copia**.
3. **Copia** calls `writeText` with the current value and does not change `#pw-value`; status becomes `Copiata`.
4. Hide (`aria-label="Nascondi password"`) sets `type="password"` without changing the value; copy still uses the same string.
5. Slider `input` to 12 updates the number field and regenerates.
6. After toggling a preference, advancing fake timers 300 ms calls `savePasswordGeneratorPreferences` with options only (no `password` key).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/tools/password-generator/PasswordGeneratorTool.test.tsx`

Expected: FAIL because the component file is missing.

- [ ] **Step 3: Implement the component**

Structure (Italian copy from the spec):

- `<section className="pw-tool">` with heading, muted description, `.codec-private`-style local line (`LockKeyhole` + Elaborazione locale).
- Result card: label Password, `{length} caratteri`, read-only input `#pw-value`, eye toggle, **Genera** (primary) + **Copia**, strength output, `role="alert"` error, `role="status"` notice.
- Length: range `#pw-length` + number `#pw-length-input`.
- Include fieldset: four labeled checkboxes `.pw-toggle` with hints from `characterPools`.
- Rules fieldset: four toggles with the spec descriptions.
- Footer privacy paragraph with `ShieldCheck`.

State: `options`, `password`, `error`, `notice`, `visible` default `true`. `useEffect` on mount loads prefs then `apply(next)`. `apply(next)` sets options, runs `generatePassword`, sets password/error. Another `useEffect` on `options` (skip first paint until load finishes) live-generates. Debounced save 300 ms via `setTimeout` when options change after ready.

**Genera** calls `apply(options)` again. **Copia** uses `password` from state, never `generatePassword`.

Clamp numeric input with `Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(value) || MIN_LENGTH))`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/tools/password-generator/PasswordGeneratorTool.test.tsx`

Expected: PASS

---

### Task 6: Registry, catalog test, README

**Files:**
- Modify: `src/tools/registry.ts`
- Modify: `src/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PasswordGeneratorTool`
- Produces: catalog entry `{ id: 'password-generator', name: 'Generatore password', description: 'Crea password sicure in pochi secondi.', icon: KeyRound, component: PasswordGeneratorTool }` as the last `tools` item.

- [ ] **Step 1: Write the failing catalog assertion**

In `src/App.test.tsx` add:

```ts
it('lists Generatore password in the catalog', () => {
  const names = [...host.querySelectorAll('.tool-card strong')].map(node => node.textContent);
  expect(names).toContain('Generatore password');
  expect(host.querySelectorAll('#tool-password-generator')).toHaveLength(1);
});
```

Optionally, in the same file or the tool test, assert that after opening the tool `storage.local.set` payloads never include a `password` string equal to the generated value.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/App.test.tsx`

Expected: FAIL — name not in catalog.

- [ ] **Step 3: Register the tool and document it**

Append the registry entry; import `PasswordGeneratorTool` and `KeyRound`.

README: add **Generatore password** to the opening list. New section (after Codifica) stating: local generation with Web Crypto, live controls, copy/hide, preferences without storing passwords, no page access, no new permissions, length 4–64, rules listed briefly.

- [ ] **Step 4: Run tests**

Run: `pnpm test src/App.test.tsx src/tools/password-generator`

Expected: PASS

---

### Task 7: Compile, test, build

- [ ] **Step 1: `pnpm compile`** — Expected: no errors
- [ ] **Step 2: `pnpm test`** — Expected: all existing tests still pass
- [ ] **Step 3: `pnpm build`** — Expected: WXT build succeeds

If a browser is available, open the side panel, generate, toggle rules, copy, hide. Tests do not replace native clipboard or `crypto.getRandomValues` in Chrome.

---

## Spec coverage

- Live regen, copy without regen, hide/show → Task 5
- Rejection sampling, categories, similar, sequences, repeats, start-with-letter, validation messages → Task 1
- Strength formula → Task 2
- Preferences debounce and no password in storage → Task 3 and 5
- design.md tokens vs mockup → Task 4
- Registry, README, delivery commands → Task 6–7
