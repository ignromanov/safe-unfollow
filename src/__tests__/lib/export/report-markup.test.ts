import { describe, expect, it } from 'vitest';

import {
  ICON_PATHS,
  REPORT_CSP,
  REPORT_CSS,
  REPORT_SITE_URL,
  SECTION_CLOSE,
  escapeHtml,
  profileUrl,
  renderCallout,
  renderFooter,
  renderHead,
  renderIcon,
  renderMore,
  renderRow,
  renderSample,
  renderSectionOpen,
  renderTiles,
  renderTitle,
  type SampleBlock,
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
      ['a', 'b.c', 'x/y', 'UP'].map(row).join('') + renderFooter('Made with <SafeUnfollow>', 'p');
    const hrefs = [...parse(html).querySelectorAll('[href]')].map(a => a.getAttribute('href'));
    expect(hrefs).toHaveLength(3);
    expect(hrefs.every(allowed)).toBe(true);
  });
});

describe('renderFooter', () => {
  it('puts the privacy line before the one site link', () => {
    const footer = parse(renderFooter('<b>hi</b>', 'Stays <here>')).querySelector('footer');
    const a = footer?.querySelector('a');
    expect(footer?.lastElementChild).toBe(a);
    expect(a?.getAttribute('href')).toBe('https://safeunfollow.app/?from=report');
    expect(a?.getAttribute('rel')).toBe('noreferrer');
    expect(a?.textContent).toBe('<b>hi</b>');
    expect(a?.querySelector('b')).toBeNull();
    expect(a?.previousElementSibling?.tagName).toBe('P');
    expect(a?.previousElementSibling?.textContent).toBe('Stays <here>');
    expect(footer?.querySelectorAll('a')).toHaveLength(1);
  });
});

