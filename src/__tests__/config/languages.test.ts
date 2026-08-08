/**
 * Tests for language configuration module
 *
 * Validates the single source of truth for supported languages.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  LANGUAGE_NAMES,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/config/languages';

describe('languages configuration', () => {
  describe('SUPPORTED_LANGUAGES', () => {
    it('should export array of language codes', () => {
      expect(SUPPORTED_LANGUAGES).toBeDefined();
      expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    });

    it('should contain expected languages', () => {
      // Languages sorted alphabetically after 'en' (default)
      const expectedLanguages = ['en', 'ar', 'de', 'es', 'fr', 'id', 'ja', 'pt', 'ru', 'tr'];
      expect(SUPPORTED_LANGUAGES).toEqual(expectedLanguages);
    });

    it('should have unique language codes', () => {
      const uniqueSet = new Set(SUPPORTED_LANGUAGES);
      expect(uniqueSet.size).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('should contain only lowercase two-letter codes', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(lang).toMatch(/^[a-z]{2}$/);
      });
    });

    it('should be readonly (type check)', () => {
      // Type assertion to verify readonly constraint at compile time
      const lang: SupportedLanguage = SUPPORTED_LANGUAGES[0];
      expect(lang).toBeDefined();
    });
  });

  describe('LANGUAGE_NAMES', () => {
    it('should export record of language names', () => {
      expect(LANGUAGE_NAMES).toBeDefined();
      expect(typeof LANGUAGE_NAMES).toBe('object');
    });

    it('should have entry for every supported language', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(LANGUAGE_NAMES[lang]).toBeDefined();
        expect(typeof LANGUAGE_NAMES[lang]).toBe('string');
      });
    });

    it('should have correct language names', () => {
      expect(LANGUAGE_NAMES.en).toBe('English');
      expect(LANGUAGE_NAMES.es).toBe('Español');
      expect(LANGUAGE_NAMES.pt).toBe('Português');
      expect(LANGUAGE_NAMES.id).toBe('Indonesia');
      expect(LANGUAGE_NAMES.tr).toBe('Türkçe');
      expect(LANGUAGE_NAMES.ja).toBe('日本語');
      expect(LANGUAGE_NAMES.ru).toBe('Русский');
      expect(LANGUAGE_NAMES.de).toBe('Deutsch');
      expect(LANGUAGE_NAMES.ar).toBe('العربية');
      expect(LANGUAGE_NAMES.fr).toBe('Français');
    });

    it('should have non-empty names', () => {
      Object.values(LANGUAGE_NAMES).forEach(name => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('should have same number of entries as supported languages', () => {
      expect(Object.keys(LANGUAGE_NAMES).length).toBe(SUPPORTED_LANGUAGES.length);
    });
  });

  describe('RTL_LANGUAGES', () => {
    it('should export array of RTL languages', () => {
      expect(RTL_LANGUAGES).toBeDefined();
      expect(Array.isArray(RTL_LANGUAGES)).toBe(true);
    });

    it('should contain Arabic', () => {
      expect(RTL_LANGUAGES).toContain('ar');
    });

    it('should only contain supported languages', () => {
      RTL_LANGUAGES.forEach(lang => {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      });
    });

    it('should have correct RTL language list', () => {
      expect(RTL_LANGUAGES).toEqual(['ar']);
    });

    it('should be subset of supported languages', () => {
      expect(RTL_LANGUAGES.length).toBeLessThanOrEqual(SUPPORTED_LANGUAGES.length);
    });
  });

  describe('DEFAULT_LANGUAGE', () => {
    it('should export default language', () => {
      expect(DEFAULT_LANGUAGE).toBeDefined();
      expect(typeof DEFAULT_LANGUAGE).toBe('string');
    });

    it('should be English', () => {
      expect(DEFAULT_LANGUAGE).toBe('en');
    });

    it('should be in supported languages', () => {
      expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE);
    });

    it('should have entry in language names', () => {
      expect(LANGUAGE_NAMES[DEFAULT_LANGUAGE]).toBeDefined();
    });

    it('should not be RTL', () => {
      expect(RTL_LANGUAGES).not.toContain(DEFAULT_LANGUAGE);
    });
  });

  describe('SupportedLanguage type', () => {
    it('should accept valid language codes', () => {
      const validLang: SupportedLanguage = 'en';
      expect(SUPPORTED_LANGUAGES).toContain(validLang);
    });

    it('should work with all supported languages', () => {
      SUPPORTED_LANGUAGES.forEach(lang => {
        const typedLang: SupportedLanguage = lang;
        expect(LANGUAGE_NAMES[typedLang]).toBeDefined();
      });
    });
  });

  describe('configuration consistency', () => {
    it('should have complete mapping between arrays and records', () => {
      // Every language in SUPPORTED_LANGUAGES should have a name
      SUPPORTED_LANGUAGES.forEach(lang => {
        expect(LANGUAGE_NAMES[lang]).toBeDefined();
      });

      // Every language in LANGUAGE_NAMES should be supported
      Object.keys(LANGUAGE_NAMES).forEach(lang => {
        expect(SUPPORTED_LANGUAGES).toContain(lang as SupportedLanguage);
      });
    });

    it('should not have extra entries in LANGUAGE_NAMES', () => {
      const languageNameKeys = Object.keys(LANGUAGE_NAMES);
      expect(languageNameKeys.length).toBe(SUPPORTED_LANGUAGES.length);
    });

    it('should have RTL languages that are supported', () => {
      RTL_LANGUAGES.forEach(rtlLang => {
        expect(SUPPORTED_LANGUAGES).toContain(rtlLang);
        expect(LANGUAGE_NAMES[rtlLang]).toBeDefined();
      });
    });
  });

  describe('no external dependencies', () => {
    it('should export only primitive values and types', () => {
      // This test validates the IMPORTANT comment in the source:
      // "This file must have NO external dependencies"
      expect(typeof SUPPORTED_LANGUAGES).toBe('object'); // array
      expect(typeof LANGUAGE_NAMES).toBe('object');
      expect(typeof RTL_LANGUAGES).toBe('object'); // array
      expect(typeof DEFAULT_LANGUAGE).toBe('string');
    });
  });

  describe('detectBrowserLanguage', () => {
    const originalNavigator = global.navigator;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      // Restore original navigator
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    });

    it('should detect language from navigator.languages array', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['ru-RU', 'en-US'], language: 'ru-RU' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('ru');
    });

    it('should return first supported language from navigator.languages', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['zh-CN', 'es-MX', 'en-US'], language: 'zh-CN' },
        writable: true,
        configurable: true,
      });

      // zh-CN is not supported, es-MX is, so should return 'es'
      expect(detectBrowserLanguage()).toBe('es');
    });

    it('should fall back to navigator.language when languages array is empty', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: [], language: 'de-DE' },
        writable: true,
        configurable: true,
      });

      // Empty array falls back to [navigator.language] via nullish coalescing
      expect(detectBrowserLanguage()).toBe('de');
    });

    it('should fall back to navigator.language when languages is undefined', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: undefined, language: 'pt-BR' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('pt');
    });

    it('should return default language for unsupported browser language', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['zh-CN', 'ko-KR'], language: 'zh-CN' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('en');
    });

    it('should return default language when navigator is undefined (server-side)', () => {
      // Temporarily remove navigator to simulate server environment
      const navDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');
      // @ts-expect-error - intentionally deleting for test
      delete global.navigator;

      expect(detectBrowserLanguage()).toBe('en');

      // Restore navigator
      if (navDescriptor) {
        Object.defineProperty(global, 'navigator', navDescriptor);
      }
    });

    it('should handle language codes with region correctly', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['ja-JP'], language: 'ja-JP' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('ja');
    });

    it('should handle lowercase language codes', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['TR'], language: 'TR' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('tr');
    });

    it('should handle Arabic language for RTL support', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['ar-SA'], language: 'ar-SA' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('ar');
    });

    it('should skip null/undefined entries in languages array', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: [null, undefined, 'es-ES'], language: 'es-ES' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('es');
    });

    it('should fall back to English for a locale the app no longer ships', () => {
      // Hindi was removed after measuring zero demand: no /hi page cleared Search
      // Console's reporting threshold in 91 days, and Umami saw four sessions in
      // fifteen. India's traffic is real and large — it is served in English.
      // A browser reporting hi-IN must land on English, not on a dead prefix.
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['hi-IN'], language: 'hi-IN' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('en');
    });

    it('should detect Indonesian language', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['id-ID'], language: 'id-ID' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('id');
    });

    it('should detect French language', () => {
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['fr-FR'], language: 'fr-FR' },
        writable: true,
        configurable: true,
      });

      expect(detectBrowserLanguage()).toBe('fr');
    });
  });
});
