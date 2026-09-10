import { convert, type TextFormat } from './convert';

export function detectFormat(input: string): TextFormat | null {
  if (!input || input.length > 65536 || new TextEncoder().encode(input).length > 65536) return null;
  const compact = input.replace(/[\t\n\v\f\r ]/g, '');
  const candidates: TextFormat[] = [];
  if (/\\u(?:[\da-f]{4}|\{[\da-f]{1,6}\})/i.test(input)) candidates.push('unicode');
  if (/%[\da-f]{2}/i.test(input)) candidates.push('url');
  if (/^[01\t\n\v\f\r ]+$/.test(input) && compact.length >= 8) candidates.push('binary');
  if (/^[\da-f]{8,}$/i.test(compact) && compact.length % 2 === 0) candidates.push('hex');
  if (/[=+/]/.test(compact) && /^[A-Za-z0-9+/]+={0,2}$/.test(compact)) candidates.push('base64');
  const readable = candidates.filter(format => {
    try {
      const text = convert(input, format, 'text');
      return text.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/.test(text);
    } catch { return false; }
  });
  return readable.length === 1 ? readable[0]! : null;
}
