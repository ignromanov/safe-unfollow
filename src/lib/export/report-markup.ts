/**
 * Markup for the downloadable HTML report.
 *
 * Plain string templates, no DOM APIs: this runs inside the export worker.
 * The privacy rules of the file live here. The CSP meta is the first child of
 * <head> because it only governs what follows it; the document carries no
 * script, no external resource and no `url(`; and the only links are profile
 * links built from a username (this module never accepts an href) plus the
 * site link, all `rel="noreferrer"`.
 */

export const REPORT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export const REPORT_SITE_URL = 'https://safeunfollow.app/?from=report';

// Logical properties only, so `dir="rtl"` flips the layout without a second sheet.
export const REPORT_CSS = `
:root{color-scheme:light dark;
--bg:#f7f8fc;--card:#fff;--fg:#11142a;--muted:#585e78;--line:#e4e7f0;--link:#3e4fc7;--cta1:#4c5fd6;--cta2:#7448e0;
--brand1:#5468e0;--brand2:#8a5cf0;--brand3:#d9468f;
--rose:#be123c;--rose-t:#fff1f3;--rose-b:#fecdd6;
--amber:#a14a06;--amber-t:#fff8e6;--amber-b:#fde3a3;
--indigo:#4338ca;--indigo-t:#eef1ff;--indigo-b:#cfd6fe;
--zinc:#52525b;--zinc-t:#f3f3f5;--zinc-b:#e2e2e6;
--warn:#8a4b00;--warn-t:#fff7e8;--warn-b:#f7d79a}
@media (prefers-color-scheme:dark){:root{
--bg:#0c0e18;--card:#151826;--fg:#eef0f8;--muted:#a3a8bf;--line:#262a3d;--link:#9fb0ff;
--rose:#ff9fb2;--rose-t:#2a1219;--rose-b:#4d1f2b;
--amber:#f7c66b;--amber-t:#271c0b;--amber-b:#4a3510;
--indigo:#aab7ff;--indigo-t:#171b38;--indigo-b:#2d3570;
--zinc:#c8c8d0;--zinc-t:#1d1f2a;--zinc-b:#33364a;
--warn:#f7c66b;--warn-t:#241a0a;--warn-b:#4a3510}}
*{box-sizing:border-box}
body{margin:0;padding:20px 16px 40px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg);text-align:start;-webkit-text-size-adjust:100%}
main{max-inline-size:760px;margin-inline:auto}
.i{inline-size:20px;block-size:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.top{display:flex;align-items:center;gap:12px;margin-block-end:4px}
.mark{display:grid;place-items:center;inline-size:44px;block-size:44px;border-radius:14px;color:#fff;background:linear-gradient(135deg,var(--brand1),var(--brand2) 55%,var(--brand3));flex:none}
.mark .i{inline-size:24px;block-size:24px}
h1{font-size:1.625rem;line-height:1.15;letter-spacing:-.03em;font-weight:800;margin:0}
.meta{color:var(--muted);font-size:.875rem;margin:12px 0 0}
.scope{margin:4px 0 0;font-weight:600}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-block:20px}
@media (min-width:640px){.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}}
.tile{background:var(--card);border:1px solid var(--tb);border-radius:16px;padding:14px;color:var(--tc)}
.tile .n{display:block;font-size:1.75rem;line-height:1.1;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums;color:var(--fg)}
.tile .k{display:flex;align-items:center;gap:6px;font-size:.8125rem;font-weight:700;margin-block:6px 2px}
.tile .k .i{inline-size:16px;block-size:16px}
.tile .x{display:block;font-size:.8125rem;line-height:1.35;color:var(--muted)}
.t-notFollowingBack,#notFollowingBack{--tc:var(--rose);--tt:var(--rose-t);--tb:var(--rose-b)}
.t-notFollowedBack,#notFollowedBack{--tc:var(--amber);--tt:var(--amber-t);--tb:var(--amber-b)}
.t-mutuals,#mutuals{--tc:var(--indigo);--tt:var(--indigo-t);--tb:var(--indigo-b)}
.t-other,#other{--tc:var(--zinc);--tt:var(--zinc-t);--tb:var(--zinc-b)}
.callout{display:flex;gap:10px;background:var(--warn-t);border:1px solid var(--warn-b);color:var(--fg);border-radius:14px;padding:12px 14px;margin-block:10px;font-size:.9375rem}
.callout .i{color:var(--warn);margin-block-start:2px}
.callout p{margin:0}
.sample{position:relative;background:var(--card);border-radius:18px;padding:18px;margin-block:20px;border:2px solid transparent;background:linear-gradient(var(--card),var(--card)) padding-box,linear-gradient(135deg,var(--brand1),var(--brand2),var(--brand3)) border-box}
.sample h2{display:flex;align-items:center;gap:8px;font-size:1.0625rem;margin:0 0 6px}
.sample h2 .i{color:var(--brand2)}
.sample p{margin:0 0 12px}
.bar{block-size:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-block-end:6px}
.bar span{display:block;block-size:100%;min-inline-size:6px;border-radius:99px;background:linear-gradient(90deg,var(--brand1),var(--brand2))}
.barlabel{font-size:.8125rem;color:var(--muted);margin-block-end:14px;font-variant-numeric:tabular-nums}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;min-block-size:48px;border-radius:12px;padding:12px 18px;font-weight:700;color:#fff;text-decoration:none;background:linear-gradient(135deg,var(--cta1),var(--cta2))}
[dir=rtl] .cta .i{transform:scaleX(-1)}
.ctasub{display:block;text-align:center;font-size:.8125rem;color:var(--muted);margin-block-start:8px}
details{background:var(--card);border:1px solid var(--line);border-radius:18px;margin-block:16px;overflow:clip}
summary{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:10px;list-style:none;cursor:pointer;padding:14px 16px;background:var(--card);border-block-end:1px solid var(--line)}
summary::-webkit-details-marker{display:none}
summary::after{content:"";inline-size:8px;block-size:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);margin-inline-start:4px;margin-block-start:-4px}
details:not([open]) summary::after{transform:rotate(-45deg);margin-block-start:0}
[dir=rtl] details:not([open]) summary::after{transform:rotate(135deg)}
summary .ico{display:grid;place-items:center;inline-size:36px;block-size:36px;border-radius:10px;background:var(--tt);color:var(--tc);flex:none}
summary h2{font-size:1.0625rem;line-height:1.25;margin:0;flex:1}
summary .count{font-weight:800;font-variant-numeric:tabular-nums;color:var(--tc);background:var(--tt);border-radius:99px;padding:2px 10px;font-size:.875rem}
.x2{margin:0;padding:10px 16px 0;color:var(--muted);font-size:.875rem}
.note{margin:8px 16px 0;font-size:.875rem;color:var(--warn)}
ul{list-style:none;margin:0;padding:6px 0}
.row{position:relative;display:flex;flex-wrap:wrap;align-items:center;align-content:center;gap:2px 8px;padding-block:8px;padding-inline:64px 16px;min-block-size:56px;border-block-end:1px solid var(--line);overflow-wrap:anywhere;content-visibility:auto;contain-intrinsic-size:auto 56px}
.row:last-child{border-block-end:0}
.row::before{content:"";position:absolute;inset-inline-start:16px;inset-block-start:calc(50% - 18px);inline-size:36px;block-size:36px;border-radius:50%;flex:none;background:radial-gradient(circle at 50% 38%,var(--tc) 0 17%,transparent 18%),radial-gradient(ellipse 58% 42% at 50% 100%,var(--tc) 0 70%,transparent 71%),var(--tt);opacity:.9}
.row a,.row .u{font-weight:700;color:var(--fg);text-decoration:none;direction:ltr;unicode-bidi:isolate}
.row a:hover{color:var(--link);text-decoration:underline}
.row a:focus-visible{outline:2px solid var(--link);outline-offset:2px;border-radius:4px}
.labels{display:inline-flex;flex-wrap:wrap;gap:4px}
.labels span{font-size:.75rem;font-weight:700;border-radius:99px;padding:1px 8px;background:var(--zinc-t);color:var(--zinc);border:1px solid var(--zinc-b)}
.date{flex-basis:100%;color:var(--muted);font-size:.8125rem;font-variant-numeric:tabular-nums}
@media (min-width:560px){.date{flex-basis:auto;margin-inline-start:auto}}
.more{display:flex;align-items:center;gap:8px;padding:12px 16px;color:var(--muted);font-weight:600;font-size:.9375rem;background:repeating-linear-gradient(135deg,transparent 0 8px,var(--zinc-t) 8px 16px)}
.more .i{inline-size:16px;block-size:16px}
footer{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;margin-block:36px 0;color:var(--muted);font-size:.875rem}
footer .mark{inline-size:36px;block-size:36px;border-radius:11px}
footer .mark .i{inline-size:20px;block-size:20px}
footer p{margin:0;max-inline-size:34ch}
footer a{color:var(--link);font-weight:700;text-decoration:none;padding:8px}
@media print{
:root{--bg:#fff;--card:#fff;--fg:#000;--muted:#333;--line:#ccc}
body{padding:0;background:#fff}
summary{position:static}
.row{break-inside:avoid;content-visibility:visible}
.row::before,.cta,.ctasub{display:none}
details,.tile,.sample{break-inside:avoid-page}
.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
}
`.trim();

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ESCAPES[ch] ?? ch);
}

