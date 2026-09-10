import { describe, expect, it } from 'vitest';
import { applySkinTone, filterEmojis, normalizeSearchText, type EmojiRecord } from './data';

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
