import { describe, expect, it, vi } from 'vitest';

vi.mock('qr-code-styling', () => ({
  default: class {
    async getRawData(extension: string) {
      if (extension === 'svg') return new Blob(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], { type: 'image/svg+xml' });
      return new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
    }
  },
}));

import { decodeQrImageData, renderQr } from './codec';
import { defaultQrStyle } from './style';

describe('QR codec', () => {
  it('rejects unreadable pixels', () => {
    expect(() => decodeQrImageData(new Uint8ClampedArray(4 * 16), 4, 4)).toThrow('Nessun QR code leggibile');
  });

  it('exports PNG and SVG from the styling renderer', async () => {
    const rendered = await renderQr('Ciao, Giulia 👋', defaultQrStyle);
    expect(rendered.svg).toContain('<svg');
    expect(rendered.png.startsWith('data:image/png')).toBe(true);
  });
});
