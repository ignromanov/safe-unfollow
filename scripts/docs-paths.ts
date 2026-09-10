/**
 * Which `/docs/*` URLs exist, read from the Jekyll sources rather than listed again.
 *
 * `scripts/generate-sitemap.ts` discovers every other page by scanning `dist/` for built HTML.
 * The docs cannot be found that way: `vercel.json` runs `npm run build && cd docs && jekyll
 * build`, so when the sitemap is generated `dist/docs/` does not exist yet. The generator
 * therefore has to state these URLs itself, and it used to state them as a hand-typed array of
 * fourteen strings — agreeing with the filesystem by luck, with nothing enforcing it (GH#187).
 *
 * The sources, though, are right there: `docs/*.md` is in the working tree at generation time.
 * So the list is derived from the two files that actually decide it — each page's `permalink`
 * and `_config.yml`'s `baseurl` — and a fifteenth page reaches the sitemap by existing. Same
 * move as `noindex-routes.ts` against `vercel.json`, and its own module for the same stated
 * reason: `generate-sitemap.ts` ends in a bare `main();`, so a test importing it would run it.
 *
 * ⛔ Every silent failure mode here produces a SHORTER sitemap, and a short sitemap is
 * invisible: no page 404s, no build fails, nothing points a crawler at what is missing. The page
 * simply never gets crawled. So this module throws where it could return fewer paths — on a page
 * with no permalink, on a permalink that is not rooted, on a missing baseurl, and on an empty
 * result. Refusing is cheap and loud; a sitemap one entry short is neither.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

/** `permalink: /faq/` in a page's front matter, quoted or not. */
const PERMALINK = /^permalink:\s*(.+?)\s*$/m;
/** `baseurl: "/docs"` in _config.yml. */
const BASEURL = /^baseurl:\s*(.+?)\s*$/m;
/** The front matter block, which is the only place a permalink counts. */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** YAML scalars here are plain or quoted; nothing in these files needs more than that. */
function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

/**
 * Markdown files Jekyll turns into pages.
 *
 * Skips `_`- and `.`-prefixed directories — `_layouts`, `_includes`, and a local `_site`, which
 * is a stale build output living inside the source tree and would advertise whatever the docs
 * used to say. Skips `README.md`, which `_config.yml`'s own `exclude:` already declares is not
 * a page; demanding a permalink of it would fail the build over a file for maintainers.
 */
function markdownPages(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      markdownPages(full, found);
    } else if (entry.endsWith(".md") && entry !== "README.md") {
      found.push(full);
    }
  }
  return found;
}

/** The `permalink` a page declares, refusing anything that would build a wrong URL. */
function permalinkOf(file: string, docsDir: string): string {
  const where = file.slice(docsDir.length + 1);
  const frontMatter = FRONT_MATTER.exec(readFileSync(file, "utf-8"));
  const declared = frontMatter ? PERMALINK.exec(frontMatter[1]!) : null;

  if (!declared) {
    throw new Error(
      `docs-paths: ${where} declares no permalink in its front matter. Jekyll's ` +
        "`permalink: pretty` would still serve it, at an address nothing has verified — so " +
        "adding a guess to the sitemap is worse than refusing. Give the page a permalink."
    );
  }

  const permalink = unquote(declared[1]!);
  if (!permalink.startsWith("/")) {
    throw new Error(
      `docs-paths: ${where} declares a permalink that is not rooted ("${permalink}"). ` +
        "Prefixing the baseurl to it would emit a concatenated URL that resolves to nothing, " +
        "and unlike a missing page that entry would look real. Write it as /path/."
    );
  }
  return permalink;
}

/**
 * Every `/docs/*` base path the site serves, in the slash-free form Vercel actually serves and
 * the sitemap must carry (`docs/_config.yml` records why `jekyll-sitemap` was removed over
 * exactly that difference).
 *
 * @param docsDir the Jekyll source root — `docs/` in this repo.
 */
export function docsPaths(docsDir: string): string[] {
  const config = BASEURL.exec(readFileSync(resolve(docsDir, "_config.yml"), "utf-8"));
  const baseurl = config ? unquote(config[1]!) : "";
  if (baseurl === "") {
    throw new Error(
      `docs-paths: ${docsDir}/_config.yml declares no baseurl. It is what maps a page's ` +
        "permalink onto the URL the site serves, so without it every path below would be " +
        "wrong in the same direction and none of them would 404 at build time."
    );
  }

  const paths = markdownPages(docsDir).map(file => {
    const permalink = permalinkOf(file, docsDir);
    // `permalink: /` is the index page, served at the baseurl itself.
    return permalink === "/" ? baseurl : `${baseurl}${permalink}`.replace(/\/$/, "");
  });

  if (paths.length === 0) {
    throw new Error(
      `docs-paths: found no docs pages under ${docsDir}. Returning an empty list would drop ` +
        "every /docs/* URL from the sitemap in one commit, and nothing downstream can tell " +
        "that from a site that has no docs."
    );
  }

  return paths;
}