describe('attribute escaping', () => {
  it('keeps isoDay inside its attribute', () => {
    const doc = parse(renderRow({ username: 'u', labels: [], dateText: 'd', isoDay: '2024"x' }));
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

  it('renders labels as pills', () => {
    const doc = parse(renderRow({ ...base, labels: ['A', 'B'] }));
    const pills = doc.querySelectorAll('.labels > span');
    expect([...pills].map(p => p.textContent)).toEqual(['A', 'B']);
    expect(doc.querySelector('.labels')?.textContent).not.toContain(' · ');
  });

  it('isolates a name that gets no link', () => {
    const doc = parse(renderRow({ ...base, username: 'a/../b' }));
    expect(doc.querySelector('a')).toBeNull();
    expect(doc.querySelector('span.u')?.textContent).toBe('@a/../b');
  });
});

describe('sections', () => {
  const open = (o: Partial<Parameters<typeof renderSectionOpen>[0]> = {}): string =>
    renderSectionOpen({
      id: 'notFollowedBack',
      heading: 'Not <following> back',
      count: '1,204',
      explain: 'They <follow> you',
      note: 'n',
      ...o,
    }) + SECTION_CLOSE;

  it('carries the section icon, explainer and optional note', () => {
    const d = parse(open()).querySelector('details');
    expect(d?.hasAttribute('open')).toBe(true);
    expect(d?.id).toBe('notFollowedBack');
    const summary = d?.querySelector('summary');
    expect(summary?.querySelector('.ico')?.innerHTML).toBe(renderIcon('notFollowedBack'));
    expect(summary?.querySelector('h2')?.textContent).toBe('Not <following> back');
    expect(summary?.querySelector('.count')?.textContent).toBe('1,204');
    expect(d?.querySelector('p.x2')?.textContent).toBe('They <follow> you');
    expect(d?.querySelector('p.note')?.textContent).toBe('n');
  });

  it('omits the note when null', () => {
    expect(open({ note: null })).not.toContain('class="note"');
  });
});

describe('icons', () => {
  const shapes = ['path', 'polyline', 'circle', 'rect', 'line'];

  it('ICON_PATHS holds only shape elements', () => {
    for (const [name, inner] of Object.entries(ICON_PATHS)) {
      const svg = parse(`<svg>${inner}</svg>`).querySelector('svg');
      expect(svg?.children.length, name).toBeGreaterThan(0);
      for (const child of svg?.children ?? []) expect(shapes).toContain(child.localName);
      expect(inner).not.toContain('url(');
    }
  });

  it('renderIcon is aria-hidden and decorative', () => {
    expect(renderIcon('lock')).toMatch(/^<svg class="i" viewBox="0 0 24 24" aria-hidden="true">/);
    expect(renderIcon('lock')).toMatch(/<\/svg>$/);
  });
});

describe('renderTitle', () => {
  it('wraps the shield mark and an escaped h1', () => {
    const doc = parse(renderTitle('A <b>'));
    expect(doc.querySelector('.top > .mark > svg.i')).not.toBeNull();
    expect(doc.querySelector('h1')?.textContent).toBe('A <b>');
  });
});

describe('renderTiles', () => {
  it('emits one tile per entry with its section class, and nothing for none', () => {
    const html = renderTiles([
      { section: 'mutuals', count: '1,200', label: '<b>', explain: 'x<y' },
    ]);
    expect(html).toContain('t-mutuals');
    expect(html).toContain('1,200');
    expect(html).toContain('&lt;b&gt;');
    const doc = parse(html);
    expect(doc.querySelectorAll('.tiles > .tile')).toHaveLength(1);
    expect(doc.querySelector('.tile .n')?.textContent).toBe('1,200');
    expect(doc.querySelector('.tile .k')?.textContent).toBe('<b>');
    expect(doc.querySelector('.tile .x')?.textContent).toBe('x<y');
    expect(renderTiles([])).toBe('');
  });
});

describe('renderCallout', () => {
  it('has an alert icon and escaped text', () => {
    const doc = parse(renderCallout('<i>'));
    expect(doc.querySelector('.callout > svg.i')).not.toBeNull();
    expect(doc.querySelector('.callout p')?.textContent).toBe('<i>');
  });
});

describe('renderSample', () => {
  const base: SampleBlock = {
    head: 'Head <1>',
    body: 'Body <2>',
    shown: 10,
    total: 3000,
    barLabel: '10 / 3,000',
    cta: 'Get <all>',
    ctaSub: 'Sub <3>',
  };

  it('links only to REPORT_SITE_URL, noreferrer, from the CTA', () => {
    const doc = parse(renderSample(base));
    const links = doc.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(REPORT_SITE_URL);
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer');
    expect(links[0]?.className).toBe('cta');
    expect(links[0]?.textContent).toBe('Get <all>');
    expect(links[0]?.querySelector('svg.i')).not.toBeNull();
    expect(doc.querySelector('.ctasub')?.textContent).toBe('Sub <3>');
    expect(doc.querySelector('h2')?.textContent).toBe('Head <1>');
    expect(doc.querySelector('.barlabel')?.textContent).toBe('10 / 3,000');
  });

  it('bar is numbers-only and never 0%', () => {
    const style = (o: Partial<SampleBlock>): string | null | undefined =>
      parse(renderSample({ ...base, ...o }))
        .querySelector('.bar span')
        ?.getAttribute('style');
    expect(style({ shown: 10, total: 1_000_000 })).toBe('inline-size:0.50%');
    expect(style({ shown: 10, total: 3000 })).toBe('inline-size:0.50%');
    expect(style({ shown: 10, total: 40 })).toBe('inline-size:25.00%');
    expect(style({ shown: 10, total: 40 })).toMatch(/^inline-size:\d+(\.\d+)?%$/);
  });
});

describe('renderMore', () => {
  it('is a list item with a lock and escaped text', () => {
    const li = parse(`<ul>${renderMore('+5 <more>')}</ul>`).querySelector('li.more');
    expect(li?.querySelector('svg.i')).not.toBeNull();
    expect(li?.textContent).toBe('+5 <more>');
  });
});
