import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  readHeaderRules,
  readRedirectRules,
  type HeaderRule,
  type RedirectRule,
} from '../../scripts/static-config';

/**
 * Interim gate: `vercel.json` still serves production while `public/_headers` and
 * `public/_redirects` are what every other check reads.
 *
 * Until the domain moves to Cloudflare, two copies of the same hosting rules exist and
 * only one of them is gated. The CSP, redirect and noindex suites read the Cloudflare files;
 * the sitemap and the prerendered `<meta name="robots">` derive from `_headers` too. Yet
 * the HTTP headers and redirects a visitor actually receives come from `vercel.json`. A rule
 * edited in one file and not the other ships with every gate green — and for robots it
 * produces a page whose meta tag and response header disagree.
 *
 * So this suite evaluates both rule sets on the same request paths and compares outcomes,
 * not text: the two grammars cannot be compared line by line (Vercel's `/:lang(ar|de|…)`
 * alternation is one Cloudflare line per locale). The probe paths are generated from the
 * sources of BOTH files, so a rule added to either one is probed without editing this test.
 *
 * ⛔ Delete this file in the switch PR, together with `vercel.json`. It reads that file
 * unconditionally, so leaving it behind fails loudly instead of passing vacuously.
 *
 * Deliberate differences, each excluded by name rather than by loosening the comparison:
 * - `https://vercel.live` leaves the CSP: it is the Vercel preview toolbar.
 * - Vercel's host-scoped redirect (`has: host`, the legacy `*.vercel.app` domain) has no
 *   Cloudflare twin: that hostname is Vercel's and stays there.
 * - Cloudflare's absolute-URL rules (`https://…workers.dev/*`) apply only to workers.dev
 *   hosts, which Vercel never serves, so they are not evaluated for the production host.
 * - Trailing-slash and `.html` normalisation (`cleanUrls` vs `html_handling`) is not a
 *   rule in either file and is not compared here (Cloudflare answers 307, Vercel 308).
 */

const ROOT = resolve(__dirname, '../..');

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: unknown[];
}

interface VercelConfig {
  redirects: VercelRedirect[];
  headers: HeaderRule[];
}

const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as VercelConfig;
const cfHeaders = readHeaderRules(ROOT);
const cfRedirects = readRedirectRules(ROOT);

const VERCEL_ONLY_CSP_SOURCES = ['https://vercel.live'];

function escapeRegex(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** path-to-regexp, as far as vercel.json uses it: `:name`, `:name*`, `:name(a|b)`, `(.*)`. */
function vercelPattern(source: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  let body = '';
  const token = /:(\w+)(\([^)]*\))?(\*)?|\((\.\*)\)|([^:(]+)/g;
  for (const m of source.matchAll(token)) {
    if (m[1]) {
      names.push(m[1]);
      if (m[2]) body += m[2];
      else if (m[3]) body += '(.*)';
      else body += '([^/]+?)';
    } else if (m[4]) {
      names.push(String(names.length));
      body += '(.*)';
    } else {
      body += escapeRegex(m[5]!);
    }
  }
  // `/:path*` also matches the bare prefix: `/hi/:path*` covers `/hi`.
  body = body.replace(/\/\(\.\*\)$/, '(?:/(.*))?');
  return { regex: new RegExp(`^${body}$`), names };
}

/** Cloudflare's grammar: one greedy `*` (`:splat`), `:name` stops at `/`. */
function cfPattern(source: string): { regex: RegExp; names: string[] } {
  const names: string[] = [];
  let body = '';
  for (const m of source.matchAll(/:(\w+)|(\*)|([^:*]+)/g)) {
    if (m[1]) {
      names.push(m[1]);
      body += '([^/]+)';
    } else if (m[2]) {
      names.push('splat');
      body += '(.*)';
    } else {
      body += escapeRegex(m[3]!);
    }
  }
  return { regex: new RegExp(`^${body}$`), names };
}

function captures(
  pattern: { regex: RegExp; names: string[] },
  path: string
): Record<string, string> | null {
  const m = pattern.regex.exec(path);
  if (!m) return null;
  return Object.fromEntries(pattern.names.map((name, i) => [name, m[i + 1] ?? '']));
}

function substitute(destination: string, params: Record<string, string>): string {
  return destination
    .replace(/:(\w+)\*?/g, (_, name: string) => params[name] ?? `:${name}`)
    .replace(/\/{2,}/g, '/');
}

function resolveHeaders(rules: HeaderRule[], path: string, match: typeof cfPattern) {
  const out = new Map<string, string[]>();
  for (const rule of rules) {
    if (rule.source.startsWith('https://')) continue;
    if (!captures(match(rule.source), path)) continue;
    for (const { key, value } of rule.headers) {
      const k = key.toLowerCase();
      out.set(k, [...(out.get(k) ?? []), value]);
    }
  }
  return out;
}

function normaliseCsp(value: string): string {
  return value
    .split(' ')
    .filter(token => !VERCEL_ONLY_CSP_SOURCES.includes(token))
    .join(' ');
}

function vercelRedirectFor(path: string) {
  for (const rule of vercel.redirects) {
    if (rule.has) continue;
    const params = captures(vercelPattern(rule.source), path);
    if (params) {
      return {
        destination: substitute(rule.destination, params),
        status: rule.permanent ? 308 : 307,
      };
    }
  }
  return null;
}

function cfRedirectFor(path: string, rules: RedirectRule[] = cfRedirects) {
  for (const rule of rules) {
    const params = captures(cfPattern(rule.source), path);
    if (params) return { destination: substitute(rule.destination, params), status: rule.status };
  }
  return null;
}

/** Concrete paths from a pattern: every alternation branch, every wildcard as `probe`. */
function instantiate(source: string): string[] {
  const group = /:\w+\(([^)]*)\)|\((\.\*)\)/.exec(source);
  if (group) {
    const branches = group[1] ? group[1].split('|') : ['probe'];
    const head = source.slice(0, group.index);
    const tail = source.slice(group.index + group[0].length);
    return branches.flatMap(b => instantiate(`${head}${b}${tail}`));
  }
  return [source.replace(/:\w+\*?|\*/g, 'probe')];
}

