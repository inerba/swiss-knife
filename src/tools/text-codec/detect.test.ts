import { expect, it } from 'vitest';
import { detectFormat } from './detect';

it.each([
  ['\\u0041\\u00e9', 'unicode'], ['ciao%20mondo', 'url'],
  ['01000001 01000010', 'binary'], ['6369616f', 'hex'], ['Y2lhbw==', 'base64'],
])('suggests a readable explicit encoding: %s', (input, format) => expect(detectFormat(input)).toBe(format));
it.each(['', 'ciao', 'deadbeef', '1234', 'YWJj', 'ff008080', '/w==', 'Zh==', '10000000', '%FF', '\\ud800', '\\u0041%20'])('does not guess ambiguous or unreadable content: %s', input => {
  expect(detectFormat(input)).toBeNull();
});
it('skips inputs larger than 64 KiB in UTF-8', () => {
  expect(detectFormat('é'.repeat(32768) + '%20')).toBeNull();
});
