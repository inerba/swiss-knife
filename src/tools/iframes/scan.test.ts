import { beforeEach, describe, expect, it } from 'vitest';
import { scanIframes } from './scan';
beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
describe('iframe scan', () => {
  it('reports an empty page', () => { expect(scanIframes().frames).toEqual([]); });
  it('resolves relative URLs and preserves duplicates and names', () => {
    document.body.innerHTML = '<iframe title="Video" src="clip"></iframe><iframe id="second" src="clip"></iframe>';
    expect(scanIframes().frames.map(f => [f.title, f.url, f.depth])).toEqual([
      ['Video', 'https://example.test/path/clip', 0], ['second', 'https://example.test/path/clip', 0],
    ]);
  });
  it('respects the base element', () => {
    document.head.innerHTML = '<base href="https://cdn.test/media/">';
    document.body.innerHTML = '<iframe src="video"></iframe>';
    expect(scanIframes().frames[0]!.url).toBe('https://cdn.test/media/video');
  });
  it('disables missing, inline, unsafe and malformed sources', () => {
    document.body.innerHTML = '<iframe></iframe><iframe srcdoc="hello" src="https://example.test"></iframe><iframe src="javascript:void(0)"></iframe><iframe src="http://["></iframe><iframe src="about:blank"></iframe>';
    expect(scanIframes().frames.every(f => f.reason !== null)).toBe(true);
  });
  it('walks nested accessible documents and open shadow roots', () => {
    document.body.innerHTML = '<iframe title="Parent"></iframe><div id="host"></div>';
    document.querySelector('iframe')!.contentDocument!.body.innerHTML = '<iframe title="Child" src="https://child.test"></iframe>';
    document.querySelector('#host')!.attachShadow({ mode: 'open' }).innerHTML = '<iframe title="Shadow" src="https://shadow.test"></iframe>';
    expect(scanIframes().frames.map(f => [f.title, f.depth])).toEqual([['Parent', 0], ['Child', 1], ['Shadow', 0]]);
  });
  it('retains cross-origin sources and marks inaccessible descendants', () => {
    document.body.innerHTML = '<iframe src="https://other.test/embed"></iframe>';
    Object.defineProperty(document.querySelector('iframe'), 'contentDocument', { get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
    const result = scanIframes();
    expect(result.inaccessibleCount).toBe(1);
    expect(result.frames[0]).toMatchObject({ url: 'https://other.test/embed', reason: null, inaccessible: true });
  });
  it('marks null documents as partial', () => {
    document.body.innerHTML = '<iframe></iframe>';
    Object.defineProperty(document.querySelector('iframe'), 'contentDocument', { value: null });
    expect(scanIframes().inaccessibleCount).toBe(1);
  });
});
