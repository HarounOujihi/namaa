import { describe, expect, it } from 'vitest';
import {
  arabicEquals,
  dotCount,
  isArabicLetter,
  isDiacritic,
  lettersOf,
  normalizeArabic,
  tokenizeWords,
} from './arabic.js';

describe('normalizeArabic', () => {
  it('strips harakat and tanwin', () => {
    expect(normalizeArabic('مُدَرْسَةً')).toBe('مدرسة');
  });
  it('strips tatweel', () => {
    expect(normalizeArabic('مـــــدرسة')).toBe('مدرسة');
  });
  it('unifies alef variants', () => {
    expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('إبراهيم')).toBe(normalizeArabic('ابراهيم'));
    expect(normalizeArabic('آمنة')).toBe(normalizeArabic('امنة'));
  });
  it('maps dotless ya to ya', () => {
    expect(normalizeArabic('على')).toBe(normalizeArabic('علي'));
  });
  it('leaves plain text untouched', () => {
    expect(normalizeArabic('كتاب')).toBe('كتاب');
  });
});

describe('arabicEquals', () => {
  it('equates diacritized and bare forms', () => {
    expect(arabicEquals('قِطْعة', 'قطعة')).toBe(true);
  });
  it('distinguishes genuinely different words', () => {
    expect(arabicEquals('موز', 'كرسي')).toBe(false);
  });
});

describe('classification', () => {
  it('identifies diacritics', () => {
    expect(isDiacritic('\u064B')).toBe(true);
    expect(isDiacritic('\u0651')).toBe(true);
    expect(isDiacritic('ب')).toBe(false);
  });
  it('identifies Arabic letters', () => {
    expect(isArabicLetter('ب')).toBe(true);
    expect(isArabicLetter('a')).toBe(false);
    expect(isArabicLetter('1')).toBe(false);
  });
  it('lettersOf drops diacritics and keeps letters in order', () => {
    expect(lettersOf('مُدَرْسَة')).toEqual(['م', 'د', 'ر', 'س', 'ة']);
  });
});

describe('tokenizeWords', () => {
  it('splits on spaces and Arabic punctuation', () => {
    expect(tokenizeWords('شمس بيت، قلم!')).toEqual(['شمس', 'بيت', 'قلم']);
  });
  it('drops empty tokens', () => {
    expect(tokenizeWords('  مرحبا   ')).toEqual(['مرحبا']);
  });
});

describe('dotCount (Level-3 dot cues)', () => {
  it('counts dots for the similar-letter trio', () => {
    expect(dotCount('ب')).toBe(1);
    expect(dotCount('ت')).toBe(2);
    expect(dotCount('ث')).toBe(3);
  });
  it('returns 0 for dotless letters', () => {
    expect(dotCount('س')).toBe(0);
    expect(dotCount('ح')).toBe(0);
  });
  it('handles ta marbuta as dotless', () => {
    expect(dotCount('ة')).toBe(0);
  });
});
