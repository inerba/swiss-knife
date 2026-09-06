import { describe, expect, it } from 'vitest';
import { canonical, historyInsert, historyRemove, tailwindClosest, TAILWIND_COLORS } from './color';
describe('color storage and Tailwind matching', () => {
  it('gives equivalent syntax the same identity', () => expect(canonical('#ff0000')).toBe(canonical('rgb(255 0 0)')));
  it('moves duplicate colors to the top and keeps fifty records', () => {
    const values = Array.from({ length: 51 }, (_, index) => `rgb(${index} 0 0)`);
    const history = historyInsert([], values);
    expect(history).toHaveLength(50);
    expect(canonical(historyInsert(history, ['#000000'])[0]!.value)).toBe(canonical('#000000'));
  });
  it('removes selected history colors and keeps the others in order', () => {
    const history = historyInsert([], ['#ff0000', '#00ff00', '#0000ff']);
    const next = historyRemove(history, [history[1]!.id]);
    expect(next.map(item => canonical(item.value))).toEqual([canonical('#ff0000'), canonical('#0000ff')]);
    expect(historyRemove(history, ['missing', history[0]!.id, history[2]!.id])).toHaveLength(1);
    expect(historyRemove(history, history.map(item => item.id))).toEqual([]);
  });
  it('finds the closest Tailwind color in perceptual space', () => expect(tailwindClosest('#3b82f6', TAILWIND_COLORS).entry.name).toBe('blue-500'));
});
