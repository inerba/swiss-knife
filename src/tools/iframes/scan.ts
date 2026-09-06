export interface IframeResult {
  id: number;
  title: string;
  depth: number;
  url: string;
  reason: string | null;
  inaccessible: boolean;
}
export interface ScanResult {
  frames: IframeResult[];
  pageUrl: string;
  inaccessibleCount: number;
}
// Self-contained: Chrome serializes this function for isolated-world injection.
export function scanIframes(): ScanResult {
  const frames: IframeResult[] = [];
  const visited = new Set<Document>();
  function visitDocument(doc: Document, depth: number) {
    if (visited.has(doc)) return;
    visited.add(doc);
    visitRoot(doc, depth);
  }
  function visitRoot(root: Document | ShadowRoot, depth: number) {
    for (const element of root.querySelectorAll('*')) {
      if (element.localName === 'iframe') {
        const frame = element as HTMLIFrameElement;
        const raw = frame.getAttribute('src')?.trim();
        let url = '';
        let reason: string | null = null;
        if (frame.hasAttribute('srcdoc')) reason = 'Contenuto inline (srcdoc): nessun URL apribile.';
        else if (!raw) reason = 'Nessun URL sorgente.';
        else {
          try {
            const parsed = new URL(raw, frame.ownerDocument.baseURI);
            url = parsed.href;
            if (!['http:', 'https:'].includes(parsed.protocol)) reason = 'Schema URL non supportato.';
          } catch { reason = 'URL non valido.'; }
        }
        const result: IframeResult = {
          id: frames.length + 1,
          title: frame.title.trim() || frame.id || frame.name || `Iframe ${frames.length + 1}`,
          depth, url, reason, inaccessible: false,
        };
        frames.push(result);
        try {
          const child = frame.contentDocument;
          if (child) visitDocument(child, depth + 1);
          else result.inaccessible = true;
        } catch { result.inaccessible = true; }
      }
      if (element.shadowRoot) visitRoot(element.shadowRoot, depth);
    }
  }
  visitDocument(document, 0);
  return { frames, pageUrl: document.URL, inaccessibleCount: frames.filter(frame => frame.inaccessible).length };
}