const PROBES = [
  ...new Set([
    '/',
    '/upload',
    '/docs/faq',
    ...vercel.headers.flatMap(r => instantiate(r.source)),
    ...vercel.redirects.filter(r => !r.has).flatMap(r => instantiate(r.source)),
    ...cfHeaders.filter(r => !r.source.startsWith('https://')).flatMap(r => instantiate(r.source)),
    ...cfRedirects.flatMap(r => instantiate(r.source)),
  ]),
].sort();

describe('vercel.json and the Cloudflare rule files agree until the domain moves', () => {
  it('probes every rule of both files, so the comparison is not vacuous', () => {
    // A probe list that silently shrank would turn every assertion below into a no-op.
    expect(PROBES.length).toBeGreaterThan(40);
    expect(PROBES).toContain('/ru/sample');
    expect(PROBES).toContain('/de/wizard/step/probe');
  });

  it.each(PROBES)('%s gets the same headers from both', path => {
    const v = resolveHeaders(vercel.headers, path, vercelPattern);
    const c = resolveHeaders(cfHeaders, path, cfPattern);

    // Vercel lets a later rule overwrite an earlier one; Cloudflare joins them with ", ".
    // Neither file relies on that today, and a comparison across the two semantics would
    // be meaningless, so a duplicate is a failure in its own right.
    for (const [name, values] of [...v, ...c]) {
      expect(values, `${path}: ${name} is set by more than one rule`).toHaveLength(1);
    }

    const flat = (m: Map<string, string[]>, csp: (s: string) => string) =>
      Object.fromEntries(
        [...m].map(([k, [value]]) => [k, k === 'content-security-policy' ? csp(value!) : value])
      );

    expect(flat(c, s => s)).toEqual(flat(v, normaliseCsp));
  });

  it.each(PROBES)('%s redirects the same way in both', path => {
    expect(cfRedirectFor(path)).toEqual(vercelRedirectFor(path));
  });

  it('the CSP exclusion removes only what it names', () => {
    // Guards the normaliser itself: if Cloudflare's CSP gained vercel.live back, or Vercel's
    // lost some other source, the comparison above must still see it.
    const vCsp = resolveHeaders(vercel.headers, '/', vercelPattern).get('content-security-policy')!;
    expect(vCsp[0]).toContain('https://vercel.live');
    const cCsp = resolveHeaders(cfHeaders, '/', cfPattern).get('content-security-policy')!;
    expect(cCsp[0]).not.toContain('vercel.live');
  });
});
