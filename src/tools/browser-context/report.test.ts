import { expect, it } from 'vitest';
import {
  estimateTokens,
  fence,
  formatReport,
  formatReportStats,
  markdownDestination,
  reportName,
  reportStamp,
  unreadableNote,
} from './report';
import { samplePayload } from './test-fixtures';

const FENCE = '`'.repeat(3);

it('formats the full report with only non-empty sections', () => {
  expect(formatReport(samplePayload())).toBe([
    '# div.card',
    '',
    '- Page: https://example.test/pricing',
    '- Viewport: 1440 × 900 px, 2x pixel ratio',
    '- Rendered size: 320 × 412 px at (560, 180)',
    '- DOM path: main#app > div.card',
    '',
    '## Markup',
    '',
    `${FENCE}html`,
    '<div class="card">Hi</div>',
    FENCE,
    '',
    '## Styles',
    '',
    '### Matching rules, as authored',
    '',
    `${FENCE}css`,
    '/* assets/app.css */\n.card { padding: 24px; }',
    FENCE,
    '',
    '### Computed values that differ from the browser default',
    '',
    `${FENCE}css`,
    'padding: 24px;',
    FENCE,
    '',
  ].join('\n'));
});

it('orders every style section as in the spec', () => {
  const payload = samplePayload({
    css: {
      matched: ['m'],
      media: ['b'],
      states: { hover: ['h'], focus: ['f'], active: ['a'] },
      inherited: ['i'],
      pseudos: { before: ['pb'], after: ['pa'] },
      resolved: ['r1;', 'r2;'],
      variables: ['--v: 1px;'],
    },
  });
  const headings = formatReport(payload).split('\n').filter(line => line.startsWith('### '));
  expect(headings).toEqual([
    '### Matching rules, as authored',
    '### Other breakpoints (not currently active)',
    '### :hover',
    '### :focus',
    '### :active',
    '### Inherited from ancestors',
    '### ::before',
    '### ::after',
    '### Computed values that differ from the browser default',
    '### CSS variables referenced above',
  ]);
  expect(formatReport(payload)).toContain('r1;\nr2;');
});

it('adds the screenshot line only when a file is given', () => {
  expect(formatReport(samplePayload())).not.toContain('![Screenshot');
  expect(formatReport(samplePayload(), { screenshotFile: 'card-1.png' })).toContain('\n\n![Screenshot of div.card](card-1.png)\n\n## Markup');
  expect(markdownDestination('card (1).png')).toBe('<card (1).png>');
});

it('notes unreadable stylesheets', () => {
  expect(unreadableNote([])).toBeNull();
  expect(unreadableNote(['a.test'])).toBe('> 1 stylesheet could not be read (cross-origin): a.test');
  expect(unreadableNote(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('> 7 stylesheets could not be read (cross-origin): a, b, c, d, e and 2 more');
  expect(formatReport(samplePayload({ unreadableSheets: ['fonts.example.com'] }))).toContain('- DOM path: main#app > div.card\n\n> 1 stylesheet');
});

it('reports when no styles were found', () => {
  const empty = samplePayload({
    css: { matched: [], media: [], states: { hover: [], focus: [], active: [] }, inherited: [], pseudos: { before: [], after: [] }, resolved: [], variables: [] },
  });
  expect(formatReport(empty)).toContain('## Styles\n\nNo matching styles or non-default computed values were found.\n');
});

it('uses a longer fence when the body contains backticks', () => {
  expect(fence('a ``` b', 'html')).toEqual(['````html', 'a ``` b', '````']);
});

it('derives file names and timestamps', () => {
  expect(reportName('div.card.card--featured')).toBe('card');
  expect(reportName('span.weather__summary')).toBe('weather-summary');
  expect(reportName('main#app')).toBe('app');
  expect(reportName('li:nth-of-type(2)')).toBe('li');
  expect(reportName('###')).toBe('element');
  expect(reportStamp(new Date(2026, 8, 6, 4, 3, 2))).toBe('20260906-040302');
});

it('estimates size and tokens', () => {
  expect(estimateTokens('abcde')).toBe(2);
  expect(formatReportStats('a'.repeat(15_000))).toBe('Report: 15 KB · ~3750 token');
});
