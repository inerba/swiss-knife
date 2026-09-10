# Privacy practices — testi da incollare

Chrome Web Store · Swiss Knife 1.2.0

Ogni campo ha un limite di 1.000 caratteri; la lunghezza effettiva e indicata sotto ogni titolo.
I testi sono in inglese perche li legge il team di revisione di Google.

**Remote code use:** seleziona "No, I am not using remote code". Verificato sul pacchetto:
nessuno script remoto, nessun `eval` o `new Function`, i due `import()` dinamici puntano a file locali.

**Data usage:** rispondi "no" a tutte le categorie di dati raccolti, poi spunta le tre certificazioni.

---

## Single purpose description

*480 caratteri*

```
Swiss Knife is a utility panel for the web page the user is currently viewing. Every tool answers the same need — inspecting, measuring, capturing or generating content for that page — and they are all surfaced in a single side panel, so the user never has to leave the tab.

The extension is inert until the user opens the panel and starts a specific action. It does not run on page load, does not modify pages on its own, and has no background behavior beyond opening the panel.
```

## activeTab justification

*469 caratteri*

```
Swiss Knife only acts on the tab the user explicitly opens it on. Clicking the extension icon grants temporary access to that tab, and that grant is what allows the tools to run: capturing a screenshot, sampling a color, inspecting an element, reading a QR code in the page, or listing embedded frames.

activeTab is used precisely so that access stays scoped to one user-initiated action on one tab, instead of requiring permanent access to every site the user visits.
```

## scripting justification

*463 caratteri*

```
The page-facing tools (screenshot, color eyedropper, element inspector, contrast sampler, media collector, form filler, in-page QR reader, iframe lister) must run in the page context to read the DOM, computed styles and rendered geometry.

chrome.scripting is used to inject those scripts only when the user starts a specific action from the panel, and only into the tab granted by activeTab. Nothing is injected on page load, on navigation, or in the background.
```

## sidePanel justification

*374 caratteri*

```
The entire user interface is a side panel. sidePanel is required to display it alongside the page, so the page stays visible and interactive while a tool is in use.

This is a functional requirement, not a stylistic one: the element picker, the color eyedropper and the rectangle screenshot tool all need the user to click on the page itself, which would dismiss a popup UI.
```

## downloads justification

*429 caratteri*

```
Used to save files the user explicitly requests: screenshots (PNG, JPEG, WebP), generated QR codes (PNG, SVG), inspected element snippets and previews, and media files the user selected from the page.

chrome.downloads routes these through the browser's own download manager, so the user retains control over the destination and can see the file in their download history. It is never invoked without a direct click in the panel.
```

## storage justification

*371 caratteri*

```
Used only for local user preferences: which tools are visible and in what order, saved QR style presets, the color history (up to 50 entries), and per-tool options such as the form filler's language and test password.

All values remain in the local browser profile. No page content, browsing history, URLs or personal data is stored, and nothing is transmitted anywhere.
```

## clipboardWrite justification

*399 caratteri*

```
Used to copy results the user asks to copy: a sampled color code, an emoji, generated Lorem Ipsum text, a generated password, a conversion or hash result, an HTML/CSS snippet, or a captured screenshot image.

Every copy is triggered by an explicit button in the panel. The extension does not request clipboard read access; pasting an image into the QR reader is handled by a normal user paste event.
```