// Parse-time normalisation lowercases usernames, so lowercase-only is the contract.
const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

/**
 * The only href this module builds from data. Returns null for anything that
 * could escape the path segment (`/ ? # "` etc.), so a link is never emitted
 * for a username outside the allowlist.
 */
export function profileUrl(username: string): string | null {
  return USERNAME_PATTERN.test(username) ? `https://instagram.com/${username}` : null;
}

/**
 * Opens the document. Leaves `<head>` open on purpose: the caller appends
 * `</head><body>` itself. The CSP meta must stay the first child of `<head>`.
 */
export function renderHead(o: { lang: string; dir: 'ltr' | 'rtl'; title: string }): string {
  return (
    `<!doctype html><html lang="${escapeHtml(o.lang)}" dir="${o.dir}"><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(REPORT_CSP)}">` +
    '<meta name="referrer" content="no-referrer">' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${escapeHtml(o.title)}</title>` +
    `<style>${REPORT_CSS}</style>`
  );
}

export function renderRow(o: {
  username: string;
  labels: string[];
  dateText: string | null;
  isoDay: string | null;
}): string {
  const name = `@${escapeHtml(o.username)}`;
  const url = profileUrl(o.username);
  const who = url === null ? name : `<a href="${url}" rel="noreferrer">${name}</a>`;
  const labels = o.labels.length
    ? `<span class="labels">${o.labels.map(escapeHtml).join(' · ')}</span>`
    : '';
  const date =
    o.dateText === null
      ? ''
      : o.isoDay === null
        ? `<span class="date">${escapeHtml(o.dateText)}</span>`
        : `<span class="date"><time datetime="${escapeHtml(o.isoDay)}">${escapeHtml(o.dateText)}</time></span>`;
  return `<li class="row">${who}${labels}${date}</li>`;
}

/**
 * Opens a collapsible section and its `<ul>`. Only `renderRow` output may sit
 * between this and `SECTION_CLOSE`, which closes the `<ul>` and the details.
 */
export function renderSectionOpen(o: {
  id: string;
  heading: string;
  count: string;
  note: string | null;
}): string {
  const note = o.note === null ? '' : `<p class="note">${escapeHtml(o.note)}</p>`;
  return (
    `<details open id="${escapeHtml(o.id)}"><summary><h2>${escapeHtml(o.heading)}</h2>` +
    `<span class="count">${escapeHtml(o.count)}</span></summary>${note}<ul>`
  );
}

export const SECTION_CLOSE = '</ul></details>';

/** The one site link in the file; the builder never hand-writes this anchor. */
export function renderFooter(text: string): string {
  return `<footer><a href="${REPORT_SITE_URL}" rel="noreferrer">${escapeHtml(text)}</a></footer>`;
}
