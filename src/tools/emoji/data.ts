export type EmojiGroup = 'smileys-emotion' | 'people-body' | 'animals-nature' | 'food-drink' | 'travel-places' | 'activities' | 'objects' | 'symbols' | 'flags';
export type EmojiCategory = EmojiGroup | 'all';

export interface EmojiSkin {
  emoji: string;
  tone: number | number[];
}

export interface EmojiRecord {
  emoji: string;
  hexcode: string;
  group: EmojiGroup;
  name: string;
  italianName: string;
  keywords: string[];
  italianKeywords: string[];
  skins?: Array<string | EmojiSkin>;
}

export interface EmojiFilter {
  query: string;
  group: EmojiCategory;
}

interface EmojiSource {
  emoji: string;
  hexcode: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
  skins?: EmojiSkin[];
}

const groups: Record<number, EmojiGroup | undefined> = {
  0: 'smileys-emotion',
  1: 'people-body',
  // Emojibase group 2 contains standalone skin/hair components, not a category.
  3: 'animals-nature',
  4: 'food-drink',
  5: 'travel-places',
  6: 'activities',
  7: 'objects',
  8: 'symbols',
  9: 'flags',
};

export function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function searchIndex(item: EmojiRecord) {
  return normalizeSearchText([item.name, item.italianName, ...item.keywords, ...item.italianKeywords].join(' '));
}

export function filterEmojis(emojis: EmojiRecord[], filter: EmojiFilter) {
  const terms = normalizeSearchText(filter.query).split(/\s+/).filter(Boolean);
  return emojis.filter(item => (filter.group === 'all' || item.group === filter.group) && terms.every(term => searchIndex(item).includes(term)));
}

export function applySkinTone(item: EmojiRecord, tone: number) {
  if (!tone || !item.skins) return item.emoji;
  const variant = item.skins[tone];
  if (typeof variant === 'string') return variant;
  return variant?.emoji ?? item.emoji;
}

function uniformSkin(skins: EmojiSkin[] | undefined, tone: number) {
  return skins?.find(skin => skin.tone === tone || (Array.isArray(skin.tone) && skin.tone.every(value => value === tone)))?.emoji;
}

export async function loadEmojiData(): Promise<EmojiRecord[]> {
  const [englishModule, italianModule] = await Promise.all([
    import('emojibase-data/en/data.json'),
    import('emojibase-data/it/data.json'),
  ]);
  const english = englishModule.default as unknown as EmojiSource[];
  const italian = new Map((italianModule.default as unknown as EmojiSource[]).map(item => [item.hexcode, item]));

  return english.flatMap(item => {
    const group = item.group == null ? undefined : groups[item.group];
    const localized = italian.get(item.hexcode);
    if (!group || !localized) return [];
    return [{
      emoji: item.emoji,
      hexcode: item.hexcode,
      group,
      name: item.label,
      italianName: localized.label,
      keywords: item.tags ?? [],
      italianKeywords: localized.tags ?? [],
      skins: [item.emoji, ...[1, 2, 3, 4, 5].map(tone => uniformSkin(item.skins, tone) ?? item.emoji)],
    }];
  });
}
