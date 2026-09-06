import { faker as fakerEN } from '@faker-js/faker/locale/en';
import { faker as fakerIT } from '@faker-js/faker/locale/it';
import { browser } from 'wxt/browser';

type Preferences = { locale: 'en' | 'it'; password: string; ignored: string; preserveExisting: boolean };
type Report = { filled: number; ignored: number; failed: number; message?: string };

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & { __swissFormFillerCleanup?: () => void };
  scope.__swissFormFillerCleanup?.();
  let cleanup = () => {};
  browser.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'swiss-form-filler-start') return;
    try { cleanup(); cleanup = installPicker(message.preferences as Preferences); respond({ ok: true }); } catch (error) { respond({ ok: false, error: error instanceof Error ? error.message : String(error) }); }
  });
  function installPicker(preferences: Preferences) {
    const controller = new AbortController(); const overlay = document.createElement('div'); const box = document.createElement('div'); const hint = document.createElement('div'); let current: Element | null = null;
    overlay.setAttribute('data-swiss-form-filler', ''); overlay.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const shadow = overlay.attachShadow({ mode: 'closed' }); box.style.cssText = 'position:fixed;display:none;outline:3px solid #9d3024;background:#9d302422;pointer-events:none;'; hint.style.cssText = 'position:fixed;top:8px;left:8px;max-width:90vw;background:#24272e;color:white;padding:8px 12px;border-radius:8px;font:13px system-ui;pointer-events:none;'; shadow.append(box, hint); document.documentElement.append(overlay);
    const style = document.createElement('style'); style.setAttribute('data-swiss-form-filler', ''); style.textContent = '* { cursor: crosshair !important; }'; document.documentElement.append(style);
    function show(element: Element) { current = element; const rect = element.getBoundingClientRect(); Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` }); hint.textContent = `${element.localName}${element.id ? `#${element.id}` : ''} · clic/Invio compila · ↑ amplia · ↓ restringe · Esc annulla`; }
    function cancel() { controller.abort(); overlay.remove(); style.remove(); if (scope.__swissFormFillerCleanup === cancel) delete scope.__swissFormFillerCleanup; }
    function finish() { const target = current; cancel(); if (!target) return; try { const report = fill(target, preferences); void browser.runtime.sendMessage({ type: 'swiss-form-filler-report', report }); } catch (error) { void browser.runtime.sendMessage({ type: 'swiss-form-filler-error', error: error instanceof Error ? error.message : String(error) }); } }
    document.addEventListener('pointermove', event => { const element = document.elementFromPoint(event.clientX, event.clientY); if (element && element !== overlay) show(element); }, { signal: controller.signal, capture: true });
    document.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); finish(); }, { signal: controller.signal, capture: true });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); void browser.runtime.sendMessage({ type: 'swiss-form-filler-cancelled' }); } else if (event.key === 'Enter' && current) { event.preventDefault(); finish(); } else if (event.key === 'ArrowUp' && current?.parentElement) { event.preventDefault(); show(current.parentElement); } else if (event.key === 'ArrowDown' && current?.firstElementChild) { event.preventDefault(); show(current.firstElementChild); } }, { signal: controller.signal, capture: true });
    window.addEventListener('pagehide', cancel, { once: true }); scope.__swissFormFillerCleanup = cancel; hint.textContent = 'Punta un contenitore · clic/Invio compila · ↑ amplia · ↓ restringe · Esc annulla'; return cancel;
  }
});

function fill(container: Element, preferences: Preferences): Report {
  const fields = [container, ...container.querySelectorAll('input, textarea, select')].filter((node, index, list): node is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => index === list.indexOf(node) && node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement);
  const ignoredWords = preferences.ignored.split(',').map(word => word.trim().toLowerCase()).filter(Boolean); const contexts = new Map<Element, Context>(); let filled = 0; let ignored = 0; let failed = 0;
  for (const field of fields) { if (mustIgnore(field, preferences, ignoredWords)) { ignored++; continue; } const group = field.form || container; let context = contexts.get(group); if (!context) { context = createContext(preferences); contexts.set(group, context); } try { const value = valueFor(field, context, group); if (value == null) { ignored++; continue; } apply(field, value); if (field.willValidate && !field.checkValidity()) { failed++; continue; } filled++; } catch { failed++; } }
  return { filled, ignored, failed, message: `Compilazione completata: ${filled} campi compilati.` };
}
type Context = { faker: typeof fakerEN; first: string; last: string; email: string; password: string; locale: 'en' | 'it' };
function createContext(preferences: Preferences): Context { const faker = preferences.locale === 'it' ? fakerIT : fakerEN; const first = faker.person.firstName(); const last = faker.person.lastName(); return { faker, first, last, email: faker.internet.email({ firstName: first, lastName: last }).toLowerCase(), password: preferences.password || faker.internet.password({ length: 16, memorable: false, prefix: 'A1!' }), locale: preferences.locale }; }
function metadata(field: Element) { const input = field as HTMLInputElement; const labels = input.labels ? Array.from(input.labels).map(label => label.textContent) : []; return [input.autocomplete, input.type, input.id, input.getAttribute('name'), input.getAttribute('aria-label'), input.getAttribute('aria-labelledby') && document.getElementById(input.getAttribute('aria-labelledby') || '')?.textContent, input.getAttribute('placeholder'), ...labels].filter(Boolean).join(' ').toLowerCase(); }
function mustIgnore(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, preferences: Preferences, ignoredWords: string[]) { const input = field as HTMLInputElement; const readOnly = field instanceof HTMLSelectElement ? false : field.readOnly; const preservesValue = !(field instanceof HTMLSelectElement) && input.type !== 'checkbox' && input.type !== 'radio' && preferences.preserveExisting && !!field.value; const meta = metadata(field); return input.type === 'hidden' || input.type === 'file' || ['button', 'submit', 'reset', 'image'].includes(input.type) || field.disabled || readOnly || !field.getClientRects().length || preservesValue || /captcha|recaptcha/.test(meta) || ignoredWords.some(word => meta.includes(word)); }
type FillValue = string | boolean | { selectIndex: number };
function valueFor(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, context: Context, group: Element): FillValue | null {
  const input = field as HTMLInputElement; const meta = metadata(field); const f = context.faker;
  if (input.type === 'checkbox') return true;
  if (input.type === 'radio') { const radios = Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(item => item.name === input.name && !item.disabled && item.getClientRects().length); return radios[0] === input ? true : null; }
  if (field instanceof HTMLSelectElement) { const indices = Array.from(field.options).flatMap((option, index) => !option.disabled && !(index === 0 && /select|choose|scegli|--/.test(option.text)) ? [index] : []); if (!indices.length) return null; return { selectIndex: indices[f.number.int({ min: 0, max: indices.length - 1 })]! }; }
  if (input.type === 'password' || /password|passcode/.test(meta)) return context.password;
  if (input.type === 'email' || /e-?mail/.test(meta)) return context.email;
  if (input.type === 'tel' || /phone|telephone|telefono|cellulare/.test(meta)) return f.phone.number();
  if (input.type === 'number' || /quantity|amount|number|numero/.test(meta)) return String(f.number.int({ min: 1, max: 99 }));
  if (input.type === 'date') return f.date.past({ years: 20 }).toISOString().slice(0, 10);
  if (/first.?name|nome/.test(meta) && !/last|cognome/.test(meta)) return context.first;
  if (/last.?name|surname|cognome/.test(meta)) return context.last;
  if (/user.?name|utente/.test(meta)) return f.internet.username({ firstName: context.first, lastName: context.last });
  if (/company|azienda|organizzazione/.test(meta)) return f.company.name();
  if (/address|indirizzo|street/.test(meta)) return f.location.streetAddress();
  if (/city|città|comune/.test(meta)) return f.location.city();
  if (/zip|postal|cap/.test(meta)) return f.location.zipCode();
  if (field instanceof HTMLTextAreaElement || /message|messaggio|comment|descrizione|note/.test(meta)) return context.locale === 'it' ? 'Questo è un messaggio di prova generato automaticamente.' : 'This is an automatically generated test message.';
  return f.lorem.words({ min: 2, max: 5 });
}
function apply(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: FillValue) { if (field instanceof HTMLSelectElement && typeof value === 'object') { const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex')?.set; setter?.call(field, value.selectIndex); } else if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set; setter?.call(field, value); } else { const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set; setter?.call(field, value); } field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); }
