import { OUTLINE_CLASS } from './path';

export const MARKUP_LIMIT = 60_000;
const LONG_VALUE = 200;

export function formatKilobytes(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function shortenDataUri(value: string): string {
  if (!value.startsWith('data:') || value.length <= LONG_VALUE) return value;
  const comma = value.indexOf(',');
  if (comma < 0) return value;
  const meta = value.slice(5, comma);
  const data = value.slice(comma + 1);
  const bytes = /;base64$/i.test(meta) ? Math.floor((data.length * 3) / 4) : data.length;
  return `data:${meta},…(${formatKilobytes(bytes)})`;
}

function cleanElement(element: Element) {
  for (const attribute of [...element.attributes]) {
    if (attribute.name.toLowerCase().startsWith('data-swiss-')) {
      element.removeAttribute(attribute.name);
    } else if (attribute.value.startsWith('data:')) {
      element.setAttribute(attribute.name, shortenDataUri(attribute.value));
    }
  }
  if (element.classList.contains(OUTLINE_CLASS)) {
    element.classList.remove(OUTLINE_CLASS);
    if (!element.classList.length) element.removeAttribute('class');
  }
}

export function truncateMarkup(html: string): string {
  return html.length > MARKUP_LIMIT
    ? `${html.slice(0, MARKUP_LIMIT)}\n<!-- truncated: element markup exceeds 60 KB -->`
    : html;
}

export function cleanMarkup(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  cleanElement(clone);
  clone.querySelectorAll('*').forEach(cleanElement);
  return truncateMarkup(clone.outerHTML);
}
