import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The CSP ships as one long string in `vercel.json` and is enforced only in
 * production, so a missing source is invisible until a visitor's console
 * reports it. Two were missing at once on 2026-08-14 — Funding Choices could
 * not `connect`, and Google's invalid-traffic script could not load — and both
 * hosts were already present in two of the three directives they need. The
 * defect is a forgotten *directive*, not a forgotten host, which is what this
 * file checks.
 */

const ROOT = resolve(__dirname, '../..');

function readCspDirectives(): Map<string, string[]> {
  const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
    headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };

  const csp = config.headers
    .flatMap(entry => entry.headers)
    .find(header => header.key === 'Content-Security-Policy');

  if (!csp) throw new Error('vercel.json declares no Content-Security-Policy header');

  return new Map(
    csp.value
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...sources] = part.split(/\s+/);
        return [name as string, sources];
      })
  );
}

/** The default path the analytics tag is served from, read from its loader. */
function umamiSrc(): string {
  const loader = readFileSync(resolve(ROOT, 'src/lib/umami-loader.ts'), 'utf8');
  const match = /VITE_UMAMI_SRC\s*\|\|\s*'([^']+)'/.exec(loader);
  if (!match?.[1]) throw new Error('umami-loader.ts no longer declares a default UMAMI_SRC');
  return match[1];
}

/**
 * Host → the directives it must appear in, and why. A host listed here for
 * three directives and present in two is the exact shape of the 2026-08-14 bug.
 *
 * This table is a record of what production has been observed to need, NOT a
 * specification. Google publishes no allowlist for AdSense and says so plainly
 * — "the domains that the AdSense ad code uses change over time" — recommending
 * nonce-based strict CSP instead (support.google.com/adsense/answer/16283098).
 * So an entry gets added here when a console reports it blocked, never on a
 * guess, and this file cannot prove the list is complete. Only the shift to a
 * nonce policy would, and that is a privacy-trust call, not an engineering one.
 *
 * A nonce policy is also not currently implementable: the CSP ships as one
 * static header in vercel.json, the site has no middleware, and a nonce has to
 * be minted per request. Adopting one means putting a serverless hop in front
 * of a static site — a cost worth naming before anyone recommends it again.
 */
const REQUIRED: Array<{ host: string; directives: string[]; why: string }> = [
  {
    host: 'https://fundingchoicesmessages.google.com',
    directives: ['script-src', 'connect-src', 'frame-src'],
    why: 'Funding Choices consent messaging: loads a script, calls home, and renders in a frame',
  },
  {
    host: 'https://*.adtrafficquality.google',
    directives: ['script-src', 'connect-src', 'frame-src'],
    why: "Google's invalid-traffic signals (ep2…/sodar/sodar2.js) — blocking it degrades ad quality reporting",
  },
  {
    host: 'https://*.googlesyndication.com',
    directives: ['script-src', 'connect-src', 'frame-src'],
    why: 'AdSense ad serving',
  },
  {
    host: 'https://www.google.com',
    directives: ['frame-src'],
    // Framing only: an AdSense creative embeds www.google.com, and a
    // cross-origin frame executes nothing in this origin. Deliberately NOT
    // added to script-src or connect-src, where it would grant far more than
    // the observed violation asks for.
    why: 'an AdSense creative frames www.google.com — reported blocked 2026-08-14',
  },
];

describe('vercel.json Content-Security-Policy', () => {
  const directives = readCspDirectives();

  it.each(REQUIRED)('allows $host where it is needed — $why', ({ host, directives: needed }) => {
    const missing = needed.filter(directive => !directives.get(directive)?.includes(host));

    expect(missing).toEqual([]);
  });

  it('serves analytics same-origin, so the CSP needs no analytics host at all', () => {
    const src = umamiSrc();

    // Derived rather than restated. The tag is loaded from our own origin and
    // rewritten to the analytics instance by vercel.json, so `'self'` already
    // covers both the script and its POSTs — naming a host here would be dead
    // config that silently rots, which is exactly the 2026-08-14 failure.
    expect(src.startsWith('/')).toBe(true);

    const config = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as {
      rewrites?: { source: string; destination: string }[];
    };
    const prefix = `/${src.split('/')[1]}`;
    const proxy = config.rewrites?.find(r => r.source.startsWith(`${prefix}/`));

    // Without this rewrite the tag 404s against our own static build, and the
    // failure is invisible: no CSP violation, no console error, just no data.
    expect(proxy, `no vercel.json rewrite serves ${prefix}/`).toBeDefined();
    expect(proxy?.destination).toMatch(/^https:\/\//);
  });

  /**
   * Deliberately blocked, decided 2026-08-14. AdSense asks for Google Sans Text
   * and Roboto from fonts.googleapis.com; the returned stylesheet then points
   * at fonts.gstatic.com, so allowing one without the other only moves the
   * violation. Both were refused.
   *
   * This is not the same shape as the five violations above. Those blocked
   * something the site had already hired — a script, a frame, a call home.
   * This one blocks two NEW outbound origins that would see every ad-viewing
   * visitor's IP and User-Agent, and it buys typography inside an ad unit
   * earning $0.191 Page RPM. The CSP did its job here; the console line is the
   * evidence, not the defect.
   *
   * Reopening this means updating docs/privacy.md, whose Third-Party Hosting
   * section names Vercel alone.
   */
  it.each([
    { host: 'https://fonts.googleapis.com', directive: 'style-src' },
    { host: 'https://fonts.gstatic.com', directive: 'font-src' },
  ])(
    'keeps $host out of $directive — ad typography is not worth two more origins',
    ({ host, directive }) => {
      expect(directives.get(directive)).not.toContain(host);
    }
  );

  it('keeps the directives that make a missing source fail closed', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
  });
});
