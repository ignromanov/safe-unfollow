import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the two hosting rule files Cloudflare applies to the static assets:
 * `public/_headers` and `public/_redirects`. Vite copies both into `dist/`, where
 * Workers parses them at deploy time; nothing else in the build looks at them, so this
 * module is how the sitemap, the prerender and the tests see the same rules the edge does.
 *
 * The parsers follow the documented grammar only as far as these files use it
 * (developers.cloudflare.com/workers/static-assets/headers/ and …/redirects/): a rule
 * line that does not fit throws instead of being skipped, because a skipped rule here is
 * a rule the edge still applies while every check built on this module stops seeing it.
 */

export interface HeaderRule {
  /** Path pattern, or an absolute `https://` URL pattern scoped to one host. */
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export interface RedirectRule {
  source: string;
  destination: string;
  /** 302 when the line names none — Cloudflare's default. */
  status: number;
}

const COMMENT_OR_BLANK = /^\s*(#.*)?$/;

export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;

  text.split(/\r?\n/).forEach((line, index) => {
    if (COMMENT_OR_BLANK.test(line)) return;

    if (!/^\s/.test(line)) {
      current = { source: line.trim(), headers: [] };
      rules.push(current);
      return;
    }

    const header = /^\s+([^:\s]+):\s*(.*)$/.exec(line);
    if (!current || !header) {
      throw new Error(`_headers line ${index + 1}: expected "  Name: value" under a path, got "${line}"`);
    }
    (current as HeaderRule).headers.push({ key: header[1]!, value: header[2]!.trim() });
  });

  return rules;
}

export function parseRedirects(text: string): RedirectRule[] {
  const rules: RedirectRule[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (COMMENT_OR_BLANK.test(line)) return;

    const parts = line.trim().split(/\s+/);
    const status = parts[2] === undefined ? 302 : Number(parts[2]);
    if (parts.length < 2 || parts.length > 3 || !Number.isInteger(status)) {
      throw new Error(`_redirects line ${index + 1}: expected "source destination [status]", got "${line}"`);
    }
    rules.push({ source: parts[0]!, destination: parts[1]!, status });
  });

  return rules;
}

export function readHeaderRules(rootDir: string = process.cwd()): HeaderRule[] {
  return parseHeaders(readFileSync(join(rootDir, "public", "_headers"), "utf-8"));
}

export function readRedirectRules(rootDir: string = process.cwd()): RedirectRule[] {
  return parseRedirects(readFileSync(join(rootDir, "public", "_redirects"), "utf-8"));
}
