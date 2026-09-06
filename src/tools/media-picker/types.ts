export type MediaKind = 'image' | 'video' | 'audio' | 'subtitle' | 'stream';
export interface MediaCandidate {
  id: string;
  url: string;
  sources: string[];
  width: number | null;
  height: number | null;
  kind?: MediaKind;
  duration?: number | null;
}
export interface MediaSelection {
  images: MediaCandidate[];
  warnings: string[];
  pageUrl: string;
}
export interface MediaDetails {
  filename: string;
  extension: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  verified: boolean;
  objectUrl?: string;
  blob?: Blob;
  error?: string;
  permission?: string;
  kind?: MediaKind;
  duration?: number | null;
  notice?: string;
}
export const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
