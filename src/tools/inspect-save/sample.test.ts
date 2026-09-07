import { describe, expect, it } from 'vitest';
import { buildSnapshotFromStyle, cropRectToViewport, isRectClipped } from './sample';

function mockStyle(values: Record<string, string>): CSSStyleDeclaration {
  return {
    getPropertyValue(name: string) {
      return values[name] ?? '';
    },
  } as CSSStyleDeclaration;
}

describe('buildSnapshotFromStyle summaries', () => {
  it('reports no border when sides are absent', () => {
    const snapshot = buildSnapshotFromStyle('div', mockStyle({
      width: '100px',
      height: '40px',
      'border-top-width': '0px',
      'border-right-width': '0px',
      'border-bottom-width': '0px',
      'border-left-width': '0px',
      'border-top-style': 'none',
      'border-right-style': 'none',
      'border-bottom-style': 'none',
      'border-left-style': 'none',
      color: 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'font-family': 'Arial',
      'font-size': '14px',
      'font-weight': '400',
      'line-height': '20px',
      'text-align': 'start',
      'padding-top': '0px',
      'padding-right': '0px',
      'padding-bottom': '0px',
      'padding-left': '0px',
      display: 'block',
      position: 'static',
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      'z-index': 'auto',
      opacity: '1',
      filter: 'none',
      'backdrop-filter': 'none',
      'box-shadow': 'none',
    }));
    const border = snapshot.sections.find(section => section.id === 'border');
    expect(border?.empty).toBe(true);
    expect(border?.rows[0]?.value).toBe('Nessun bordo');
  });

  it('reports no effects when absent', () => {
    const snapshot = buildSnapshotFromStyle('div', mockStyle({
      width: '10px',
      height: '10px',
      'border-top-width': '0px',
      'border-right-width': '0px',
      'border-bottom-width': '0px',
      'border-left-width': '0px',
      'border-top-style': 'none',
      'border-right-style': 'none',
      'border-bottom-style': 'none',
      'border-left-style': 'none',
      color: 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'font-family': 'Arial',
      'font-size': '14px',
      'font-weight': '400',
      'line-height': '20px',
      'text-align': 'start',
      'padding-top': '0px',
      'padding-right': '0px',
      'padding-bottom': '0px',
      'padding-left': '0px',
      display: 'block',
      position: 'static',
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
      left: 'auto',
      'z-index': 'auto',
      opacity: '1',
      filter: 'none',
      'backdrop-filter': 'none',
      'box-shadow': 'none',
    }));
    const effects = snapshot.sections.find(section => section.id === 'effects');
    expect(effects?.empty).toBe(true);
    expect(effects?.rows[0]?.value).toBe('Nessun effetto');
  });
});

describe('rect helpers', () => {
  it('detects clipped rects', () => {
    const rect = { left: -4, top: 0, right: 120, bottom: 80, width: 124, height: 80 } as DOMRect;
    expect(isRectClipped(rect, 100, 100)).toBe(true);
  });

  it('crops rect to viewport', () => {
    const rect = { left: -10, top: 5, right: 90, bottom: 55, width: 100, height: 50 } as DOMRect;
    expect(cropRectToViewport(rect, 80, 60)).toEqual({
      left: 0,
      top: 5,
      width: 80,
      height: 50,
      viewportWidth: 80,
    });
  });
});
