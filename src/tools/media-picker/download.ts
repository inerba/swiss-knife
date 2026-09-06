export function downloadUrl(row: { url: string; details: { objectUrl?: string } }) {
  if (row.details.objectUrl) return row.details.objectUrl;
  if (row.url.startsWith('blob:')) return undefined;
  return row.url;
}

export function bulkDownloadPath(filename: string, pageUrl: string) {
  let host = 'pagina';
  try { host = new URL(pageUrl).hostname || host; } catch { /* Keep the generic folder. */ }
  host = host.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^[. ]+|[. ]+$/g, '') || 'pagina';
  return `cattura-media/${host}/${filename}`;
}

export function bulkDownloadSummary(started: number, failed: number, skipped: number) {
  if (!started && !failed) return skipped === 1 ? '1 file non è scaricabile.' : `${skipped} file non sono scaricabili.`;
  const parts = [`${started} download ${started === 1 ? 'avviato' : 'avviati'}`];
  if (failed) parts.push(`${failed} non ${failed === 1 ? 'riuscito' : 'riusciti'}`);
  if (skipped) parts.push(`${skipped} non ${skipped === 1 ? 'scaricabile' : 'scaricabili'}`);
  return `${parts.join('. ')}.`;
}
