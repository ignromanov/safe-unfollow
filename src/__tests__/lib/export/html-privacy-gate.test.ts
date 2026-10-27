/**
 * The report is a file the reader opens on their own device, and its privacy
 * promise is that opening it can make no request. This parses the whole file
 * rather than trusting the parts: `findNetworkHazards` is the gate, and the
 * "red-proof" block shows it going red for every construct it forbids.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountBadges } from '@/core/types';
import { SLOT } from '@/lib/export/report-context';
import { REPORT_CSP, REPORT_SITE_URL } from '@/lib/export/report-markup';
import { makeReport, readBlobText } from '../../utils/report-context-fixture';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
}));

// A ceiling of three rows exercises the cut branch without a 50 000-row file to parse.
// A getter, so only the variant that asks for it is cut and the others render every hostile row.
const ceiling = vi.hoisted(() => ({ value: 50_000 }));
vi.mock('@/lib/export/report-sections', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/export/report-sections')>();
  return {
    ...original,
    get HTML_REPORT_MAX_ROWS(): number {
      return ceiling.value;
    },
  };
});

const { buildExportHtml } = await import('@/lib/export/html');

const FORBIDDEN_ATTRIBUTES = new Set([
  'src',
  'srcset',
  'action',
  'formaction',
  'poster',
  'data',
  'xlink:href',
  'background',
  'ping',
]);
const FORBIDDEN_ELEMENTS = new Set(['link', 'base', 'script', 'iframe', 'object', 'embed']);
const FETCHING_CSS = /image-set\(|src\(|@font-face/i;
const SVG_SHAPES = new Set(['path', 'polyline', 'circle', 'rect', 'line']);
const PROFILE_HREF = /^https:\/\/instagram\.com\/[a-z0-9._]{1,30}$/;

function findNetworkHazards(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found: string[] = [];

  for (const el of doc.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN_ELEMENTS.has(tag)) found.push(`element:${tag}`);
    if (tag === 'meta' && el.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
      found.push('meta-refresh');
    }
    if (tag === 'style' && /url\(|@import/i.test(el.textContent ?? '')) {
      found.push('style:url-or-import');
    }
    if (tag === 'style' && FETCHING_CSS.test(el.textContent ?? '')) {
      found.push('style:fetching-css');
    }
    if (tag !== 'svg' && el.closest('svg') && !SVG_SHAPES.has(el.localName.toLowerCase())) {
      found.push(`svg-child:${el.localName.toLowerCase()}`);
    }
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase();
      if (FORBIDDEN_ATTRIBUTES.has(name)) found.push(`attr:${name}`);
      if (name.startsWith('on')) found.push(`attr:${name}`);
      if (/url\(/i.test(attr.value)) found.push(`attr-url:${name}`);
      if (name === 'style' && FETCHING_CSS.test(attr.value)) {
        found.push(`attr-fetching-css:${name}`);
      }
      if (name === 'href' && !PROFILE_HREF.test(attr.value) && attr.value !== REPORT_SITE_URL) {
        found.push(`href:${attr.value}`);
      }
    }
  }

  const first = doc.head.firstElementChild;
  const isCsp =
    first?.tagName === 'META' &&
    first.getAttribute('http-equiv') === 'Content-Security-Policy' &&
    first.getAttribute('content') === REPORT_CSP;
  if (!isCsp) found.push('csp-not-first');
  return found;
}

function account(username: string, badges: AccountBadges['badges'] = {}): AccountBadges {
  return { username, badges };
}

function serve(list: AccountBadges[]): void {
  getAccountsByRange.mockImplementation((_h: string, start: number, end: number) =>
    Promise.resolve(list.slice(start, end))
  );
}

const SECONDS = 1_700_000_000;
const RECORD = {
  fileName: 'instagram-alice_owner-2026-10-01.zip',
  uploadDate: new Date(2020, 0, 1),
  dateZones: { following: 'local', followers: 'utc', pending: 'utc' },
  followRequestsUnreadable: true,
  truncatedRelationshipFile: 'followers',
};

const HOSTILE: AccountBadges[] = [
  account('alice', { notFollowingBack: true, following: SECONDS, pending: SECONDS }),
  account('bob', { notFollowedBack: true, followers: SECONDS }),
  // Outside the username allowlist: must render as text, never as a link.
  account('x"><script>1</script>', { mutuals: true }),
  account('a/../b?c#d', { mutuals: true }),
  { username: 'eve', badges: { mutuals: true }, href: 'https://evil.example/' } as never,
  account('frank', { notFollowingBack: true }),
  account('gina', { notFollowingBack: true }),
  account('hank', { notFollowingBack: true }),
  account('carol', { following: true, close: true }),
  account('dave', { following: true }),
];

async function fixtures(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const run = async (name: string, over: Parameters<typeof makeReport>[0] = {}): Promise<void> => {
    const report = makeReport(over);
    report.strings.searchNarrowed = 'SEARCH_NARROWED';
    report.strings.sample = over.sampleLimit
      ? {
          head: 'SAMPLE_HEAD',
          body: 'SAMPLE_BODY',
          more: `MORE ${SLOT}`,
          cta: 'SAMPLE_CTA',
          ctaSub: 'SAMPLE_CTA_SUB',
        }
      : null;
    serve(HOSTILE);
    out[name] = await readBlobText(await buildExportHtml('h', null, HOSTILE.length, report));
  };

  getFileMetadata.mockResolvedValue(RECORD);
  ceiling.value = 3;
  try {
    await run('ceiling');
  } finally {
    ceiling.value = 50_000;
  }
  await run('sample', { sampleLimit: 2 });
  await run('rtl', { lang: 'ar', dir: 'rtl' });
  getFileMetadata.mockResolvedValue({ ...RECORD, dateZones: undefined });
  await run('stale');
  getFileMetadata.mockResolvedValue(null);
  await run('no-record');
  serve([]);
  out['empty'] = await readBlobText(await buildExportHtml('h', [], 0, makeReport()));
  return out;
}

describe('html report privacy gate', () => {
  beforeEach(() => {
    getAccountsByRange.mockReset();
    getFileMetadata.mockReset();
  });

  it('finds no way to reach the network in any variant of the file', async () => {
    const files = await fixtures();
    expect(Object.keys(files).length).toBeGreaterThan(5);
    for (const [name, html] of Object.entries(files)) {
      expect([name, findNetworkHazards(html)]).toEqual([name, []]);
    }
  });

  it('exercises the branches the gate is meant to cover', async () => {
    const files = await fixtures();
    expect(files['ceiling']).toContain('CEILING_TOP');
    expect(files['sample']).not.toContain('CEILING_TOP');
    expect(files['sample']).toContain('SAMPLE_LINE');
    expect(files['stale']).toContain('CAVEAT_DATES_STALE');
    expect(files['ceiling']).toContain('<time');
    expect(files['ceiling']).toContain('CAVEAT_FOLLOW_REQUESTS');
  });

  it('never turns a stored href into a link', async () => {
    const files = await fixtures();
    for (const html of Object.values(files)) expect(html).not.toContain('evil');
  });

  it('never carries the file name, so the owner is not in the report', async () => {
    const files = await fixtures();
    for (const html of Object.values(files)) expect(html).not.toContain('alice_owner');
  });
});

describe('strings html.ts writes itself are escaped', () => {
  const H = '<img src=x onerror=1>"><b>&';
  const tag = (key: string): string => `${key} ${H}`;

  function hostileReport(): ReturnType<typeof makeReport> {
    const report = makeReport();
    const st = report.strings;
    st.title = tag('TITLE');
    st.madeOn = `${tag('MADE')} ${SLOT}`;
    st.uploadedOn = `${tag('UPLOADED')} ${SLOT}`;
    st.scope = tag('SCOPE');
    st.searchNarrowed = tag('SEARCH');
    st.sample = {
      head: tag('SAMPLE_HEAD'),
      body: tag('SAMPLE_BODY'),
      more: `${tag('SAMPLE_MORE')} ${SLOT}`,
      cta: tag('SAMPLE_CTA'),
      ctaSub: tag('SAMPLE_CTA_SUB'),
    };
    st.sectionHeadings = {
      notFollowingBack: tag('H_NFB'),
      notFollowedBack: tag('H_NFDB'),
      mutuals: tag('H_MUT'),
      other: tag('H_OTHER'),
    };
    st.labels = { pending: tag('LBL_PENDING') };
    st.dateLines = {
      following: `${tag('DL_FOLLOWING')} ${SLOT}`,
      followers: `${tag('DL_FOLLOWERS')} ${SLOT}`,
      mutual: `${tag('DL_MUTUAL')} ${SLOT}`,
      requested: `${tag('DL_REQUESTED')} ${SLOT}`,
    };
    st.caveats = {
      followRequests: tag('CV_REQ'),
      truncatedFollowers: tag('CV_FOLLOWERS'),
      truncatedFollowing: tag('CV_FOLLOWING'),
      datesStale: tag('CV_STALE'),
    };
    st.ceilingTop = `${tag('CEIL_TOP')} ${SLOT}`;
    st.ceilingSection = `${tag('CEIL_SECTION')} ${SLOT}`;
    st.footer = tag('FOOTER');
    return report;
  }

  it('shows hostile copy as literal text and builds no element from it', async () => {
    serve(HOSTILE);
    const built: string[] = [];
    ceiling.value = 3;
    try {
      getFileMetadata.mockResolvedValue({ ...RECORD, truncatedRelationshipFile: 'followers' });
      built.push(
        await readBlobText(await buildExportHtml('h', null, HOSTILE.length, hostileReport()))
      );
      getFileMetadata.mockResolvedValue({
        ...RECORD,
        dateZones: undefined,
        truncatedRelationshipFile: 'following',
      });
      built.push(
        await readBlobText(await buildExportHtml('h', null, HOSTILE.length, hostileReport()))
      );
    } finally {
      ceiling.value = 50_000;
    }

    const seen = new Set<string>();
    for (const html of built) {
      expect(findNetworkHazards(html)).toEqual([]);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      expect(doc.querySelector('img, b')).toBeNull();
      const text = `${doc.title}\n${doc.body.textContent ?? ''}`;
      for (const m of text.matchAll(/([A-Z_]+) <img src=x onerror=1>"><b>&/g)) seen.add(m[1] ?? '');
    }
    for (const key of [
      'TITLE',
      'MADE',
      'UPLOADED',
      'SCOPE',
      'SEARCH',
      'SAMPLE',
      'H_NFB',
      'H_NFDB',
      'H_MUT',
      'H_OTHER',
      'LBL_PENDING',
      'DL_REQUESTED',
      'CV_REQ',
      'CV_FOLLOWERS',
      'CV_FOLLOWING',
      'CV_STALE',
      'CEIL_TOP',
      'CEIL_SECTION',
      'FOOTER',
    ]) {
      expect(seen, key).toContain(key);
    }
  });
});

describe('findNetworkHazards (red-proof)', () => {
  let good: string;

  beforeEach(async () => {
    getAccountsByRange.mockReset();
    getFileMetadata.mockReset();
    getFileMetadata.mockResolvedValue(RECORD);
    serve([account('alice', { mutuals: true })]);
    good = await readBlobText(await buildExportHtml('h', null, 1, makeReport()));
  });

  it('passes the known-good file', () => {
    expect(findNetworkHazards(good)).toEqual([]);
  });

  const POISON: [string, (html: string) => string, string][] = [
    [
      'img src',
      h => h.replace('</main>', '<img src="https://t.example/p.png"></main>'),
      'attr:src',
    ],
    ['srcset', h => h.replace('</main>', '<img srcset="a 1x"></main>'), 'attr:srcset'],
    ['form action', h => h.replace('</main>', '<form action="/x"></form></main>'), 'attr:action'],
    [
      'formaction',
      h => h.replace('</main>', '<button formaction="/x"></button></main>'),
      'attr:formaction',
    ],
    ['poster', h => h.replace('</main>', '<video poster="x"></video></main>'), 'attr:poster'],
    ['object data', h => h.replace('</main>', '<object data="x"></object></main>'), 'attr:data'],
    [
      'xlink:href',
      h => h.replace('</main>', '<svg><use xlink:href="x"/></svg></main>'),
      'attr:xlink:href',
    ],
    ['inline handler', h => h.replace('</main>', '<p onclick="1">x</p></main>'), 'attr:onclick'],
    [
      'link element',
      h => h.replace('</main>', '<link rel="stylesheet" href="x">' + '</main>'),
      'element:link',
    ],
    [
      'base element',
      h => h.replace('</main>', '<base href="https://e.example/"></main>'),
      'element:base',
    ],
    ['script element', h => h.replace('</main>', '<script>1</script></main>'), 'element:script'],
    ['iframe', h => h.replace('</main>', '<iframe></iframe></main>'), 'element:iframe'],
    ['object', h => h.replace('</main>', '<object></object></main>'), 'element:object'],
    ['embed', h => h.replace('</main>', '<embed></main>'), 'element:embed'],
    [
      'meta refresh',
      h => h.replace('</main>', '<meta http-equiv="refresh" content="0;url=x"></main>'),
      'meta-refresh',
    ],
    [
      'css url()',
      h => h.replace('</style>', 'a{background:url(x)}</style>'),
      'style:url-or-import',
    ],
    ['css @import', h => h.replace('</style>', '@import "x";</style>'), 'style:url-or-import'],
    [
      'style attribute url()',
      h => h.replace('</main>', '<p style="background:url(x)">x</p></main>'),
      'attr-url:style',
    ],
    [
      'foreign href',
      h => h.replace('</main>', '<a href="https://evil.example/">x</a></main>'),
      'href:https://evil.example/',
    ],
    [
      'profile href with path',
      h => h.replace('</main>', '<a href="https://instagram.com/a/b">x</a></main>'),
      'href:https://instagram.com/a/b',
    ],
    [
      'javascript href',
      h => h.replace('</main>', '<a href="javascript:1">x</a></main>'),
      'href:javascript:1',
    ],
    [
      'CSP not first',
      h => h.replace('<head>', '<head><meta name="x" content="y">'),
      'csp-not-first',
    ],
    [
      'CSP missing',
      h => h.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
      'csp-not-first',
    ],
    [
      'CSP weakened',
      h => h.replace('default-src &#39;none&#39;', 'default-src *'),
      'csp-not-first',
    ],
    [
      'css image-set',
      h => h.replace('</style>', 'a{background:image-set("https://t.example/a.png" 1x)}</style>'),
      'style:fetching-css',
    ],
    [
      'css -webkit-image-set',
      h => h.replace('</style>', 'a{background:-webkit-image-set("x" 1x)}</style>'),
      'style:fetching-css',
    ],
    [
      'css src()',
      h => h.replace('</style>', 'a{background:src("x")}</style>'),
      'style:fetching-css',
    ],
    [
      'css @font-face',
      h => h.replace('</style>', '@font-face{font-family:x}</style>'),
      'style:fetching-css',
    ],
    [
      'style attribute image-set',
      h => h.replace('</main>', '<p style="background:image-set(&quot;x&quot; 1x)">x</p></main>'),
      'attr-fetching-css:style',
    ],
    [
      'svg set',
      h =>
        h.replace(
          '</main>',
          '<svg><set attributeName="href" to="https://e.example/"/></svg></main>'
        ),
      'svg-child:set',
    ],
    [
      'svg foreignObject',
      h => h.replace('</main>', '<svg><foreignObject></foreignObject></svg></main>'),
      'svg-child:foreignobject',
    ],
    [
      'svg animate',
      h => h.replace('</main>', '<svg><animate attributeName="x"/></svg></main>'),
      'svg-child:animate',
    ],
    ['svg image', h => h.replace('</main>', '<svg><image/></svg></main>'), 'svg-child:image'],
    ['svg anchor', h => h.replace('</main>', '<svg><a></a></svg></main>'), 'svg-child:a'],
  ];

  it.each(POISON)('reports %s', (_name, poison, expected) => {
    expect(findNetworkHazards(poison(good))).toContain(expected);
  });

  it('accepts a shape-only, aria-hidden svg', () => {
    const icon =
      '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 1"/><polyline points="1 1"/><circle cx="1" cy="1" r="1"/><rect width="1" height="1"/><line x1="0" y1="0" x2="1" y2="1"/></svg>';
    expect(findNetworkHazards(good.replace('</main>', `${icon}</main>`))).toEqual([]);
  });
});
