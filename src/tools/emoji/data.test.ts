import { describe, expect, it } from 'vitest';
import { applySkinTone, filterEmojis, loadEmojiData, normalizeSearchText, type EmojiRecord } from './data';

const emojis: EmojiRecord[] = [
  {
    emoji: '🎉',
    hexcode: '1F389',
    group: 'activities',
    name: 'party popper',
    italianName: 'trombetta per feste',
    keywords: ['party', 'celebration'],
    italianKeywords: ['festa', 'celebrazione'],
  },
  {
    emoji: '👋',
    hexcode: '1F44B',
    group: 'people-body',
    name: 'waving hand',
    italianName: 'mano che saluta',
    keywords: ['hello', 'wave'],
    italianKeywords: ['ciao', 'saluto'],
    skins: ['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'],
  },
  {
    emoji: '👩‍🤝‍👩',
    hexcode: '1F469-200D-1F91D-200D-1F469',
    group: 'people-body',
    name: 'women holding hands',
    italianName: 'donne che si tengono per mano',
    keywords: ['women', 'holding hands'],
    italianKeywords: ['donne', 'mano'],
    skins: ['👩‍🤝‍👩', '👩🏻‍🤝‍👩🏻', '👩🏼‍🤝‍👩🏼', '👩🏽‍🤝‍👩🏽', '👩🏾‍🤝‍👩🏾', '👩🏿‍🤝‍👩🏿'],
  },
];

describe('emoji search data', () => {
  it('places real dataset emoji in every expected category', async () => {
    const data = await loadEmojiData();
    const examples = [
      ['1F600', 'smileys-emotion'],
      ['1F44B', 'people-body'],
      ['1F412', 'animals-nature'],
      ['1F337', 'animals-nature'],
      ['1F347', 'food-drink'],
      ['1F30D', 'travel-places'],
      ['1F389', 'activities'],
      ['1F453', 'objects'],
      ['1F3E7', 'symbols'],
      ['1F1EE-1F1F9', 'flags'],
    ] as const;
    for (const [hexcode, group] of examples) {
      expect(data.find(item => item.hexcode === hexcode)?.group, hexcode).toBe(group);
      expect(filterEmojis(data, { query: '', group }).some(item => item.hexcode === hexcode)).toBe(true);
    }
  });

  it('excludes standalone skin and hair components from the catalog', async () => {
    const data = await loadEmojiData();
    for (const hexcode of ['1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF', '1F9B0', '1F9B1', '1F9B2', '1F9B3']) {
      expect(data.some(item => item.hexcode === hexcode), hexcode).toBe(false);
    }
  });

  it('normalizes case and accents', () => {
    expect(normalizeSearchText('  CELEBRAZIÓN ')).toBe('celebrazion');
  });

  it('finds names and keywords in Italian and English', () => {
    expect(filterEmojis(emojis, { query: 'ciao', group: 'all' }).map(item => item.emoji)).toEqual(['👋']);
    expect(filterEmojis(emojis, { query: 'party celebration', group: 'all' }).map(item => item.emoji)).toEqual(['🎉']);
  });

  it('combines every search term with the selected category', () => {
    expect(filterEmojis(emojis, { query: 'mano donne', group: 'people-body' }).map(item => item.emoji)).toEqual(['👩‍🤝‍👩']);
    expect(filterEmojis(emojis, { query: 'mano', group: 'activities' })).toEqual([]);
  });

  it('uses the matching uniform skin variant and leaves unsupported emoji unchanged', () => {
    expect(applySkinTone(emojis[1]!, 3)).toBe('👋🏽');
    expect(applySkinTone(emojis[2]!, 5)).toBe('👩🏿‍🤝‍👩🏿');
    expect(applySkinTone(emojis[0]!, 2)).toBe('🎉');
  });
});
