import { describe, expect, it } from 'vitest';
import { convert, type TextFormat } from './convert';

const fixtures: Record<TextFormat, string> = {
  text: 'Aé😀', base64: 'QcOp8J+YgA==', hex: '41c3a9f09f9880',
  binary: '01000001 11000011 10101001 11110000 10011111 10011000 10000000',
  url: 'A%C3%A9%F0%9F%98%80', unicode: '\\u0041\\u00e9\\ud83d\\ude00',
};
describe('convert', () => {
  for (const from of Object.keys(fixtures) as TextFormat[]) {
    for (const to of Object.keys(fixtures) as TextFormat[]) {
      it(`${from} -> ${to} preserves Unicode`, () => expect(convert(fixtures[from], from, to)).toBe(fixtures[to]));
    }
    it(`${from} accepts empty input`, () => expect(convert('', from, 'text')).toBe(''));
  }
  it('preserves JSON whitespace and a leading BOM', () => {
    const input = '\ufeff{\n  "ok": true\n}\n';
    expect(convert(convert(input, 'text', 'base64'), 'base64', 'text')).toBe(input);
  });
  it('preserves arbitrary bytes without requiring UTF-8', () => {
    expect(convert('/wCA', 'base64', 'hex')).toBe('ff0080');
    expect(convert('ff0080', 'hex', 'base64')).toBe('/wCA');
    expect(convert('%FF%00%80', 'url', 'hex')).toBe('ff0080');
    expect(convert('ff0080', 'hex', 'url')).toBe('%FF%00%80');
    expect(() => convert('ff0080', 'hex', 'text')).toThrow(/UTF-8/);
  });
  it('normalizes ASCII whitespace and omitted Base64 padding', () => {
    expect(convert(' Z g\n', 'base64', 'base64')).toBe('Zg==');
    expect(convert('CA FE\t00', 'hex', 'hex')).toBe('cafe00');
    expect(convert('0100000101000010\n', 'binary', 'text')).toBe('AB');
  });
  it('treats plus literally and encodes URL components', () => {
    expect(convert('a+b%20c', 'url', 'text')).toBe('a+b c');
    expect(convert("a+b /!'()~", 'text', 'url')).toBe("a%2Bb%20%2F!'()~");
  });
  it('parses Unicode and JSON escapes without evaluating code', () => {
    expect(convert('a\\u{1f600}\\n\\t\\/\\"\\\\', 'unicode', 'text')).toBe('a😀\n\t/"\\');
  });
  it.each([
    ['base64', 'Zh==', 'Base64'], ['base64', 'Zg=', 'Base64'], ['base64', 'Z===', 'Base64'],
    ['base64', 'Z', 'Base64'], ['base64', '_w==', 'Base64'], ['base64', 'Zg==\u00a0', 'Base64'],
    ['hex', 'abc', 'HEX'], ['hex', '0xff', 'HEX'], ['hex', 'gg', 'HEX'],
    ['binary', '010 00001', 'Binario'], ['binary', '01000002', 'Binario'],
    ['url', '%f', 'URL'], ['url', '%xx', 'URL'],
    ['unicode', '\\u12', 'Unicode'], ['unicode', '\\q', 'Unicode'], ['unicode', '\\', 'Unicode'],
    ['unicode', '\\u{110000}', 'Unicode'], ['unicode', '\\ud800', 'Unicode'],
    ['unicode', '\\u{d800}', 'Unicode'], ['text', '\ud800', 'UTF-8'], ['text', '\udc00', 'UTF-8'],
  ])('rejects malformed %s: %s', (from, input, message) => {
    expect(() => convert(input, from as TextFormat, from as TextFormat)).toThrow(message);
  });
});
