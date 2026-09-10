import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { isChromeExtensionVersion, parseCliVersion } = createRequire(import.meta.url)('./zip.cjs') as {
  isChromeExtensionVersion: (value: unknown) => boolean;
  parseCliVersion: (argv: string[]) => { help?: boolean; version?: string };
};

describe('zip version', () => {
  it('accepts Chrome extension versions', () => {
    expect(isChromeExtensionVersion('1')).toBe(true);
    expect(isChromeExtensionVersion('1.2.0')).toBe(true);
    expect(isChromeExtensionVersion('1.2.0.3')).toBe(true);
    expect(isChromeExtensionVersion('0.0.1')).toBe(true);
  });

  it('rejects suffixes, blanks and out-of-range parts', () => {
    expect(isChromeExtensionVersion('')).toBe(false);
    expect(isChromeExtensionVersion('1.2.0-beta')).toBe(false);
    expect(isChromeExtensionVersion('01.2.0')).toBe(false);
    expect(isChromeExtensionVersion('1.2.0.3.4')).toBe(false);
    expect(isChromeExtensionVersion('1.70000.0')).toBe(false);
  });

  it('reads the version from argv after the script path', () => {
    expect(parseCliVersion(['node', 'scripts/zip.cjs', '1.2.0'])).toEqual({ version: '1.2.0' });
    expect(parseCliVersion(['node', 'scripts/zip.cjs', '--', '1.2.0'])).toEqual({ version: '1.2.0' });
    expect(parseCliVersion(['node', 'scripts/zip.cjs', '--help'])).toEqual({ help: true });
    expect(parseCliVersion(['node', 'scripts/zip.cjs'])).toEqual({ version: '' });
  });
});
