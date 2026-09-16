import { browser } from 'wxt/browser';
import { formatReport, reportName, reportStamp } from './report';
import type { ContextResult } from './types';

export const DOWNLOAD_FOLDER = 'swiss-knife/browser-context';
const WAIT_MS = 20_000;

export type DownloadOutcome = 'complete' | 'no-screenshot' | 'screenshot-failed';

interface DownloadDelta {
  id: number;
  state?: { current?: string };
}

export function waitForDownload(id: number, timeoutMs = WAIT_MS): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.downloads.onChanged.removeListener(listener);
      resolve(ok);
    };
    const listener = (delta: DownloadDelta) => {
      if (delta.id !== id) return;
      if (delta.state?.current === 'complete') finish(true);
      else if (delta.state?.current === 'interrupted') finish(false);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    browser.downloads.onChanged.addListener(listener);
    // The download may already be over before the listener was attached.
    void browser.downloads.search({ id }).then(([item]) => {
      if (item?.state === 'complete') finish(true);
      else if (item?.state === 'interrupted') finish(false);
    }, () => {});
  });
}

function basename(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export async function downloadReport(result: ContextResult, now = new Date()): Promise<DownloadOutcome> {
  const base = `${DOWNLOAD_FOLDER}/${reportName(result.element)}-${reportStamp(now)}`;
  let screenshotFile: string | undefined;
  let outcome: DownloadOutcome = 'no-screenshot';
  if (result.png) {
    outcome = 'screenshot-failed';
    try {
      const id = await browser.downloads.download({
        url: result.png,
        filename: `${base}.png`,
        saveAs: false,
        conflictAction: 'uniquify',
      });
      if (await waitForDownload(id)) {
        const [item] = await browser.downloads.search({ id });
        screenshotFile = basename(item?.filename || `${base}.png`);
        outcome = 'complete';
      }
    } catch { /* The report is still saved, without the image. */ }
  }
  const url = URL.createObjectURL(new Blob([formatReport(result, { screenshotFile })], { type: 'text/markdown;charset=utf-8' }));
  try {
    await browser.downloads.download({
      url,
      filename: `${base}.md`,
      saveAs: false,
      conflictAction: 'uniquify',
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return outcome;
}
