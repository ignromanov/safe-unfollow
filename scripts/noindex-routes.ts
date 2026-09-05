/**
 * Which base paths the site serves with `X-Robots-Tag: noindex`, read from vercel.json.
 *
 * `scripts/generate-sitemap.ts` consults this so a route we tell Google not to index is not also
 * advertised in the sitemap. Deriving it means the header and the sitemap cannot disagree; the
 * alternative - a second hand-typed list in the generator - is the shape EXCLUDE_PATTERNS was in
 * when it was "one stub behind reality".
 *
 * Its own module rather than a function in the generator, because that file ends in a bare
 * `main();` and importing it from a test would run it.
 */
export interface VercelHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

export interface NoindexRoutes {
  /** Base paths matched exactly, locale prefix already stripped. */
  exact: Set<string>;
  /** Path prefixes: the route itself and everything under it. */
  prefixes: string[];
  matches(basePath: string): boolean;
}

/** `/:lang(ar|de|...)` at the head of a source, followed by more path. */
const LANG_PREFIX = /^\/:[a-z]+\([a-z|]+\)(?=\/)/;
/** `/results` */
const LITERAL = /^\/[a-z0-9-]+$/;
/** `/:path(results|sample)` */
const GROUP = /^\/:[a-z]+\(([a-z0-9|-]+)\)$/;
/** `/affiliate/(.*)` */
const PREFIX_WILDCARD = /^(\/[a-z0-9-]+)\/\(\.\*\)$/;

export function noindexRoutes(rules: VercelHeaderRule[]): NoindexRoutes {
  const exact = new Set<string>();
  const prefixes: string[] = [];

  for (const rule of rules) {
    const carriesNoindex = (rule.headers ?? []).some(
      (header) =>
        header.key.toLowerCase() === "x-robots-tag" && /\bnoindex\b/i.test(header.value)
    );
    if (!carriesNoindex) continue;

    const source = rule.source;

    if (source === "/(.*)" || source === "/:path*") {
      throw new Error(
        `noindex-routes: a site-wide X-Robots-Tag ("${source}") would empty the sitemap. ` +
          "Refusing rather than guessing — if that is really intended, say so explicitly here."
      );
    }

    const wildcard = PREFIX_WILDCARD.exec(source);
    if (wildcard) {
      // PREFIX_WILDCARD has exactly one capture group and it is not optional in the
      // pattern, so a match guarantees it captured.
      prefixes.push(wildcard[1]!);
      continue;
    }

    const bare = source.replace(LANG_PREFIX, "");
    if (LITERAL.test(bare)) {
      exact.add(bare);
      continue;
    }

    const group = GROUP.exec(bare);
    if (group?.[1] !== undefined) {
      for (const name of group[1].split("|")) exact.add(`/${name}`);
      continue;
    }

    throw new Error(
      `noindex-routes: unrecognised X-Robots-Tag source "${source}". Teach this module the ` +
        "shape — do not let it fall through, or the route stays in the sitemap while the header " +
        "says noindex, and the two facts disagree silently."
    );
  }

  return {
    exact,
    prefixes,
    matches(basePath: string): boolean {
      return (
        exact.has(basePath) ||
        prefixes.some((prefix) => basePath === prefix || basePath.startsWith(`${prefix}/`))
      );
    },
  };
}
