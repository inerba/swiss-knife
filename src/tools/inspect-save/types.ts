export interface InspectRect {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
}

export type PickerCommand = 'navigate-up' | 'navigate-down' | 'confirm' | 'cancel';

export interface LockedPreview {
  tag: string;
  tagLabel: string;
  selector: string;
  dimensions: string;
}

export interface InfoRow {
  label: string;
  value: string;
  swatch?: string;
}

export interface InfoSection {
  id: string;
  title: string;
  empty?: boolean;
  rows: InfoRow[];
}

export interface InspectSnapshot {
  tag: string;
  tagLabel: string;
  selector: string;
  classes: string;
  dimensions: string;
  rect: InspectRect;
  clipped: boolean;
  sections: InfoSection[];
  markup: string;
  png?: string;
}

export interface SnapshotPayload {
  tag: string;
  tagLabel: string;
  selector: string;
  classes: string;
  dimensions: string;
  rect: InspectRect;
  clipped: boolean;
  sections: InfoSection[];
  markup: string;
}
