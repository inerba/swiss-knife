/** Swiss Knife always uses the light interface, including legacy dark installations. */
export function applyAppearance(doc = document) {
  doc.documentElement.dataset.theme = 'light';
  doc.documentElement.style.colorScheme = 'light';
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'light');
}
