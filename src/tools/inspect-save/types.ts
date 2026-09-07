export interface InspectRect {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
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
