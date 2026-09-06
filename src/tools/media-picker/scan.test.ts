import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { collectMedia, cssImageUrls } from './scan';

beforeEach(() => {
  document.body.innerHTML = '';
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => pseudo
    ? { content: 'none', display: 'none', backgroundImage: 'none' } as CSSStyleDeclaration
    : original(element));
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return [this.getBoundingClientRect()] as unknown as DOMRectList;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200 } as DOMRect);
});
afterEach(() => vi.restoreAllMocks());
const scan = () => collectMedia(document, 50, 50, new AbortController().signal);
it('finds covered images with pointer-events none and deduplicates their sources', async () => {
  document.body.innerHTML = '<div style="background-image:url(photo.jpg)"><img src="photo.jpg"><img src="overlay.png" style="pointer-events:none"></div>';
  const result = await scan();
  expect(result.images.map(i => i.url)).toEqual(['https://example.test/path/photo.jpg', 'https://example.test/path/overlay.png']);
  expect(result.images[0]!.sources).toEqual(['Sfondo CSS', 'Immagine']);
});
it('uses currentSrc instead of downloading unused responsive alternatives', async () => {
  document.body.innerHTML = '<picture><source srcset="large.jpg 2x"><img src="fallback.jpg"></picture>';
  Object.defineProperty(document.querySelector('img'), 'currentSrc', { value: 'https://example.test/selected.webp' });
  expect((await scan()).images.map(i => i.url)).toEqual(['https://example.test/selected.webp']);
});
it('handles CSS quoting, commas, escaped parentheses and image-set string syntax', () => {
  expect(cssImageUrls('url("a,b(1).png"),url(escaped\\).png),image-set("small.webp" 1x, "large.webp" 2x)'))
    .toEqual(['a,b(1).png', 'escaped).png', 'small.webp', 'large.webp']);
});
it('reads SVG references, open shadow roots and data/blob URLs', async () => {
  document.body.innerHTML = '<div id="host"></div><svg><image href="vector.svg" /></svg><img src="data:image/png;base64,AA=="><img src="blob:https://example.test/test">';
  document.querySelector('#host')!.attachShadow({ mode: 'open' }).innerHTML = '<img src="shadow.png">';
  const result = await scan();
  expect(result.images).toHaveLength(4);
  expect(result.owners.size).toBe(4);
  expect(result.images.some(i => i.url.endsWith('/shadow.png'))).toBe(true);
});
it('reports inaccessible frames and never treats unsafe URLs as images', async () => {
  document.body.innerHTML = '<iframe src="https://other.test"></iframe><img src="javascript:alert(1)">';
  Object.defineProperty(document.querySelector('iframe'), 'contentDocument', { value: null });
  expect((await scan()).warnings).toHaveLength(1);
  expect((await scan()).images).toHaveLength(0);
});
it('does not return stale results after cancellation', async () => {
  document.body.innerHTML = '<img src="photo.jpg">';
  const controller = new AbortController(); controller.abort();
  await expect(collectMedia(document, 50, 50, controller.signal)).rejects.toThrow();
});
it('includes all media descendants away from the pointer, without scanning unrelated containers', async () => {
  document.body.innerHTML = '<section id="chosen"><img src="one.png"><div><img src="two.png"><video src="clip.mp4" poster="poster.jpg"><source src="clip.webm"><track src="captions.vtt"></video><audio src="song.mp3"></audio><a href="direct.flac">Audio</a></div></section><aside><img src="unrelated.png"></aside>';
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 500, top: 500, width: 10, height: 10, right: 510, bottom: 510 } as DOMRect);
  const result = await collectMedia(document, 10, 10, new AbortController().signal, document.querySelector('#chosen')!);
  expect(result.images.map(i => i.url.split('/').pop()).sort()).toEqual(['one.png', 'two.png', 'clip.mp4', 'clip.webm', 'poster.jpg', 'captions.vtt', 'song.mp3', 'direct.flac'].sort());
  expect(result.images.find(i => i.url.endsWith('clip.mp4'))?.kind).toBe('video');
  expect(result.images.find(i => i.url.endsWith('song.mp3'))?.kind).toBe('audio');
});
it('collects descendants inside a selected open shadow host even away from the point', async () => {
  document.body.innerHTML = '<div id="chosen"></div>';
  const host = document.querySelector('#chosen')!;
  host.attachShadow({ mode: 'open' }).innerHTML = '<audio src="music.ogg"></audio><img src="cover.jpg">';
  const result = await collectMedia(document, 1000, 1000, new AbortController().signal, host);
  expect(result.images).toHaveLength(2);
});
it('labels streaming manifests instead of promising a complete video download', async () => {
  document.body.innerHTML = '<video src="live.m3u8"></video>';
  expect((await scan()).images[0]?.kind).toBe('stream');
});
