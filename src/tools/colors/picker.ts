export interface PickedElement { colors: Array<{ value: string; uses: string[]; count: number }>; partial?: boolean; warnings: string[] }
const COLOR_PROPERTIES = ['color','background-color','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','fill','stroke','caret-color','column-rule-color'];
const COLOR_IN_TEXT = /(?:#(?:[\da-f]{3,8})\b|(?:rgba?|hsla?|okl(?:ab|ch)|color)\([^)]*\))/gi;

function parse(value: string, property: string, add: (color: string, use: string) => void) {
  if (!value || value === 'transparent' || value === 'none') return;
  if (/^(rgb|hsl|okl|color)\(/i.test(value) || value.startsWith('#')) add(value, property);
  for (const match of value.matchAll(COLOR_IN_TEXT)) add(match[0], property);
}
export async function collectColors(root: Element, signal: AbortSignal): Promise<PickedElement> {
  const all: Element[] = [root]; const warnings: string[] = []; const found = new Map<string, { value: string; uses: Set<string>; count: number }>();
  function add(value: string, use: string) {
    const sample = document.createElement('i'); sample.style.color = value;
    if (!sample.style.color) return;
    const normalized = sample.style.color;
    if (/rgba?\([^)]*,\s*0\s*\)$/i.test(normalized)) return;
    const item = found.get(normalized) || { value: normalized, uses: new Set<string>(), count: 0 };
    item.uses.add(use); item.count++; found.set(normalized, item);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) { all.push(walker.currentNode as Element); const shadow = (walker.currentNode as Element).shadowRoot; if (shadow) all.push(...Array.from(shadow.querySelectorAll('*'))); }
  const max = Math.min(all.length, 20000); const started = performance.now();
  for (let i = 0; i < max; i++) {
    signal.throwIfAborted();
    const el = all[i]!; const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || (!rect.width && !rect.height && !el.children.length)) continue;
    for (const property of COLOR_PROPERTIES) parse(style.getPropertyValue(property), property === 'color' ? 'testo' : property.includes('background') ? 'sfondo' : property.includes('border') ? 'bordo' : property, add);
    if (style.borderTopStyle !== 'none' && Number.parseFloat(style.borderTopWidth) > 0) parse(style.borderTopColor, 'bordo', add);
    parse(style.backgroundImage, 'gradiente', add); parse(style.boxShadow, 'ombra', add); parse(style.textShadow, 'ombra testo', add);
    for (const pseudo of ['::before','::after']) { const pseudoStyle = getComputedStyle(el, pseudo); if (pseudoStyle.content !== 'none' && pseudoStyle.content !== 'normal') for (const property of COLOR_PROPERTIES) parse(pseudoStyle.getPropertyValue(property), 'pseudo-elemento', add); }
    if (i % 200 === 0) { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); if (performance.now() - started > 10000) return { colors: [...found.values()].map(item => ({ value: item.value, uses: [...item.uses], count: item.count })).sort((a,b) => b.count-a.count), partial: true, warnings: ['Limite di tempo raggiunto: restringi il blocco per completare l’analisi.'] }; }
  }
  if (all.length > max) warnings.push('Limite di 20.000 elementi raggiunto: i risultati sono parziali.');
  return { colors: [...found.values()].map(item => ({ value: item.value, uses: [...item.uses], count: item.count })).sort((a,b) => b.count-a.count), partial: all.length > max, warnings };
}

export function installColorPicker(onPick: (element: Element) => void, onCancel: () => void) {
  const overlay = document.createElement('div'); const box = document.createElement('div'); const hint = document.createElement('div'); let pointed: Element | undefined; const trail: Element[] = [];
  overlay.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'; box.style.cssText = 'position:fixed;outline:2px solid #e85235;background:#e8523522;pointer-events:none;'; hint.style.cssText = 'position:fixed;top:8px;left:8px;background:#24272e;color:#fff;padding:8px 12px;border-radius:8px;font:13px system-ui;'; hint.textContent = 'Colori · Clic/Invio seleziona · ↑ amplia · ↓ restringe · Esc annulla'; overlay.append(box,hint); document.documentElement.append(overlay);
  const style = document.createElement('style'); style.textContent = '* { cursor: crosshair !important; }'; document.documentElement.append(style);
  function draw(el?: Element) { if (!el) return; const rect = el.getBoundingClientRect(); Object.assign(box.style,{ left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px` }); }
  function move(event: PointerEvent) { pointed = document.elementsFromPoint(event.clientX,event.clientY).find(el => el !== overlay); draw(pointed); }
  function stop(event: Event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function dispose() { overlay.remove(); style.remove(); window.removeEventListener('pointermove',move,true); window.removeEventListener('click',click,true); window.removeEventListener('keydown',key,true); ['pointerdown','pointerup','mousedown','mouseup','contextmenu'].forEach(type => window.removeEventListener(type,stop,true)); }
  function choose() { if (!pointed) return; dispose(); onPick(pointed); }
  function click(event: MouseEvent) { stop(event); choose(); }
  function key(event: KeyboardEvent) { if (event.key === 'Escape') { stop(event); dispose(); onCancel(); } else if (event.key === 'Enter') { stop(event); choose(); } else if (event.key === 'ArrowUp' && pointed?.parentElement) { stop(event); trail.push(pointed); pointed = pointed.parentElement; draw(pointed); } else if (event.key === 'ArrowDown') { const child = trail.pop(); if (child) { stop(event); pointed = child; draw(child); } } }
  window.addEventListener('pointermove',move,true); window.addEventListener('click',click,true); window.addEventListener('keydown',key,true); ['pointerdown','pointerup','mousedown','mouseup','contextmenu'].forEach(type => window.addEventListener(type,stop,true));
  return dispose;
}
