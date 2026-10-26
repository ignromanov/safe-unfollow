import { describe, expect, it } from 'vitest';

import {
  REPORT_CSP,
  REPORT_CSS,
  REPORT_SITE_URL,
  SECTION_CLOSE,
  escapeHtml,
  profileUrl,
  renderFooter,
  renderHead,
  renderRow,
  renderSectionOpen,
} from '@/lib/export/report-markup';

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html');

const head = (o: Partial<Parameters<typeof renderHead>[0]> = {}): Document =>
  parse(
    renderHead({ lang: 'en', dir: 'ltr', title: 'Report', ...o }) + '</head><body></body></html>'
  );

describe('escapeHtml', () => {
  it('escapes the five markup characters', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('renderHead', () => {
  it('puts the CSP meta first, before charset', () => {
    const first = head().head.firstElementChild;
    expect(first?.tagName).toBe('META');
    expect(first?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(first?.getAttribute('content')).toBe(REPORT_CSP);
  });

  it('sets a no-referrer policy', () => {
    expect(head().querySelector('meta[name=referrer][content=no-referrer]')).not.toBeNull();
  });

  it('escapes the title', () => {
    const html = renderHead({ lang: 'en', dir: 'ltr', title: '<b>' });
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
  });

  it('round-trips lang and dir', () => {
    const doc = head({ lang: 'ar', dir: 'rtl' });
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('has exactly the expected head children and nothing external', () => {
    const doc = head();
    expect([...doc.head.children].map(e => e.tagName)).toEqual([
      'META',
      'META',
      'META',
      'META',
      'TITLE',
      'STYLE',
    ]);
    expect(doc.querySelector('base,iframe,object,embed,link,script,img')).toBeNull();
  });

  it('escapes quotes in lang without breaking the attribute', () => {
    const doc = head({ lang: 'en"><script>' });
    expect(doc.documentElement.getAttribute('lang')).toBe('en"><script>');
    expect(doc.querySelector('script')).toBeNull();
  });
});

describe('REPORT_CSS', () => {
  it('has no url() or @import and has a print block', () => {
    expect(REPORT_CSS).not.toContain('url(');
    expect(REPORT_CSS).not.toContain('@import');
    expect(REPORT_CSS).toContain('@media print');
  });
});

describe('constants', () => {
  it('pins the site url', () => {
    expect(REPORT_SITE_URL).toBe('https://safeunfollow.app/?from=report');
    expect(profileUrl('a.b')).toBe('https://instagram.com/a.b');
    expect(profileUrl('a/b')).toBeNull();
  });
});

describe('links', () => {
  const allowed = (href: string | null): boolean =>
    href === REPORT_SITE_URL || /^https:\/\/instagram\.com\/[a-z0-9._]{1,30}$/.test(href ?? '');
  const row = (username: string): string =>
    renderRow({ username, labels: [], dateText: null, isoDay: null });

  it.each(['a/b', 'x?y', '"><script>', 'UPPER', 'a'.repeat(31), '', 'a#b', '..%2f'])(
    'renders %j as text with no anchor',
    u => {
      const doc = parse(row(u));
      expect(doc.querySelector('a')).toBeNull();
      expect(doc.querySelector('script')).toBeNull();
      expect(doc.body.textContent).toBe(`@${u}`);
    }
  );

  it.each(['_.', 'user.name_1', '123'])('links valid username %j exactly once', u => {
    expect(parse(row(u)).querySelectorAll('a')).toHaveLength(1);
  });

  it('every emitted href is one of the two allowed forms', () => {
    const html =
      ['a', 'b.c', 'x/y', 'UP'].map(row).join('') + renderFooter('Made with <SafeUnfollow>');
    const hrefs = [...parse(html).querySelectorAll('[href]')].map(a => a.getAttribute('href'));
    expect(hrefs).toHaveLength(3);
    expect(hrefs.every(allowed)).toBe(true);
  });
});

describe('renderFooter', () => {
  it('renders the site link with rel and escaped text', () => {
    const a = parse(renderFooter('<b>hi</b>')).querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://safeunfollow.app/?from=report');
    expect(a?.getAttribute('rel')).toBe('noreferrer');
    expect(a?.textContent).toBe('<b>hi</b>');
    expect(a?.querySelector('b')).toBeNull();
  });
});

describe('attribute escaping', () => {
  it('keeps id and isoDay inside their attributes', () => {
    const doc = parse(
      renderSectionOpen({ id: 'a"b', heading: 'h', count: '1', note: null }) +
        renderRow({ username: 'u', labels: [], dateText: 'd', isoDay: '2024"x' }) +
        SECTION_CLOSE
    );
    expect(doc.querySelector('details')?.getAttribute('id')).toBe('a"b');
    expect(doc.querySelector('time')?.getAttribute('datetime')).toBe('2024"x');
  });
});

describe('renderRow', () => {
  const base = { username: '_.', labels: [], dateText: null, isoDay: null };

  it('builds one noreferrer profile link from the username', () => {
    const doc = parse(renderRow(base));
    const links = doc.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://instagram.com/_.');
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer');
    expect(links[0]?.getAttribute('href')).toMatch(/^https:\/\/instagram\.com\/[a-z0-9._]{1,30}$/);
    expect(links[0]?.textContent).toBe('@_.');
  });

  it('emits <time> only when a date is present', () => {
    const withDate = renderRow({
      ...base,
      dateText: 'Following since 1 Mar 2024',
      isoDay: '2024-03-01',
    });
    expect(withDate).toContain('<time datetime="2024-03-01">');
    expect(withDate).toContain('Following since 1 Mar 2024');
    expect(renderRow(base)).not.toContain('<time');
  });

  it('escapes labels, date text and hostile usernames', () => {
    const html = renderRow({
      username: '"><script>',
      labels: ['<x>'],
      dateText: '<d>',
      isoDay: '2024-03-01',
    });
    expect(html).toContain('&lt;x&gt;');
    expect(html).toContain('&lt;d&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<x>');
  });
});

describe('sections', () => {
  it('opens a details element with summary, count and optional note', () => {
    const doc = parse(
      renderSectionOpen({ id: 'nfb', heading: 'Not <following> back', count: '1,204', note: 'n' }) +
        SECTION_CLOSE
    );
    const d = doc.querySelector('details');
    expect(d?.hasAttribute('open')).toBe(true);
    expect(d?.id).toBe('nfb');
    expect(d?.querySelector('summary')?.textContent).toContain('Not <following> back');
    expect(d?.querySelector('summary')?.textContent).toContain('1,204');
    expect(d?.querySelector('summary > h2')?.textContent).toBe('Not <following> back');
    expect(d?.textContent).toContain('n');
  });

  it('omits the note when null', () => {
    expect(renderSectionOpen({ id: 'a', heading: 'h', count: '1', note: null })).not.toContain(
      'class="note"'
    );
  });
});
