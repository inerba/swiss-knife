// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { generateHash, type HashAlgorithm } from './hash';

it.each<HashAlgorithm>(['MD5', 'SHA-256', 'SHA-512', 'SM3'])('%s matches independent vectors including empty and Unicode input', async algorithm => {
  for (const text of ['', 'abc', 'Aé😀', '{\n "x": 1\n}\n', 'YWJj']) {
    const expected = createHash(algorithm.toLowerCase().replace('-', '')).update(text, 'utf8').digest('hex');
    expect(await generateHash(text, algorithm)).toBe(expected);
  }
});
it('rejects isolated surrogates instead of hashing replacement characters', async () => {
  await expect(generateHash('\ud800', 'SHA-256')).rejects.toThrow(/UTF-8/);
});
