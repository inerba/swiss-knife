import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DIGITS, LOWER, MAX_LENGTH, MIN_LENGTH, SYMBOLS, UPPER,
  characterPools, generatePassword, hasSequence, normalizeSymbolSet, randomIndex, validateOptions,
  type PasswordOptions,
} from './generate';

const allOn: PasswordOptions = {
  length: 16, numbers: true, lowercase: true, uppercase: true, symbols: true, symbolSet: SYMBOLS,
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
