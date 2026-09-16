import { startPickerSession, type PickerEndReason, type PickerSessionControl } from './picker-session';
import type { InspectSnapshot, LockedPreview, SnapshotPayload } from './types';

function isPayload(value: unknown): value is SnapshotPayload {
  if (!value || typeof value !== 'object') return false;
  const item = value as SnapshotPayload;
  return typeof item.tag === 'string'
    && typeof item.selector === 'string'
    && typeof item.markup === 'string'
    && !!item.rect
    && Array.isArray(item.sections);
}

export type InspectSessionControl = PickerSessionControl;

export function startInspectSession(
  tabId: number,
  windowId: number,
  signal: AbortSignal,
  onStatus: (status: string) => void,
  onResult: (result: InspectSnapshot) => void,
  onEnd: (reason: PickerEndReason) => void = () => {},
  onLocked: (preview: LockedPreview) => void = () => {},
): Promise<InspectSessionControl> {
  return startPickerSession<SnapshotPayload>({
    tabId,
    windowId,
    signal,
    file: '/inspect-save.js',
    portPrefix: 'swiss-inspect-save',
    toolName: 'Ispeziona e salva',
    screenshot: 'required',
    isPayload,
    onStatus,
    onEnd,
    onLocked,
    onResult: (payload, capture) => onResult({
      ...payload,
      png: capture!.png,
      clipped: payload.clipped || capture!.clipped,
    }),
  });
}
