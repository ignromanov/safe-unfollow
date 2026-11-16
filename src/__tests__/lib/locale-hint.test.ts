import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  dismissLocaleHint,
  isLocaleHintDismissed,
  localeHintHref,
  translationTarget,
} from '@/lib/locale-hint';

/**
 * The locale hint offers a reader whose browser is translating the page into one of our
 * languages the page we already wrote in it. Lumen's ruling (2026-11-16): a hint, never a
 * redirect, and only once the browser is actually translating, which is what makes the
 * target a measurement instead of a guess from `navigator.language`.
 */

function htmlWith(lang: string, className = ''): HTMLElement {
  const el = document.createElement('html');
  el.setAttribute('lang', lang);
  el.className = className;
  return el;
}

describe('translationTarget', () => {
  it('reads the target from a page Chrome is translating', () => {
    expect(translationTarget(htmlWith('pt', 'translated-ltr'), 'en')).toBe('pt');
    expect(translationTarget(htmlWith('ar', 'translated-rtl'), 'en')).toBe('ar');
  });

  it('takes the primary subtag of a regional target', () => {
    expect(translationTarget(htmlWith('pt-BR', 'translated-ltr'), 'en')).toBe('pt');
  });

  // Our own Layout rewrites <html lang> on every locale navigation. Without the class the
  // attribute is ours, so it proves nothing about a translator.
  it('ignores a lang change no translator made', () => {
    expect(translationTarget(htmlWith('pt'), 'en')).toBeNull();
  });

  // velum-cdpo: no locale, no hint, no event — the value sent is only ever one of ours.
  it('says nothing for a language we do not localize', () => {
    expect(translationTarget(htmlWith('it', 'translated-ltr'), 'en')).toBeNull();
    expect(translationTarget(htmlWith('zh-CN', 'translated-ltr'), 'en')).toBeNull();
  });

  it('says nothing when the target is the page’s own language', () => {
    expect(translationTarget(htmlWith('pt', 'translated-ltr'), 'pt')).toBeNull();
  });
});

describe('localeHintHref', () => {
  it('keeps the reader on the same page when that page exists in the target language', () => {
    expect(localeHintHref('/', 'pt')).toBe('/pt');
    expect(localeHintHref('/upload', 'pt')).toBe('/pt/upload');
    expect(localeHintHref('/ru/upload', 'de')).toBe('/de/upload');
    expect(localeHintHref('/ru/upload', 'en')).toBe('/upload');
    expect(localeHintHref('/ru', 'en')).toBe('/');
  });

  // The intent pages are English-only (routes.tsx), so /pt/<slug> would be a 404.
  it('sends an English-only page to the target language’s home', () => {
    expect(localeHintHref('/who-doesnt-follow-me-back', 'id')).toBe('/id');
  });

  it('offers nothing on a page the hint does not belong on', () => {
    for (const path of ['/results', '/pt/results', '/sample', '/privacy', '/docs/faq']) {
      expect(localeHintHref(path, 'pt')).toBeNull();
    }
  });
});

describe('dismissal', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('remembers a dismissal across pages', () => {
    expect(isLocaleHintDismissed()).toBe(false);
    dismissLocaleHint();
    expect(isLocaleHintDismissed()).toBe(true);
  });

  // jsdom's Storage does not dispatch through Storage.prototype, so the object is replaced.
  it('shows the hint, and does not throw, when storage refuses', () => {
    const real = window.localStorage;
    const refuse = (): never => {
      throw new DOMException('denied', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: refuse, setItem: refuse, removeItem: refuse },
    });
    try {
      expect(() => dismissLocaleHint()).not.toThrow();
      expect(isLocaleHintDismissed()).toBe(false);
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real });
    }
  });
});
