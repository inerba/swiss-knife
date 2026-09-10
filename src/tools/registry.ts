import type { ToolDefinition } from './types';
import { IframeTool } from './iframes/IframeTool';
import { MediaPickerTool } from './media-picker/MediaPickerTool';
import { ScreenshotTool } from './screenshots/ScreenshotTool';
import { LoremIpsumTool } from './lorem-ipsum/LoremIpsumTool';
import { FormFillerTool } from './form-filler/FormFillerTool';
import { ColorsTool } from './colors/ColorsTool';
import { ContrastTool } from './contrast/ContrastTool';
import { InspectSaveTool } from './inspect-save/InspectSaveTool';
import { EmojiTool } from './emoji/EmojiTool';
export const tools: ToolDefinition[] = [{
  id: 'iframes', name: 'Elenca iframe', icon: PanelsTopLeft,
  description: 'Trova i contenuti incorporati e apri il loro URL in una nuova scheda.',
  component: IframeTool,
}, {
  id: 'media-picker', name: 'Cattura file multimediali', icon: ScanEye,
  description: 'Seleziona un elemento e scarica immagini, video e audio al suo interno.',
  component: MediaPickerTool,
}, {
  id: 'screenshot', name: 'Screenshot', icon: Camera,
  description: 'Scarica la pagina intera, la schermata o un rettangolo selezionato.',
  component: ScreenshotTool,
}, {
  id: 'lorem-ipsum', name: 'Lorem Ipsum', icon: FileText,
  description: 'Genera paragrafi Lorem Ipsum e copiali negli appunti.',
  component: LoremIpsumTool,
}, {
  id: 'form-filler', name: 'Compila form', icon: FormInput,
  description: 'Seleziona un contenitore e riempi i campi con dati realistici.',
  component: FormFillerTool,
}, {
  id: 'colors', name: 'Colori', icon: Palette,
  description: 'Cattura, crea, converti ed esporta colori e palette.',
  component: ColorsTool,
}, {
  id: 'contrast', name: 'Contrasti', icon: Contrast,
  description: 'Misura il contrasto testo/sfondo e i criteri WCAG 2.1.',
  component: ContrastTool,
}, {
  id: 'inspect-save', name: 'Ispeziona e salva', icon: SquareDashedMousePointer,
  description: 'Ispeziona una sezione, leggine le proprietà e copia o scarica codice e anteprima.',
  component: InspectSaveTool,
}, {
  id: 'emoji', name: 'Emoji', icon: Smile,
  description: 'Cerca emoji in italiano o inglese e copiale negli appunti.',
  component: EmojiTool,
}];
import { Camera, Contrast, FileText, FormInput, Palette, PanelsTopLeft, ScanEye, Smile, SquareDashedMousePointer } from 'lucide-react';
