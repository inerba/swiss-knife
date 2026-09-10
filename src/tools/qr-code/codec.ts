import QRCodeStyling from 'qr-code-styling';
import jsQR from 'jsqr';
import { toLibraryOptions, type QrStyle } from './style';

export type { ErrorCorrection } from './style';

export function decodeQrImageData(data: Uint8ClampedArray, width: number, height: number) {
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (!result) throw new Error('Nessun QR code leggibile nell’immagine.');
  return result.data;
}

function imageFromDataUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Impossibile caricare l’immagine.'));
    image.src = url;
  });
}

function readBlob(data: Blob | ArrayBufferView | ArrayBuffer, as: 'text' | 'data-url') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Impossibile esportare il QR code.'));
    if (as === 'text') reader.readAsText(blob);
    else reader.readAsDataURL(blob);
  });
}

export async function renderQr(value: string, style: QrStyle, logo?: string) {
  const options = toLibraryOptions(value, style, logo);
  const svgQr = new QRCodeStyling({ ...options, type: 'svg' });
  const pngQr = new QRCodeStyling({ ...options, type: 'canvas' });
  const [svgData, pngData] = await Promise.all([svgQr.getRawData('svg'), pngQr.getRawData('png')]);
  if (!svgData || !pngData) throw new Error('Impossibile generare il QR code.');
  return { png: await readBlob(pngData, 'data-url'), svg: await readBlob(svgData, 'text') };
}

export async function decodeQrDataUrl(url: string) {
  const image = await imageFromDataUrl(url);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas non disponibile.');
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  return decodeQrImageData(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}
