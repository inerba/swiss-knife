import { beforeEach, expect, it } from 'vitest';
import { accessibleName, implicitRole, jsString, playwrightLocators } from './locators';

beforeEach(() => { document.body.innerHTML = ''; });

function pick(selector: string) {
  return document.querySelector(selector)!;
}

it('quotes javascript strings', () => {
  expect(jsString("l'utente \\ ok")).toBe("'l\\'utente \\\\ ok'");
});

it('maps implicit roles', () => {
  document.body.innerHTML = [
    '<a href="/x">x</a><a>no href</a><button>b</button><input type="submit" value="Invia">',
    '<h2>t</h2><input type="email"><input type="password"><input type="checkbox"><select></select>',
    '<img alt="Logo"><nav></nav><div role="tab"></div><div></div>',
  ].join('');
  expect(implicitRole(pick('a[href]'))).toBe('link');
  expect(implicitRole(pick('a:not([href])'))).toBeNull();
  expect(implicitRole(pick('button'))).toBe('button');
  expect(implicitRole(pick('input[type="submit"]'))).toBe('button');
  expect(implicitRole(pick('h2'))).toBe('heading');
  expect(implicitRole(pick('input[type="email"]'))).toBe('textbox');
  expect(implicitRole(pick('input[type="password"]'))).toBeNull();
  expect(implicitRole(pick('input[type="checkbox"]'))).toBe('checkbox');
  expect(implicitRole(pick('select'))).toBe('combobox');
  expect(implicitRole(pick('img'))).toBe('img');
  expect(implicitRole(pick('nav'))).toBe('navigation');
  expect(implicitRole(pick('[role="tab"]'))).toBe('tab');
  expect(implicitRole(pick('div:not([role])'))).toBeNull();
});

it('computes accessible names from aria, labels, alt and text', () => {
  document.body.innerHTML = [
    '<button aria-label="Chiudi">x</button>',
    '<span id="lbl">Cerca prodotti</span><input aria-labelledby="lbl">',
    '<label for="email">Email<sup>*</sup></label><input id="email" type="email">',
    '<label>Ricordami <input type="checkbox"></label>',
    '<img alt="Logo">',
    '<button>  Accedi   ora </button>',
    '<input type="submit" value="Invia">',
  ].join('');
  expect(accessibleName(pick('button[aria-label]'))).toBe('Chiudi');
  expect(accessibleName(pick('input[aria-labelledby]'))).toBe('Cerca prodotti');
  expect(accessibleName(pick('#email'))).toBe('Email*');
  expect(accessibleName(pick('input[type="checkbox"]'))).toBe('Ricordami');
  expect(accessibleName(pick('img'))).toBe('Logo');
  expect(accessibleName(pick('button:not([aria-label])'))).toBe('Accedi ora');
  expect(accessibleName(pick('input[type="submit"]'))).toBe('Invia');
});

it('suggests test id, role and label locators with counts', () => {
  document.body.innerHTML = [
    '<label for="email">Email</label><input id="email" type="email" placeholder="nome@esempio.it" data-testid="email">',
    '<button type="submit">Accedi</button><button type="button">Accedi</button>',
  ].join('');
  expect(playwrightLocators(pick('input'))).toEqual([
    { value: "getByTestId('email')", matches: 1, estimated: false },
    { value: "getByRole('textbox', { name: 'Email', exact: true })", matches: 1, estimated: true },
    { value: "getByLabel('Email', { exact: true })", matches: 1, estimated: true },
  ]);
  expect(playwrightLocators(pick('button[type="submit"]'))).toEqual([
    { value: "getByRole('button', { name: 'Accedi', exact: true })", matches: 2, estimated: true },
    { value: "getByText('Accedi', { exact: true })", matches: 2, estimated: true },
  ]);
});

it('falls back to placeholder, alt text and plain text', () => {
  document.body.innerHTML = '<input placeholder="Cerca"><img alt="Logo aziendale"><p>Benvenuto</p><div></div>';
  expect(playwrightLocators(pick('input'))[0]).toEqual({ value: "getByPlaceholder('Cerca', { exact: true })", matches: 1, estimated: false });
  expect(playwrightLocators(pick('img'))).toContainEqual({ value: "getByAltText('Logo aziendale', { exact: true })", matches: 1, estimated: false });
  expect(playwrightLocators(pick('p'))).toEqual([{ value: "getByText('Benvenuto', { exact: true })", matches: 1, estimated: true }]);
  expect(playwrightLocators(pick('div'))).toEqual([]);
});
