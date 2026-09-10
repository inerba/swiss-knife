export const formats = [
  { id: 'text', label: 'Testo UTF-8' }, { id: 'base64', label: 'Base64' },
  { id: 'url', label: 'URL encoded' }, { id: 'unicode', label: 'Unicode escaped' },
  { id: 'hex', label: 'HEX' }, { id: 'binary', label: 'Binario' },
] as const;
export type TextFormat = typeof formats[number]['id'];
const asciiWhitespace = /[\t\n\v\f\r ]/g;
const errors: Record<TextFormat, string> = {
  text: 'Testo UTF-8 non valido', base64: 'Base64 non valido', url: 'URL encoded non valido',
  unicode: 'Unicode escape non valido', hex: 'HEX non valido', binary: 'Binario non valido',
};
function invalid(format: TextFormat): never { throw new Error(errors[format]); }

export function utf8Bytes(input: string): Uint8Array<ArrayBuffer> {
  // TextEncoder replaces lone surrogates; reject them before encoding to avoid data loss.
  for (const character of input) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) invalid('text');
  }
  return new TextEncoder().encode(input);
}
function utf8Text(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return invalid('text'); }
}
export function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function base64Bytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  return btoa(chunks.join(''));
}
function unicodeText(input: string): string {
  const result: string[] = [];
  const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== '\\') { result.push(input[i]!); continue; }
    const escape = input[++i];
    if (!escape) invalid('unicode');
    if (escape !== 'u') {
      if (!Object.hasOwn(escapes, escape)) invalid('unicode');
      result.push(escapes[escape]!); continue;
    }
    if (input[i + 1] === '{') {
      const end = input.indexOf('}', i + 2);
      const digits = input.slice(i + 2, end);
      if (end < 0 || !/^[\da-f]{1,6}$/i.test(digits)) invalid('unicode');
      const point = parseInt(digits, 16);
      if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) invalid('unicode');
      result.push(String.fromCodePoint(point)); i = end;
    } else {
      const digits = input.slice(i + 1, i + 5);
      if (!/^[\da-f]{4}$/i.test(digits)) invalid('unicode');
      result.push(String.fromCharCode(parseInt(digits, 16))); i += 4;
    }
  }
  return result.join('');
}
function decode(input: string, from: TextFormat): Uint8Array {
  switch (from) {
    case 'text': return utf8Bytes(input);
    case 'unicode':
      try { return utf8Bytes(unicodeText(input)); } catch { return invalid('unicode'); }
    case 'hex': {
      const compact = input.replace(asciiWhitespace, '');
      if (!/^(?:[\da-f]{2})*$/i.test(compact)) invalid(from);
      return Uint8Array.from(compact.match(/../g) ?? [], pair => parseInt(pair, 16));
    }
    case 'binary': {
      if (!/^[01\t\n\v\f\r ]*$/.test(input)) invalid(from);
      const groups = input.split(/[\t\n\v\f\r ]+/).filter(Boolean);
      if (groups.some(group => group.length % 8 !== 0)) invalid(from);
      return Uint8Array.from(groups.join('').match(/.{8}/g) ?? [], byte => parseInt(byte, 2));
    }
    case 'base64': {
      const compact = input.replace(asciiWhitespace, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) invalid(from);
      const raw = compact.replace(/=+$/, '');
      if (raw.length % 4 === 1) invalid(from);
      const canonical = raw.padEnd(Math.ceil(raw.length / 4) * 4, '=');
      if (compact.includes('=') && compact !== canonical) invalid(from);
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(canonical), char => char.charCodeAt(0)); } catch { return invalid(from); }
      if (base64Bytes(bytes) !== canonical) invalid(from);
      return bytes;
    }
    case 'url': {
      const bytes: number[] = [];
      for (const token of input.match(/%[^%]{0,2}|[^%]+|%/g) ?? []) {
        if (token.startsWith('%')) {
          if (!/^%[\da-f]{2}$/i.test(token)) invalid(from);
          bytes.push(parseInt(token.slice(1), 16));
        } else {
          for (const byte of utf8Bytes(token)) bytes.push(byte);
        }
      }
      return Uint8Array.from(bytes);
    }
  }
}
export function convert(input: string, from: TextFormat, to: TextFormat): string {
  const bytes = decode(input, from);
  switch (to) {
    case 'text': return utf8Text(bytes);
    case 'base64': return base64Bytes(bytes);
    case 'hex': return hexBytes(bytes);
    case 'binary': return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join(' ');
    case 'url': return Array.from(bytes, byte => {
      const character = String.fromCharCode(byte);
      return /^[A-Za-z0-9_.!~*'()-]$/.test(character) ? character : `%${byte.toString(16).padStart(2, '0').toUpperCase()}`;
    }).join('');
    case 'unicode': return utf8Text(bytes).split('').map(unit => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  }
}
