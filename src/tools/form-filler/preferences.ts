import { browser } from 'wxt/browser';
export type FormFillerPreferences = { locale: 'en' | 'it'; password: string; ignored: string; preserveExisting: boolean };
export const FORM_FILLER_PREFERENCES_KEY = 'formFillerPreferences';
export const defaultFormFillerPreferences: FormFillerPreferences = { locale: 'en', password: '', ignored: 'captcha, hipinputtext', preserveExisting: true };
export function normalizeFormFillerPreferences(value: unknown): FormFillerPreferences { const raw = value && typeof value === 'object' ? value as Partial<FormFillerPreferences> : {}; return { locale: raw.locale === 'it' ? 'it' : 'en', password: typeof raw.password === 'string' ? raw.password : '', ignored: typeof raw.ignored === 'string' ? raw.ignored : defaultFormFillerPreferences.ignored, preserveExisting: raw.preserveExisting !== false }; }
export async function loadFormFillerPreferences() { const stored = await browser.storage.local.get(FORM_FILLER_PREFERENCES_KEY); return normalizeFormFillerPreferences(stored[FORM_FILLER_PREFERENCES_KEY]); }
export async function saveFormFillerPreferences(value: FormFillerPreferences) { await browser.storage.local.set({ [FORM_FILLER_PREFERENCES_KEY]: value }); }
