export function installContrastPicker(onPick: (element: Element) => void, onCancel: () => void) {
  const overlay = document.createElement('div');
  const box = document.createElement('div');
  const hint = document.createElement('div');
  let pointed: Element | undefined;
  const trail: Element[] = [];
  overlay.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  box.style.cssText = 'position:fixed;outline:2px solid #9d3024;background:#9d302422;pointer-events:none;';
  hint.style.cssText = 'position:fixed;top:8px;left:8px;background:#24272e;color:#fff;padding:8px 12px;border-radius:8px;font:13px system-ui;';
  hint.textContent = 'Contrasti · Clic/Invio seleziona · ↑ amplia · ↓ restringe · Esc annulla';
  overlay.append(box, hint);
  document.documentElement.append(overlay);
  const style = document.createElement('style');
  style.textContent = '* { cursor: crosshair !important; }';
  document.documentElement.append(style);

  function draw(el?: Element) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }
  function move(event: PointerEvent) {
    pointed = document.elementsFromPoint(event.clientX, event.clientY).find(el => el !== overlay);
    draw(pointed);
  }
  function stop(event: Event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function dispose() {
    overlay.remove();
    style.remove();
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('click', click, true);
    window.removeEventListener('keydown', key, true);
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'contextmenu']) {
      window.removeEventListener(type, stop, true);
    }
  }
  function choose() { if (!pointed) return; dispose(); onPick(pointed); }
  function click(event: MouseEvent) { stop(event); choose(); }
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape') { stop(event); dispose(); onCancel(); }
    else if (event.key === 'Enter') { stop(event); choose(); }
    else if (event.key === 'ArrowUp' && pointed?.parentElement) {
      stop(event); trail.push(pointed); pointed = pointed.parentElement; draw(pointed);
    } else if (event.key === 'ArrowDown') {
      const child = trail.pop();
      if (child) { stop(event); pointed = child; draw(child); }
    }
  }
  window.addEventListener('pointermove', move, true);
  window.addEventListener('click', click, true);
  window.addEventListener('keydown', key, true);
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'contextmenu']) {
    window.addEventListener(type, stop, true);
  }
  return dispose;
}
