import { describe, expect, it } from 'vitest';
import { elementFitsViewport } from './element-capture';

describe('elementFitsViewport', () => {
  it('returns true when the element fits entirely in the viewport', () => {
    expect(elementFitsViewport({
      left: 100,
      top: 80,
      width: 200,
      height: 120,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 50,
      scrollY: 20,
    })).toBe(true);
  });

  it('returns false when the element extends beyond the viewport', () => {
    expect(elementFitsViewport({
      left: 100,
      top: 80,
      width: 200,
      height: 900,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 0,
      scrollY: 0,
    })).toBe(false);
  });
});
