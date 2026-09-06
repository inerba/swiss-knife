import { describe, expect, it } from 'vitest';
import { generateLoremIpsum } from './LoremIpsumTool';

describe('generateLoremIpsum', () => {
  it('returns the requested paragraphs separated by an empty line', () => {
    expect(generateLoremIpsum(4).split('\n\n')).toHaveLength(4);
  });
});
