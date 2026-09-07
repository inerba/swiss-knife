import { browser } from 'wxt/browser';
import { cropScreenshot } from '../screenshots/capture';

export function inspectFilename(tag: string, extension: 'png' | 'html' = 'png') {
  const safe = tag.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'elemento';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `ispeziona-salva-${safe}-${stamp}.${extension}`;
}

export async function captureElementPng(windowId: number, rect: import('./types').InspectRect): Promise<string> {
  const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
  return cropScreenshot(dataUrl, rect, 'image/png');
}
