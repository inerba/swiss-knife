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
  symbolSet: string;
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

export function characterPools(options: PasswordOptions) {
  const digits = options.numbers ? stripSimilar(DIGITS, options.excludeSimilar) : '';
  const lower = options.lowercase ? stripSimilar(LOWER, options.excludeSimilar) : '';
  const upper = options.uppercase ? stripSimilar(UPPER, options.excludeSimilar) : '';
  const symbols = options.symbols ? stripSimilar(normalizeSymbolSet(options.symbolSet), options.excludeSimilar) : '';
  const lookup = { digits, lower, upper, symbols };
  const active = (['digits', 'lower', 'upper', 'symbols'] as const).filter(name => lookup[name].length > 0);
  return { digits, lower, upper, symbols, letters: lower + upper, combined: digits + lower + upper + symbols, active };
}

function poolOf(pools: ReturnType<typeof characterPools>, name: PoolName) {
  return pools[name];
}

export function validateOptions(options: PasswordOptions) {
  const selected = [options.numbers, options.lowercase, options.uppercase, options.symbols].filter(Boolean).length;
  if (selected === 0) return 'Seleziona almeno un gruppo di caratteri.';
  if (options.symbols && normalizeSymbolSet(options.symbolSet).length === 0) return 'Inserisci almeno un simbolo.';
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
