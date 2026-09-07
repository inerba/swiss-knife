import { describe, expect, it } from 'vitest';
import { applyCaptureIsolation, isKeptForCapture, rectsOverlap, shouldHideForElementCapture } from './isolate-capture';

describe('isolate-capture', () => {
  it('detects overlapping rectangles', () => {
    expect(rectsOverlap({ left: 0, top: 0, right: 100, bottom: 40 }, { left: 10, top: 10, right: 50, bottom: 80 })).toBe(true);
    expect(rectsOverlap({ left: 0, top: 0, right: 20, bottom: 20 }, { left: 40, top: 40, right: 80, bottom: 80 })).toBe(false);
  });

  it('keeps the target, ancestors and descendants', () => {
    const ancestor = document.createElement('main');
    const target = document.createElement('article');
    const child = document.createElement('p');
    ancestor.append(target);
    target.append(child);
    document.body.append(ancestor);
    expect(isKeptForCapture(target, target)).toBe(true);
    expect(isKeptForCapture(ancestor, target)).toBe(true);
    expect(isKeptForCapture(child, target)).toBe(true);
    expect(isKeptForCapture(document.createElement('header'), target)).toBe(false);
    ancestor.remove();
  });

  it('hides overlapping and affixed outsiders, not the selected subtree', () => {
    const target = document.createElement('section');
    const header = document.createElement('header');
    const sibling = document.createElement('aside');
    const targetRect = { left: 0, top: 80, right: 200, bottom: 200 };
    expect(shouldHideForElementCapture(header, target, { left: 0, top: 0, right: 200, bottom: 64 }, targetRect, 'fixed')).toBe(true);
    expect(shouldHideForElementCapture(sibling, target, { left: 0, top: 90, right: 180, bottom: 140 }, targetRect, 'static')).toBe(true);
    expect(shouldHideForElementCapture(target, target, targetRect, targetRect, 'relative')).toBe(false);
  });

  it('hides a live fixed header that covers the selection and restores it', () => {
    const header = document.createElement('header');
    const target = document.createElement('article');
    header.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 80, right: 200, bottom: 80, x: 0, y: 0, toJSON() { return {}; } });
    target.getBoundingClientRect = () => ({ left: 0, top: 40, width: 200, height: 80, right: 200, bottom: 120, x: 0, y: 40, toJSON() { return {}; } });
    document.body.append(header, target);
    const restore = applyCaptureIsolation(target);
    expect(header.style.getPropertyValue('visibility')).toBe('hidden');
    expect(target.style.getPropertyValue('visibility')).toBe('');
    restore();
    expect(header.style.getPropertyValue('visibility')).toBe('');
    header.remove();
    target.remove();
  });
});
