import { describe, expect, it } from 'vitest';
import { navigateDown, navigateUp, parentTarget, shouldFollowPointer } from './picker';

describe('picker navigation helpers', () => {
  it('walks up to the parent element', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.append(child);
    const next = navigateUp(child, []);
    expect(next.pointed).toBe(parent);
    expect(next.trail).toEqual([child]);
  });

  it('walks down using the trail', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.append(child);
    const next = navigateDown(parent, [child]);
    expect(next.pointed).toBe(child);
    expect(next.trail).toEqual([]);
  });

  it('resolves shadow host as parent', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('p');
    shadow.append(inner);
    expect(parentTarget(inner)).toBe(host);
  });
});

describe('shouldFollowPointer', () => {
  it('keeps the expanded element until the mouse actually moves', () => {
    expect(shouldFollowPointer(true, 40, 40, 41, 41)).toBe(false);
    expect(shouldFollowPointer(true, 40, 40, 80, 80)).toBe(true);
    expect(shouldFollowPointer(false, 40, 40, 40, 40)).toBe(true);
  });
});
