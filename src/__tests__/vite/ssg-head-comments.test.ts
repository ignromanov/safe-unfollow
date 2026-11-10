import { describe, it, expect } from 'vitest';
import { stripHeadComments } from '../../../vite/ssg-meta-injector';

describe('stripHeadComments', () => {
  it('removes developer comments from <head>', () => {
    const out = stripHeadComments(
      '<head><!-- GH#99 note -->\n<meta charset="utf-8"></head><body></body>'
    );
    expect(out).toBe('<head><meta charset="utf-8"></head><body></body>');
  });

  it('keeps React text separators in <body> (hydration depends on them)', () => {
    const body = '<body><div id="root"><p>a<!-- -->b</p></div></body>';
    expect(stripHeadComments(`<head><!-- x --></head>${body}`)).toBe(`<head></head>${body}`);
  });

  it('leaves inline script bodies untouched', () => {
    const script = '<script>var s = "<!-- not a comment -->";</script>';
    expect(stripHeadComments(`<head>${script}</head>`)).toBe(`<head>${script}</head>`);
  });

  it('keeps conditional comments', () => {
    const cc = '<!--[if IE]><meta x><![endif]-->';
    expect(stripHeadComments(`<head>${cc}</head>`)).toBe(`<head>${cc}</head>`);
  });

  it('returns input unchanged when there is no </head>', () => {
    expect(stripHeadComments('<p><!-- x --></p>')).toBe('<p><!-- x --></p>');
  });
});
