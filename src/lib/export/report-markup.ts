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
:root{color-scheme:light dark;--fg:#18181b;--muted:#52525b;--bg:#fff;--line:#e4e4e7;--accent:#17629b}
@media (prefers-color-scheme:dark){:root{--fg:#fafafa;--muted:#a1a1aa;--bg:#09090b;--line:#27272a;--accent:#7cc0ee}}
*{box-sizing:border-box}
body{margin:0;padding:16px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg);background:var(--bg);text-align:start}
main{max-inline-size:720px;margin-inline:auto}
h1{font-size:1.5rem;margin:0 0 4px}
.meta,.note,.date{color:var(--muted);font-size:.875rem}
details{margin-block:16px;border-block-start:1px solid var(--line)}
summary{cursor:pointer;padding-block:12px;font-weight:700;font-size:1.125rem}
summary .count{margin-inline-start:8px;color:var(--muted);font-weight:400}
.note{margin:0 0 8px}
ul{list-style:none;margin:0;padding:0}
.row{padding-block:8px;border-block-end:1px solid var(--line);overflow-wrap:anywhere}
.row a{color:var(--accent);font-weight:600;text-decoration:none}
.row a:hover{text-decoration:underline}
.labels{margin-inline-start:8px;color:var(--muted);font-size:.875rem}
.date{display:block}
footer{margin-block:32px 0;color:var(--muted);font-size:.875rem}
footer a{color:var(--accent)}
@media print{
body{background:none;color:#000;padding:0}
:root{--fg:#000;--muted:#333;--accent:#000}
.row{break-inside:avoid}
details{border:0}
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

export function profileUrl(username: string): string {
  return `https://instagram.com/${username}`;
}

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
  const name = escapeHtml(o.username);
  const labels = o.labels.length
    ? `<span class="labels">${o.labels.map(escapeHtml).join(' · ')}</span>`
    : '';
  const date =
    o.dateText === null
      ? ''
      : o.isoDay === null
        ? `<span class="date">${escapeHtml(o.dateText)}</span>`
        : `<span class="date"><time datetime="${escapeHtml(o.isoDay)}">${escapeHtml(o.dateText)}</time></span>`;
  return (
    `<li class="row"><a href="${escapeHtml(profileUrl(o.username))}" rel="noreferrer">@${name}</a>` +
    `${labels}${date}</li>`
  );
}

export function renderSectionOpen(o: {
  id: string;
  heading: string;
  count: string;
  note: string | null;
}): string {
  const note = o.note === null ? '' : `<p class="note">${escapeHtml(o.note)}</p>`;
  return (
    `<details open id="${escapeHtml(o.id)}"><summary>${escapeHtml(o.heading)}` +
    `<span class="count">${escapeHtml(o.count)}</span></summary>${note}<ul>`
  );
}

export const SECTION_CLOSE = '</ul></details>';
