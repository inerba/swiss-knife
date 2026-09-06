import type { MediaCandidate, MediaSelection, MediaKind } from './types';
import { mediaKind } from './format';

// CSS values can contain quoted commas, parentheses and escaped characters.
export function cssImageUrls(value: string): string[] {
  const urls: string[] = [];
  const token = /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^)\\])*))\s*\)|(?:image-set\(|,)\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/gi;
  for (const match of value.matchAll(token)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5];
    if (raw) urls.push(raw.trim().replace(/\\([\da-f]{1,6}\s?|.)/gi, (_, escaped: string) => {
      return /^[\da-f]{1,6}\s?$/i.test(escaped) ? String.fromCodePoint(parseInt(escaped.trim(), 16) || 0xfffd) : escaped;
    }));
  }
  return urls;
}

export interface CollectedSelection extends MediaSelection { owners: Map<string, Document> }
export async function collectMedia(doc: Document, x: number, y: number, signal: AbortSignal, selected?: Element): Promise<CollectedSelection> {
  const found = new Map<string, MediaCandidate>();
  const owners = new Map<string, Document>();
  const warnings = new Set<string>();
  let count = 0;
  const contains = (rect: DOMRect, px: number, py: number) => rect.width > 0 && rect.height > 0 && px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
  function add(raw: string, source: string, element: Element, width?: number, height?: number, kind: MediaKind = 'image', duration?: number) {
    if (!raw.trim()) return;
    try {
      const url = new URL(raw, element.ownerDocument.baseURI).href;
      if (!/^(https?:|data:(?:image|video|audio)\/|data:text\/vtt[;,]|blob:)/i.test(url)) return;
      const old = found.get(url);
      if (old) { if (!old.sources.includes(source)) old.sources.push(source); return; }
      const id = String(found.size + 1);
      found.set(url, { id, url, sources: [source], width: width || null, height: height || null, kind: mediaKind(url) === 'stream' ? 'stream' : kind, duration: Number.isFinite(duration) ? duration : null });
      owners.set(id, element.ownerDocument);
    } catch { /* An invalid page URL is not a downloadable image. */ }
  }
  async function rootAt(root: Document | ShadowRoot, px: number, py: number, includeAll = false) {
    const view = root.ownerDocument?.defaultView ?? (root as Document).defaultView;
    if (!view) return;
    const hits = new Set(root.elementsFromPoint?.(px, py) ?? []);
    const walker = (root.ownerDocument ?? root as Document).createTreeWalker(root, 1);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      signal.throwIfAborted();
      if (++count % 200 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const element = node as Element;
      if (element.hasAttribute('data-swiss-picker')) continue;
      const style = view.getComputedStyle(element);
      const inSelection = includeAll || !!selected && (element === selected || selected.contains(element));
      if (!inSelection && (style.display === 'none' || style.visibility === 'hidden')) continue;
      const rect = element.getBoundingClientRect();
      const underPoint = hits.has(element) || [...element.getClientRects()].some(r => contains(r, px, py));
      if (underPoint || inSelection) {
        if (element.localName === 'img') {
          const img = element as HTMLImageElement;
          if (img.currentSrc || img.getAttribute('src')?.trim()) add(img.currentSrc || img.src, 'Immagine', element, img.naturalWidth, img.naturalHeight);
        }
        if (element.localName === 'image') {
          const raw = element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
          if (raw) add(raw, 'Immagine SVG referenziata', element);
        }
        if (element.localName === 'video' || element.localName === 'audio') {
          const media = element as HTMLVideoElement;
          const kind = element.localName as 'video' | 'audio';
          const source = kind === 'video' ? 'Video' : 'Audio';
          if (media.currentSrc || media.getAttribute('src')?.trim()) add(media.currentSrc || media.src, source, element, media.videoWidth, media.videoHeight, kind, media.duration);
          for (const child of media.querySelectorAll('source[src]')) add(child.getAttribute('src')!, `${source}: sorgente`, child, undefined, undefined, kind);
          for (const track of media.querySelectorAll('track[src]')) add(track.getAttribute('src')!, 'Sottotitoli', track, undefined, undefined, 'subtitle');
          if (media.poster) add(media.poster, 'Poster del video', element);
          if (media.srcObject) warnings.add('Un contenuto in diretta usa uno stream senza URL file scaricabile.');
        }
        if (element.localName === 'a') {
          const link = element as HTMLAnchorElement;
          const kind = mediaKind(link.href, link.type);
          if (kind) add(link.href, 'Collegamento a file multimediale', element, undefined, undefined, kind);
        }
        if (element.localName === 'embed' || element.localName === 'object') {
          const raw = element.getAttribute('src') || element.getAttribute('data') || '';
          const kind = mediaKind(raw, element.getAttribute('type') || '');
          if (kind) add(raw, 'File incorporato', element, undefined, undefined, kind);
        }
        for (const url of cssImageUrls(style.backgroundImage)) add(url, 'Sfondo CSS', element);
        for (const pseudo of ['::before', '::after']) {
          const css = view.getComputedStyle(element, pseudo);
          if (css.content === 'none' || css.display === 'none') continue;
          for (const url of cssImageUrls(`${css.backgroundImage} ${css.content}`)) add(url, `${pseudo}: possibile immagine associata`, element);
        }
        if (element.localName === 'iframe') {
          const frame = element as HTMLIFrameElement;
          try {
            if (frame.contentDocument && frame.contentWindow) {
              const sx = rect.width / (frame.offsetWidth || rect.width);
              const sy = rect.height / (frame.offsetHeight || rect.height);
              await rootAt(frame.contentDocument, (px - rect.left) / sx - frame.clientLeft, (py - rect.top) / sy - frame.clientTop, inSelection);
            } else warnings.add('Un iframe sotto il punto non è accessibile (dominio diverso o contenuto non caricato).');
          } catch { warnings.add('Un iframe sotto il punto non è accessibile.'); }
        }
      }
      // Open shadows may contain positioned children outside the host box.
      if (element.shadowRoot) await rootAt(element.shadowRoot, px, py, inSelection);
    }
  }
  await rootAt(doc, x, y);
  return { images: [...found.values()], owners, warnings: [...warnings], pageUrl: doc.URL };
}
