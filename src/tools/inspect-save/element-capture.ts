import { browser } from 'wxt/browser';
import {
  assertCanvasSize,
  cropScreenshot,
  encodeCanvas,
  moveTo,
  preparePageCapture,
  readPageSize,
  restorePageCapture,
  screenshotScale,
  type PageSize,
} from '../screenshots/capture';
import type { InspectRect } from './types';

export interface ElementCaptureResult {
  png: string;
  clipped: boolean;
}

function waitForCaptureThrottle(lastCapture: number) {
  const wait = Math.max(0, 510 - (Date.now() - lastCapture));
  if (!wait) return Promise.resolve();
  return new Promise<void>(resolve => setTimeout(resolve, wait));
}

export function elementFitsViewport(rect: InspectRect) {
  const viewLeft = rect.left - rect.scrollX;
  const viewTop = rect.top - rect.scrollY;
  const viewRight = viewLeft + rect.width;
  const viewBottom = viewTop + rect.height;
  return viewLeft >= 0
    && viewTop >= 0
    && viewRight <= rect.viewportWidth
    && viewBottom <= rect.viewportHeight;
}

function viewportCropRect(rect: InspectRect) {
  return {
    left: rect.left - rect.scrollX,
    top: rect.top - rect.scrollY,
    width: rect.width,
    height: rect.height,
    viewportWidth: rect.viewportWidth,
  };
}

async function captureVisible(windowId: number) {
  return browser.tabs.captureVisibleTab(windowId, { format: 'png' });
}

async function cropViewportShot(dataUrl: string, rect: InspectRect) {
  return cropScreenshot(dataUrl, viewportCropRect(rect), 'image/png');
}

async function captureSingleViewport(tabId: number, windowId: number, rect: InspectRect) {
  const targetScrollX = Math.max(0, rect.left);
  const targetScrollY = Math.max(0, rect.top);
  await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [targetScrollX, targetScrollY] });
  const dataUrl = await captureVisible(windowId);
  const adjusted: InspectRect = {
    ...rect,
    scrollX: targetScrollX,
    scrollY: targetScrollY,
  };
  return cropViewportShot(dataUrl, adjusted);
}

async function captureTiled(tabId: number, windowId: number, rect: InspectRect, page: PageSize) {
  const session = crypto.randomUUID();
  await browser.scripting.executeScript({ target: { tabId }, func: preparePageCapture, args: [session] });
  const tiles = new Map<string, { x: number; y: number; image: string }>();
  let lastCapture = 0;
  const elemRight = rect.left + rect.width;
  const elemBottom = rect.top + rect.height;
  let firstTile = true;

  try {
    let y = rect.top;
    while (y < elemBottom) {
      let x = rect.left;
      while (x < elemRight) {
        const [position] = await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [x, y] });
        const point = position?.result as { x: number; y: number } | undefined;
        if (!point) throw new Error('La pagina è cambiata durante la cattura. Riprova.');
        if (!firstTile) {
          await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [point.x, point.y] });
        }
        const key = `${point.x}:${point.y}`;
        if (!tiles.has(key)) {
          await waitForCaptureThrottle(lastCapture);
          tiles.set(key, { x: point.x, y: point.y, image: await captureVisible(windowId) });
          lastCapture = Date.now();
        }
        firstTile = false;
        x += page.viewportWidth;
      }
      y += page.viewportHeight;
    }

    const first = tiles.values().next().value as { image: string } | undefined;
    if (!first) throw new Error('Impossibile catturare l\'elemento selezionato.');

    const probe = new Image();
    probe.src = first.image;
    await probe.decode();
    const captureScale = screenshotScale(probe.naturalWidth, page.viewportWidth);
    assertCanvasSize(Math.ceil(rect.width * captureScale), Math.ceil(rect.height * captureScale));

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(rect.width * captureScale);
    canvas.height = Math.ceil(rect.height * captureScale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Impossibile preparare l\'anteprima dell\'elemento.');

    for (const tile of tiles.values()) {
      const image = new Image();
      image.src = tile.image;
      await image.decode();
      const tileScale = screenshotScale(image.naturalWidth, page.viewportWidth);
      const tileLeft = tile.x;
      const tileTop = tile.y;
      const tileRight = tileLeft + page.viewportWidth;
      const tileBottom = tileTop + page.viewportHeight;
      const intersectLeft = Math.max(rect.left, tileLeft);
      const intersectTop = Math.max(rect.top, tileTop);
      const intersectRight = Math.min(elemRight, tileRight);
      const intersectBottom = Math.min(elemBottom, tileBottom);
      if (intersectRight <= intersectLeft || intersectBottom <= intersectTop) continue;

      const sourceX = (intersectLeft - tileLeft) * tileScale;
      const sourceY = (intersectTop - tileTop) * tileScale;
      const sourceWidth = (intersectRight - intersectLeft) * tileScale;
      const sourceHeight = (intersectBottom - intersectTop) * tileScale;
      const destX = (intersectLeft - rect.left) * captureScale;
      const destY = (intersectTop - rect.top) * captureScale;
      const destWidth = (intersectRight - intersectLeft) * captureScale;
      const destHeight = (intersectBottom - intersectTop) * captureScale;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);
    }

    return encodeCanvas(canvas, 'image/png');
  } finally {
    await browser.scripting.executeScript({ target: { tabId }, func: restorePageCapture, args: [session] }).catch(() => undefined);
  }
}

export async function captureElementPng(tabId: number, windowId: number, rect: InspectRect): Promise<ElementCaptureResult> {
  const [originResult] = await browser.scripting.executeScript({ target: { tabId }, func: readPageSize });
  const origin = originResult?.result as PageSize | undefined;
  if (!origin) throw new Error('Impossibile leggere le dimensioni della pagina. Riprova.');

  try {
    if (elementFitsViewport(rect)) {
      const png = await captureSingleViewport(tabId, windowId, rect);
      return { png, clipped: false };
    }

    const png = await captureTiled(tabId, windowId, rect, origin);
    return { png, clipped: false };
  } finally {
    await browser.scripting.executeScript({ target: { tabId }, func: moveTo, args: [origin.scrollX, origin.scrollY] }).catch(() => undefined);
  }
}
