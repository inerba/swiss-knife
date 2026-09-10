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
