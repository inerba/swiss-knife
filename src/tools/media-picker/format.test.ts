import { expect, it } from 'vitest';
import { compactPageUrl, formatDuration, mediaKind } from './format';
it('shows only host and path, preserving the full URL separately in the UI', () => {
  expect(compactPageUrl('https://www.almonature.com/it/?utm_source=ads&gclid=long#anchor')).toBe('www.almonature.com/it/');
});
it('classifies video, audio, captions and manifests including query strings', () => {
  expect(mediaKind('https://cdn/file.mp4?token=1')).toBe('video');
  expect(mediaKind('https://cdn/file', 'audio/mpeg')).toBe('audio');
  expect(mediaKind('https://cdn/file.mpd')).toBe('stream');
  expect(mediaKind('https://cdn/file.vtt')).toBe('subtitle');
  expect(mediaKind('https://cdn/page.html')).toBeUndefined();
});
it('formats media duration without claiming an infinite live stream length', () => {
  expect(formatDuration(92)).toBe('1:32'); expect(formatDuration(Infinity)).toBe('Non disponibile');
});
