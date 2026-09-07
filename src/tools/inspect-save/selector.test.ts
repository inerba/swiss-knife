import { describe, expect, it } from 'vitest';
import { buildSelector, formatClasses, formatTagLabel } from './selector';

describe('buildSelector', () => {
  it('prefers id when present', () => {
    const element = document.createElement('div');
    element.id = 'nav';
    expect(buildSelector(element)).toBe('div#nav');
  });

  it('uses classes when no id', () => {
    const element = document.createElement('div');
    element.className = 'gnav__bar extra';
    expect(buildSelector(element)).toBe('div.gnav__bar.extra');
  });

  it('ignores inspector outline class', () => {
    const element = document.createElement('div');
    element.className = 'gnav__bar swiss-inspector-outline';
    expect(buildSelector(element)).toBe('div.gnav__bar');
    expect(formatClasses(element)).toBe('.gnav__bar');
  });
});

describe('formatTagLabel', () => {
  it('capitalizes tag names', () => {
    expect(formatTagLabel('div')).toBe('Div');
    expect(formatTagLabel('section')).toBe('Section');
  });
});
