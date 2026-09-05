import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/languages';
import { INTENT_PATHS } from '@/config/intent-pages';

const LOCALES_DIR = path.resolve(__dirname, '../../locales');

const REQUIRED_NAMESPACES = [
  'common',
  'hero',
  'wizard',
  'upload',
  'results',
  'faq',
  'howto',
  'meta',
] as const;

type Namespace = (typeof REQUIRED_NAMESPACES)[number];

/**
 * Recursively extracts all keys from a nested object
 * Returns keys in dot notation (e.g., "buttons.back", "features.local.title")
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Recursively checks for empty strings in a nested object
 * Returns array of keys with empty values
 */
function findEmptyStrings(obj: Record<string, unknown>, prefix = ''): string[] {
  const emptyKeys: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      emptyKeys.push(...findEmptyStrings(value as Record<string, unknown>, fullKey));
    } else if (typeof value === 'string' && value.trim() === '') {
      emptyKeys.push(fullKey);
    }
  }

  return emptyKeys;
}

/**
 * Loads and parses a JSON file
 */
function loadJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

describe('i18n Localization System', () => {
  describe('namespace file existence', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      describe(`${lang} language`, () => {
        for (const namespace of REQUIRED_NAMESPACES) {
          it(`should have ${namespace}.json file`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const exists = fs.existsSync(filePath);

            expect(exists).toBe(true);
          });
        }
      });
    }
  });

  describe('valid JSON structure', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      describe(`${lang} language`, () => {
        for (const namespace of REQUIRED_NAMESPACES) {
          it(`should have valid JSON in ${namespace}.json`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const content = fs.readFileSync(filePath, 'utf-8');

            expect(() => JSON.parse(content)).not.toThrow();

            const parsed = JSON.parse(content);
            expect(typeof parsed).toBe('object');
            expect(parsed).not.toBeNull();
          });
        }
      });
    }
  });

  describe('key consistency across languages', () => {
    // Use English as the reference language
    const referenceLanguage: SupportedLanguage = 'en';

    for (const namespace of REQUIRED_NAMESPACES) {
      describe(`${namespace} namespace`, () => {
        const referenceFilePath = path.join(LOCALES_DIR, referenceLanguage, `${namespace}.json`);
        const referenceData = loadJsonFile(referenceFilePath);

        if (!referenceData) {
          it.skip('reference file not found', () => {});
          return;
        }

        // The three intent-page route entries under `meta.routes` are English-only by design
        // (src/config/intent-pages.ts) — the pages they describe are registered on the root
        // route object alone and never render in any other locale. Derived from INTENT_PATHS
        // rather than named here by hand, so a fourth intent page does not reopen this hole.
        const referenceKeys = extractKeys(referenceData)
          .filter(
            key => namespace !== 'meta' || !INTENT_PATHS.some(p => key.startsWith(`routes.${p}.`))
          )
          .sort();

        for (const lang of SUPPORTED_LANGUAGES) {
          if (lang === referenceLanguage) continue;

          it(`should have all keys from English in ${lang}`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const data = loadJsonFile(filePath);

            expect(data).not.toBeNull();

            const langKeys = extractKeys(data!).sort();
            const missingKeys = referenceKeys.filter(key => !langKeys.includes(key));

            if (missingKeys.length > 0) {
              throw new Error(
                `Missing keys in ${lang}/${namespace}.json:\n  - ${missingKeys.join('\n  - ')}`
              );
            }

            expect(missingKeys).toEqual([]);
          });

          it(`should not have extra keys in ${lang} that are not in English`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const data = loadJsonFile(filePath);

            expect(data).not.toBeNull();

            const langKeys = extractKeys(data!).sort();
            const extraKeys = langKeys.filter(key => !referenceKeys.includes(key));

            if (extraKeys.length > 0) {
              throw new Error(
                `Extra keys in ${lang}/${namespace}.json (not in English):\n  - ${extraKeys.join('\n  - ')}`
              );
            }

            expect(extraKeys).toEqual([]);
          });
        }
      });
    }
  });

  describe('no empty strings', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      describe(`${lang} language`, () => {
        for (const namespace of REQUIRED_NAMESPACES) {
          it(`should not have empty strings in ${namespace}.json`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const data = loadJsonFile(filePath);

            expect(data).not.toBeNull();

            const emptyKeys = findEmptyStrings(data!);

            if (emptyKeys.length > 0) {
              throw new Error(
                `Empty strings found in ${lang}/${namespace}.json:\n  - ${emptyKeys.join('\n  - ')}`
              );
            }

            expect(emptyKeys).toEqual([]);
          });
        }
      });
    }
  });

  describe('translation completeness summary', () => {
    it('should report translation coverage for all languages', () => {
      const referenceLanguage: SupportedLanguage = 'en';
      const coverage: Record<string, { total: number; translated: number }> = {};

      for (const lang of SUPPORTED_LANGUAGES) {
        if (lang === referenceLanguage) continue;

        let totalKeys = 0;
        let translatedKeys = 0;

        for (const namespace of REQUIRED_NAMESPACES) {
          const refPath = path.join(LOCALES_DIR, referenceLanguage, `${namespace}.json`);
          const langPath = path.join(LOCALES_DIR, lang, `${namespace}.json`);

          const refData = loadJsonFile(refPath);
          const langData = loadJsonFile(langPath);

          if (refData && langData) {
            const refKeys = extractKeys(refData);
            const langKeys = extractKeys(langData);

            totalKeys += refKeys.length;
            translatedKeys += refKeys.filter(key => langKeys.includes(key)).length;
          }
        }

        coverage[lang] = { total: totalKeys, translated: translatedKeys };
      }

      // Coverage summary (informational only)
      // eslint-disable-next-line no-console
      console.log('\nTranslation Coverage Summary:');
      // eslint-disable-next-line no-console
      console.log('─'.repeat(40));

      for (const [lang, stats] of Object.entries(coverage)) {
        const percentage =
          stats.total > 0 ? ((stats.translated / stats.total) * 100).toFixed(1) : '0.0';
        // eslint-disable-next-line no-console
        console.log(`  ${lang}: ${stats.translated}/${stats.total} keys (${percentage}%)`);
      }

      // eslint-disable-next-line no-console
      console.log('─'.repeat(40));

      // This test always passes - it's for informational purposes
      expect(true).toBe(true);
    });
  });

  describe('value type consistency', () => {
    const referenceLanguage: SupportedLanguage = 'en';

    for (const namespace of REQUIRED_NAMESPACES) {
      describe(`${namespace} namespace`, () => {
        const referenceFilePath = path.join(LOCALES_DIR, referenceLanguage, `${namespace}.json`);
        const referenceData = loadJsonFile(referenceFilePath);

        if (!referenceData) {
          it.skip('reference file not found', () => {});
          return;
        }

        for (const lang of SUPPORTED_LANGUAGES) {
          if (lang === referenceLanguage) continue;

          it(`should have same value types as English in ${lang}`, () => {
            const filePath = path.join(LOCALES_DIR, lang, `${namespace}.json`);
            const data = loadJsonFile(filePath);

            expect(data).not.toBeNull();

            const referenceKeys = extractKeys(referenceData);
            const typeMismatches: string[] = [];

            for (const key of referenceKeys) {
              const refValue = getNestedValue(referenceData, key);
              const langValue = getNestedValue(data!, key);

              if (langValue !== undefined) {
                const refType = typeof refValue;
                const langType = typeof langValue;

                if (refType !== langType) {
                  typeMismatches.push(`${key}: expected ${refType}, got ${langType}`);
                }
              }
            }

            if (typeMismatches.length > 0) {
              throw new Error(
                `Type mismatches in ${lang}/${namespace}.json:\n  - ${typeMismatches.join('\n  - ')}`
              );
            }

            expect(typeMismatches).toEqual([]);
          });
        }
      });
    }
  });
});

/**
 * Gets a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
