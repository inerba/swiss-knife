import { describe, expect, it } from 'vitest';
import { analyzeContrast, flattenPair, tryAnalyzeContrast } from './contrast';

describe('analyzeContrast', () => {
  it('returns 21:1 and every pass for black on white', () => {
    const result = analyzeContrast('#000000', '#FFFFFF');
    expect(result.ratio).toBeCloseTo(21, 4);
    expect(result.display).toBe('21.0 : 1');
    expect(result.grade).toBe('Ottimo');
    expect(result.checks).toEqual({
      aaNormal: true, aaaNormal: true, aaLarge: true, aaaLarge: true, aaNonText: true,
    });
    expect(result.foreground.toLowerCase()).toBe('#000000');
    expect(result.background.toLowerCase()).toBe('#ffffff');
  });

  it('classifies the 4.5:1 boundary as Buono with AAA normal failing', () => {
    const result = analyzeContrast('#767676', '#FFFFFF');
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    expect(result.ratio).toBeLessThan(7);
    expect(result.grade).toBe('Buono');
    expect(result.checks.aaNormal).toBe(true);
    expect(result.checks.aaaNormal).toBe(false);
    expect(result.checks.aaLarge).toBe(true);
    expect(result.checks.aaaLarge).toBe(true);
    expect(result.checks.aaNonText).toBe(true);
  });

  it('classifies the 3:1 boundary as Sufficiente', () => {
    const result = analyzeContrast('#949494', '#FFFFFF');
    expect(result.ratio).toBeGreaterThanOrEqual(3);
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.grade).toBe('Sufficiente');
    expect(result.checks.aaNormal).toBe(false);
    expect(result.checks.aaLarge).toBe(true);
    expect(result.checks.aaNonText).toBe(true);
    expect(result.checks.aaaLarge).toBe(false);
  });

  it('classifies a failing pair as Insufficiente', () => {
    const result = analyzeContrast('#BBBBBB', '#FFFFFF');
    expect(result.ratio).toBeLessThan(3);
    expect(result.grade).toBe('Insufficiente');
    expect(result.checks).toEqual({
      aaNormal: false, aaaNormal: false, aaLarge: false, aaaLarge: false, aaNonText: false,
    });
  });

  it('returns null for invalid HEX instead of a stale result', () => {
    expect(tryAnalyzeContrast('#000000', 'not-a-color')).toBeNull();
    expect(tryAnalyzeContrast('#GGG', '#FFFFFF')).toBeNull();
    expect(() => analyzeContrast('#000000', 'nope')).toThrow(/valido/i);
  });
});

describe('flattenPair', () => {
  it('composites semi-transparent text onto the background before measuring', () => {
    const opaque = analyzeContrast('#000000', '#FFFFFF');
    const faded = analyzeContrast('rgba(0, 0, 0, 0.5)', '#FFFFFF');
    expect(faded.ratio).toBeLessThan(opaque.ratio);
    const flat = flattenPair('rgba(0, 0, 0, 0.5)', '#FFFFFF');
    expect(flat.foreground).not.toBe('#000000');
    expect(flat.background.toLowerCase()).toBe('#ffffff');
  });

  it('composites a translucent background onto white', () => {
    const solid = analyzeContrast('#000000', '#FFFFFF');
    const wash = analyzeContrast('#000000', 'rgba(0, 0, 0, 0.2)');
    expect(wash.ratio).toBeLessThan(solid.ratio);
  });
});
