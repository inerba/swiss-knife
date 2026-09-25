/** Copies with the legacy command, which needs only the user's click, not the Clipboard API policy. */
export function copyWithCommand(text: string) {
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0;pointer-events:none;';
  document.body.append(field);
  field.focus();
  field.select();
  try { return document.execCommand('copy'); } finally { field.remove(); previous?.focus?.(); }
}

/** Some pages deny the Clipboard API to embedded frames (Permissions-Policy): text copies fall back to the command. */
export function installClipboardFallback(clipboard: Clipboard | undefined = navigator.clipboard) {
  if (!clipboard) return;
  const writeText = clipboard.writeText.bind(clipboard);
  clipboard.writeText = async text => {
    try { await writeText(text); } catch (error) { if (!copyWithCommand(text)) throw error; }
  };
}
