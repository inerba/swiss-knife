import { formatKilobytes } from './markup';
import type { ContextPayload } from './types';

export interface ReportOptions {
  screenshotFile?: string;
}

const MAX_HOSTS = 5;

export function fence(body: string, language: string): string[] {
  const longest = Math.max(0, ...[...body.matchAll(/`+/g)].map(match => match[0].length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return [`${ticks}${language}`, body, ticks];
}

export function markdownDestination(file: string) {
  return /[\s()<>]/.test(file) ? `<${file}>` : file;
}

// Inline code that survives backticks inside the value (CommonMark code spans).
export function inlineCode(value: string) {
  return value.includes('`') ? `\`\` ${value} \`\`` : `\`${value}\``;
}

export function unreadableNote(hosts: string[]): string | null {
  if (!hosts.length) return null;
  const shown = hosts.slice(0, MAX_HOSTS).join(', ');
  const extra = hosts.length > MAX_HOSTS ? ` and ${hosts.length - MAX_HOSTS} more` : '';
  const noun = hosts.length === 1 ? 'stylesheet' : 'stylesheets';
  return `> ${hosts.length} ${noun} could not be read (cross-origin): ${shown}${extra}`;
}

export function formatReport(payload: ContextPayload, options: ReportOptions = {}): string {
  const { element, path, url, viewport, box, markup, css } = payload;
  const lines = [
    `# ${element}`,
    '',
    `- Page: ${url}`,
    `- Viewport: ${viewport.width} × ${viewport.height} px, ${viewport.devicePixelRatio}x pixel ratio`,
    `- Rendered size: ${box.width} × ${box.height} px at (${box.left}, ${box.top})`,
    `- DOM path: ${path}`,
  ];
  const cssSelector = payload.selectors.find(item => item.kind === 'css-short');
  const xpath = payload.selectors.find(item => item.kind === 'xpath-relative');
  if (cssSelector) lines.push(`- CSS selector: ${inlineCode(cssSelector.value)}`);
  if (xpath) lines.push(`- XPath: ${inlineCode(xpath.value)}`);
  const note = unreadableNote(payload.unreadableSheets);
  if (note) lines.push('', note);
  if (options.screenshotFile) {
    lines.push('', `![Screenshot of ${element}](${markdownDestination(options.screenshotFile)})`);
  }
  lines.push('', '## Markup', '', ...fence(markup, 'html'), '', '## Styles');
  let sections = 0;
  const section = (heading: string, body: string[], separator = '\n\n') => {
    if (!body.length) return;
    sections++;
    lines.push('', `### ${heading}`, '', ...fence(body.join(separator), 'css'));
  };
  section('Matching rules, as authored', css.matched);
  section('Other breakpoints (not currently active)', css.media);
  section(':hover', css.states.hover);
  section(':focus', css.states.focus);
  section(':active', css.states.active);
  section('Inherited from ancestors', css.inherited);
  section('::before', css.pseudos.before);
  section('::after', css.pseudos.after);
  section('Computed values that differ from the browser default', css.resolved, '\n');
  section('CSS variables referenced above', css.variables, '\n');
  if (!sections) lines.push('', 'No matching styles or non-default computed values were found.');
  return `${lines.join('\n')}\n`;
}

// "span.weather__summary" → "weather-summary": the first id or class names the
// capture better than the tag.
export function reportName(element: string): string {
  const match = element.match(/[#.]([^#.:\s>]+)/);
  const raw = match ? match[1]! : element.split(/[#.:\s>]/)[0]!;
  const base = raw
    .replace(/\\/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return base.slice(0, 40) || 'element';
}

export function reportStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatReportStats(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  return `Report: ${formatKilobytes(bytes)} · ~${estimateTokens(text).toLocaleString('it-IT')} token`;
}
