import { captureElementPng as captureElement } from './element-capture';
import type { InspectRect } from './types';

export function inspectFilename(tag: string, extension: 'png' | 'html' = 'png') {
  const safe = tag.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'elemento';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `ispeziona-salva-${safe}-${stamp}.${extension}`;
}

export async function captureElementPng(tabId: number, windowId: number, rect: InspectRect) {
  const result = await captureElement(tabId, windowId, rect);
  return result;
}
