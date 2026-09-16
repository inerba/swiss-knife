import { startPickerSession, type PickerEndReason, type PickerSessionControl } from '../inspect-save/picker-session';
import type { LockedPreview } from '../inspect-save/types';
import type { ContextPayload, ContextResult } from './types';

export function isContextPayload(value: unknown): value is ContextPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as ContextPayload;
  return typeof item.element === 'string'
    && typeof item.path === 'string'
    && typeof item.url === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && !!item.box
    && !!item.viewport
    && !!item.css
    && Array.isArray(item.css.matched)
    && Array.isArray(item.unreadableSheets)
    && Array.isArray(item.selectors);
}

export interface BrowserContextHandlers {
  onStatus(status: string): void;
  onResult(result: ContextResult, captureError?: string): void;
  onEnd(reason: PickerEndReason): void;
  onLocked(preview: LockedPreview): void;
}

export function startBrowserContextSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  handlers: BrowserContextHandlers,
): Promise<PickerSessionControl> {
  return startPickerSession<ContextPayload>({
    tabId,
    windowId,
    signal,
    file: '/browser-context.js',
    portPrefix: 'swiss-browser-context',
    toolName: 'Browser context',
    screenshot: 'optional',
    isPayload: isContextPayload,
    onStatus: status => handlers.onStatus(status),
    onEnd: reason => handlers.onEnd(reason),
    onLocked: preview => handlers.onLocked(preview),
    onResult: (payload, capture, captureError) => handlers.onResult({ ...payload, png: capture?.png }, captureError),
  });
}
