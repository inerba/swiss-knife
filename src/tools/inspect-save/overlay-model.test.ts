import { describe, expect, it } from 'vitest';
import { buildOverlayGuides, buildOverlayModel, formatRadiusLabel, parsePx, toOverlayRect } from './overlay-model';

describe('overlay-model', () => {
  it('parses pixel values from css strings', () => {
    expect(parsePx('12px')).toBe(12);
    expect(parsePx('0')).toBe(0);
    expect(parsePx('invalid')).toBe(0);
  });

  it('formats uniform border radius labels', () => {
    expect(formatRadiusLabel('30px')).toBe('30px');
    expect(formatRadiusLabel('0px')).toBeNull();
    expect(formatRadiusLabel('12px 12px 12px 12px')).toBe('12px');
  });

  it('builds padding, margin regions and badges', () => {
    const model = buildOverlayModel(
      { left: 100, top: 80, width: 156, height: 40 },
      {
        paddingTop: 10,
        paddingRight: 12,
        paddingBottom: 10,
        paddingLeft: 12,
        marginTop: 8,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 6,
        borderRadius: '30px',
      },
      1280,
      800,
    );

    expect(model.padding).toHaveLength(4);
    expect(model.margin).toHaveLength(2);
    expect(model.paddingBadges.map(item => item.text)).toEqual(['10', '10', '12', '12']);
    expect(model.marginBadges.map(item => item.text)).toEqual(['8', '6']);
    expect(model.radiusBadge?.text).toBe('30px');
    expect(model.border.right).toBe(256);
  });

  it('creates dashed guide lines across the viewport', () => {
    const border = toOverlayRect({ left: 20, top: 30, width: 100, height: 50 });
    const guides = buildOverlayGuides(border, 400, 300);
    expect(guides).toHaveLength(4);
    expect(guides.filter(item => item.orientation === 'vertical').map(item => item.position)).toEqual([20, 120]);
    expect(guides.filter(item => item.orientation === 'horizontal').map(item => item.position)).toEqual([30, 80]);
  });
});
