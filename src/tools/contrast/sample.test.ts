import { describe, expect, it } from 'vitest';
import { IMAGE_WARNING, TRANSPARENT_WARNING, sampleFromStyles } from './sample';

describe('sampleFromStyles', () => {
  it('uses the first opaque ancestor background and keeps font metrics', () => {
    const sample = sampleFromStyles({
      color: 'rgb(255, 255, 255)',
      layers: [
        { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' },
        { backgroundColor: 'rgb(114, 65, 255)', backgroundImage: 'none' },
        { backgroundColor: 'rgb(255, 255, 255)', backgroundImage: 'none' },
      ],
      fontFamily: 'Public Sans, sans-serif',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: '400',
    });
    expect(sample.foreground.toLowerCase()).toBe('#ffffff');
    expect(sample.background.toLowerCase()).toBe('#7241ff');
    expect(sample.fontFamily).toBe('Public Sans, sans-serif');
    expect(sample.fontSize).toBe('16px');
    expect(sample.lineHeight).toBe('24px');
    expect(sample.warnings).toEqual([]);
  });

  it('composites stacked translucent backgrounds onto white and warns', () => {
    const sample = sampleFromStyles({
      color: 'rgb(0, 0, 0)',
      layers: [
        { backgroundColor: 'rgba(255, 0, 0, 0.4)', backgroundImage: 'none' },
        { backgroundColor: 'rgba(0, 0, 255, 0.4)', backgroundImage: 'none' },
      ],
      fontFamily: 'serif',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: '700',
    });
    expect(sample.background.toLowerCase()).not.toBe('#ffffff');
    expect(sample.background.toLowerCase()).not.toBe('#000000');
    expect(sample.warnings).toContain(TRANSPARENT_WARNING);
  });

  it('warns when a layer has a gradient or image and still returns computed colors', () => {
    const sample = sampleFromStyles({
      color: '#111111',
      layers: [
        { backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'linear-gradient(red, blue)' },
        { backgroundColor: 'rgb(255, 255, 255)', backgroundImage: 'none' },
      ],
      fontFamily: 'Georgia',
      fontSize: '18px',
      lineHeight: '28px',
      fontWeight: '400',
    });
    expect(sample.background.toLowerCase()).toBe('#ffffff');
    expect(sample.warnings).toContain(IMAGE_WARNING);
  });
});
