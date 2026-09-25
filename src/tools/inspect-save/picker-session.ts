import { browser, type Browser } from 'wxt/browser';
import { captureElementPng } from './capture';
import { concealFloatingWindow } from '../../lib/floating-window';
import type { ElementCaptureResult } from './element-capture';
import type { InspectRect, LockedPreview, PickerCommand } from './types';

export type PickerEndReason = 'cancelled' | 'error' | 'disconnected';

export interface PickerSessionControl {
  close(): void;
  sendCommand(command: PickerCommand): void;
}

export interface PickerSessionOptions<T extends { rect: InspectRect }> {
  tabId: number;
  windowId: number;
  file: string;
  portPrefix: string;
  toolName: string;
  screenshot: 'required' | 'optional';
  isPayload: (value: unknown) => value is T;
  signal: AbortSignal;
  onStatus: (status: string) => void;
  onResult: (payload: T, capture: ElementCaptureResult | null, captureError?: string) => void;
  onEnd?: (reason: PickerEndReason) => void;
  onLocked?: (preview: LockedPreview) => void;
}

export async function startPickerSession<T extends { rect: InspectRect }>(
  options: PickerSessionOptions<T>,
): Promise<PickerSessionControl> {
  const { tabId, windowId, file, portPrefix, toolName, screenshot, isPayload, signal, onStatus, onResult } = options;
  const onEnd = options.onEnd ?? (() => {});
  const onLocked = options.onLocked ?? (() => {});
  const [injection] = await browser.scripting.executeScript({ target: { tabId }, files: [file as never] });
  signal.throwIfAborted();
  if (!injection?.documentId) throw new Error('Il documento non è più disponibile. Riprova.');
  const session = crypto.randomUUID();
  const port: Browser.runtime.Port = browser.tabs.connect(tabId, {
    documentId: injection.documentId,
    name: `${portPrefix}:${session}`,
  });
  let closed = false;
  const reveal = concealFloatingWindow();
  const timeout = setTimeout(() => {
    if (closed) return;
    close();
    onStatus(`Il selettore non risponde. Attiva di nuovo ${toolName}.`);
    onEnd('error');
  }, 10000);
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    signal.removeEventListener('abort', close);
    port.disconnect();
    reveal();
  };
  signal.addEventListener('abort', close, { once: true });
  let isolateWait: { resolve(): void } | undefined;
  function requestIsolation() {
    return new Promise<void>((resolve, reject) => {
      if (closed || signal.aborted) {
        reject(new Error('Connessione alla pagina terminata. Riprova.'));
        return;
      }
      const timer = setTimeout(() => {
        isolateWait = undefined;
        reject(new Error('Impossibile isolare l\'elemento per la cattura. Riprova.'));
      }, 4000);
      isolateWait = {
        resolve() {
          clearTimeout(timer);
          isolateWait = undefined;
          resolve();
        },
      };
      port.postMessage({ type: 'isolate-capture', session });
    });
  }
  function restoreCapture() {
    try {
      port.postMessage({ type: 'restore-capture', session });
    } catch { /* The port is already closed. */ }
  }
  port.onDisconnect.addListener(() => {
    if (!closed) {
      close();
      onStatus(`Connessione alla pagina terminata. Attiva di nuovo ${toolName}.`);
      onEnd('disconnected');
    }
  });
  port.onMessage.addListener(message => {
    if (closed || signal.aborted || message?.session !== session) return;
    if (message.type === 'ready') {
      clearTimeout(timeout);
      onStatus('Passa col mouse sulle sezioni, clicca per fissare, poi Conferma. ↑ amplia, ↓ restringe, Esc annulla.');
    } else if (message.type === 'locked') {
      const preview = message.preview as LockedPreview;
      if (!preview?.selector) return;
      onLocked(preview);
      onStatus('Sezione fissata. Regola con ↑ ↓ e premi Conferma.');
    } else if (message.type === 'cancelled') {
      close();
      onStatus('Selezione annullata.');
      onEnd('cancelled');
    } else if (message.type === 'isolated') {
      isolateWait?.resolve();
    } else if (message.type === 'snapshot' && isPayload(message.payload)) {
      clearTimeout(timeout);
      const payload = message.payload as T;
      void (async () => {
        let capture: ElementCaptureResult | null = null;
        let captureError: string | undefined;
        try {
          onStatus('Cattura dell\'anteprima…');
          await requestIsolation();
          capture = await captureElementPng(tabId, windowId, payload.rect);
        } catch (error) {
          captureError = error instanceof Error ? error.message : String(error);
        }
        restoreCapture();
        close();
        if (capture || screenshot === 'optional') {
          onResult(payload, capture, captureError);
        } else {
          onStatus(captureError ?? 'Cattura non riuscita. Riprova.');
          onEnd('error');
        }
      })();
    } else if (message.type === 'error') {
      close();
      onStatus(String(message.error));
      onEnd('error');
    }
  });
  return {
    close,
    sendCommand(command: PickerCommand) {
      if (!closed && !signal.aborted) port.postMessage({ type: 'command', session, command });
    },
  };
}
