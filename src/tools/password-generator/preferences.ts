import { browser } from 'wxt/browser';
import { MAX_LENGTH, MIN_LENGTH, normalizeSymbolSet, SYMBOLS, type PasswordOptions } from './generate';

export const PASSWORD_GENERATOR_PREFERENCES_KEY = 'passwordGeneratorPreferences';
export type PasswordGeneratorPreferences = PasswordOptions;

export const defaultPasswordGeneratorPreferences: PasswordGeneratorPreferences = {
  length: 16,
  numbers: true,
  lowercase: true,
  uppercase: true,
  symbols: true,
  symbolSet: SYMBOLS,
  excludeSimilar: true,
  excludeSequences: true,
  excludeRepeats: false,
  startWithLetter: true,
};

function flag(value: unknown, fallback: boolean) {
  return value === true ? true : value === false ? false : fallback;
}

export function normalizePasswordGeneratorPreferences(value: unknown): PasswordGeneratorPreferences {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const length = typeof raw.length === 'number' && Number.isInteger(raw.length) && raw.length >= MIN_LENGTH && raw.length <= MAX_LENGTH
    ? raw.length
    : defaultPasswordGeneratorPreferences.length;
  return {
    length,
    numbers: flag(raw.numbers, defaultPasswordGeneratorPreferences.numbers),
    lowercase: flag(raw.lowercase, defaultPasswordGeneratorPreferences.lowercase),
    uppercase: flag(raw.uppercase, defaultPasswordGeneratorPreferences.uppercase),
    symbols: flag(raw.symbols, defaultPasswordGeneratorPreferences.symbols),
    symbolSet: Object.prototype.hasOwnProperty.call(raw, 'symbolSet') ? normalizeSymbolSet(raw.symbolSet) : SYMBOLS,
    excludeSimilar: flag(raw.excludeSimilar, defaultPasswordGeneratorPreferences.excludeSimilar),
    excludeSequences: flag(raw.excludeSequences, defaultPasswordGeneratorPreferences.excludeSequences),
    excludeRepeats: flag(raw.excludeRepeats, defaultPasswordGeneratorPreferences.excludeRepeats),
    startWithLetter: flag(raw.startWithLetter, defaultPasswordGeneratorPreferences.startWithLetter),
  };
}

export async function loadPasswordGeneratorPreferences() {
  const stored = await browser.storage.local.get(PASSWORD_GENERATOR_PREFERENCES_KEY);
  return normalizePasswordGeneratorPreferences(stored[PASSWORD_GENERATOR_PREFERENCES_KEY]);
}

export async function savePasswordGeneratorPreferences(value: PasswordGeneratorPreferences) {
  await browser.storage.local.set({ [PASSWORD_GENERATOR_PREFERENCES_KEY]: value });
}
