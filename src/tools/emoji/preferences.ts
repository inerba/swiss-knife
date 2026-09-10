import { browser } from 'wxt/browser';

export const emojiPreviewSizes = [22, 32, 42, 52, 60] as const;
export type EmojiPreviewSize = typeof emojiPreviewSizes[number];
export type EmojiPreferences = { previewSize: EmojiPreviewSize };

export const EMOJI_PREFERENCES_KEY = 'emojiPreferences';
export const defaultEmojiPreferences: EmojiPreferences = { previewSize: 22 };

export function normalizeEmojiPreferences(value: unknown): EmojiPreferences {
  const previewSize = value && typeof value === 'object' ? (value as Partial<EmojiPreferences>).previewSize : undefined;
  return emojiPreviewSizes.includes(previewSize as EmojiPreviewSize) ? { previewSize: previewSize as EmojiPreviewSize } : defaultEmojiPreferences;
}

export async function loadEmojiPreferences() {
  const stored = await browser.storage.local.get(EMOJI_PREFERENCES_KEY);
  return normalizeEmojiPreferences(stored[EMOJI_PREFERENCES_KEY]);
}

export async function saveEmojiPreferences(value: EmojiPreferences) {
  await browser.storage.local.set({ [EMOJI_PREFERENCES_KEY]: value });
}
