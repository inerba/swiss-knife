# Privacy practices — testi da incollare

Chrome Web Store · Swiss Knife 1.3.0

Ogni campo ha un limite di 1.000 caratteri; la lunghezza effettiva e indicata sotto ogni titolo.
I testi sono in inglese perche li legge il team di revisione di Google.

**Remote code use:** seleziona "No, I am not using remote code". Verificato sul pacchetto:
nessuno script remoto, nessun `eval` o `new Function`, i due `import()` dinamici puntano a file locali.

**Data usage:** rispondi "no" a tutte le categorie di dati raccolti, poi spunta le tre certificazioni.

---

## Single purpose description

*551 caratteri*

```
Swiss Knife is a utility toolbox for the web page the user is currently viewing. Every tool answers the same need — inspecting, measuring, capturing or generating content for that page — and they are all surfaced in one interface: a small floating window inside the page (default) or Chrome's side panel, as the user chooses in the settings.

The extension is inert until the user clicks its icon and starts a specific action. It does not run on page load, does not modify pages on its own, and has no background behavior beyond opening its interface.
```

## activeTab justification

*469 caratteri*

```
Swiss Knife only acts on the tab the user explicitly opens it on. Clicking the extension icon grants temporary access to that tab, and that grant is what allows the tools to run: capturing a screenshot, sampling a color, inspecting an element, reading a QR code in the page, or listing embedded frames.

activeTab is used precisely so that access stays scoped to one user-initiated action on one tab, instead of requiring permanent access to every site the user visits.
```

## scripting justification

*539 caratteri*

```
The page-facing tools (screenshot, color eyedropper, element inspector, contrast sampler, media collector, form filler, in-page QR reader, iframe lister) must run in the page context to read the DOM, computed styles and rendered geometry. The floating window is also inserted into the page by a bundled script.

chrome.scripting injects those scripts only when the user clicks the extension icon or starts a specific action, and only into the tab granted by activeTab. Nothing is injected on page load, on navigation, or in the background.
```

## sidePanel justification

*530 caratteri*

```
The user can choose Chrome's side panel as the interface instead of the in-page floating window, and the side panel is also used as a fallback on pages where the floating window cannot appear (browser pages, the Web Store). sidePanel is required to open it, and to disable it while the floating window mode is selected so the icon opens only one interface.

The side panel keeps the page visible and interactive: the element picker, the color eyedropper and the rectangle screenshot tool need the user to click on the page itself.
```

## downloads justification

*445 caratteri*

```
Used to save files the user explicitly requests: screenshots (PNG, JPEG, WebP), generated QR codes (PNG, SVG), inspected element snippets and previews, and media files the user selected from the page.

chrome.downloads routes these through the browser's own download manager, so the user retains control over the destination and can see the file in their download history. It is never invoked without a direct click in the extension's interface.
```

## storage justification

*461 caratteri*

```
Used only for local user preferences: which tools are visible and in what order, the opening mode (floating window or side panel) and the floating window's last position, saved QR style presets, the color history (up to 50 entries), and per-tool options such as the form filler's language and test password.

All values remain in the local browser profile. No page content, browsing history, URLs or personal data is stored, and nothing is transmitted anywhere.
```

## clipboardWrite justification

*415 caratteri*

```
Used to copy results the user asks to copy: a sampled color code, an emoji, generated Lorem Ipsum text, a generated password, a conversion or hash result, an HTML/CSS snippet, or a captured screenshot image.

Every copy is triggered by an explicit button in the extension's interface. The extension does not request clipboard read access; pasting an image into the QR reader is handled by a normal user paste event.
```
