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

/** The origin the analytics tag is actually served from, read from its loader. */
function umamiOrigin(): string {
  const loader = readFileSync(resolve(ROOT, 'src/lib/umami-loader.ts'), 'utf8');
  const match = /script\.src\s*=\s*'(https:\/\/[^/']+)/.exec(loader);
  if (!match?.[1]) throw new Error('umami-loader.ts no longer assigns a literal script.src');
  return match[1];
}

/**
 * Host → the directives it must appear in, and why. A host listed here for
 * three directives and present in two is the exact shape of the 2026-08-14 bug.
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
];

describe('vercel.json Content-Security-Policy', () => {
  const directives = readCspDirectives();

  it.each(REQUIRED)('allows $host where it is needed — $why', ({ host, directives: needed }) => {
    const missing = needed.filter(directive => !directives.get(directive)?.includes(host));

    expect(missing).toEqual([]);
  });

  it('allows the analytics origin its own loader points at', () => {
    const origin = umamiOrigin();

    // Derived rather than restated: GH#63 tracks making this host configurable,
    // and a CSP that still names the old one fails silently in production.
    expect(directives.get('script-src')).toContain(origin);
    expect(directives.get('connect-src')).toContain(origin);
  });

  it('keeps the directives that make a missing source fail closed', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
  });
});
