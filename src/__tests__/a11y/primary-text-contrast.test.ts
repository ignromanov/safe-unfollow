/**
 * Guards the brand colour in its FOREGROUND role — text and icons painted with
 * it — which is a different token from the one that fills a button.
 *
 * `primary-contrast.test.ts` next door guards `--primary-foreground` ON
 * `--primary`: the button fill. It has never looked at `--primary` used AS a
 * foreground, and GH#210 is what that blind spot cost — 4.05:1 on
 * `--background`, 4.06:1 on `--card`, against the 4.5:1 `docs/accessibility.md`
 * promises.
 *
 * ⛔ The two roles cannot share one lightness, and this is arithmetic rather
 * than preference. Measured across L at 0.01 steps with C 0.18 H 264: the
 * foreground role clears every surface only at L ≤ 0.56, while the fill role —
 * `--primary-foreground` on `--primary`, both `/90` hover blends, the faded
 * StatCard sublabel and the `bg-white/20` count pill — clears only at L ≥ 0.60.
 * The interval between them satisfies neither, which is why GH#210's own
 * proposal (darken `--primary` to 0.52) would have turned the sibling suite
 * red. Hence a second token rather than a new value for the first.
 *
 * Surfaces are enumerated from where the colour is actually painted, not from
 * the two the issue happened to measure: `--background` and `--card` are the
 * page and the panel, `--muted` and `--accent` are the two tinted rows it lands
 * on, and `bg-primary/10` is the hero version badge and the language switcher's
 * active row — a composite the issue explicitly left unmeasured, and the worst
 * of the five at 3.51:1 before this change.
 *
 * Conditioned on the published claim, the shape #184 established: if
 * `docs/accessibility.md` ever stops saying "WCAG 2.1 AA", these assertions
 * withdraw with it rather than enforcing a standard nobody promised. The guard
 * at the bottom is what stops that conditional turning a broken promise into a
 * silent skip.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { contrastRatio, oklchToRgb, over, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';
import { THEMES } from '@tests/utils/tailwind-colour';

const SRC = resolve(process.cwd(), 'src');
const ACCESSIBILITY_MD = resolve(process.cwd(), 'docs/accessibility.md');
const CLAIMS_AA = /WCAG\s*2\.1\s*AA/i.test(readFileSync(ACCESSIBILITY_MD, 'utf8'));

/**
 * Every surface the brand foreground is painted on, each named by the thing
 * that puts it there. `bg-primary/10` is a composite rather than a token, so it
 * is computed the way the browser composites it.
 */
function surfaces(theme: 'light' | 'dark'): Record<string, readonly number[]> {
  const background = token(theme, '--background');
  return {
    '--background (page)': background,
    '--card (panel)': token(theme, '--card'),
    '--muted (tinted row)': token(theme, '--muted'),
    '--accent (tinted row)': token(theme, '--accent'),
    'bg-primary/10 over --background (hero badge)': over(
      token(theme, '--primary'),
      0.1,
      background
    ),
  };
}

/**
 * Blanks out every comment, keeping line numbers and offsets intact so a
 * reported address still points at the real line.
 *
 * A line-prefix heuristic stood here first and was wrong twice in one sitting:
 * it did not recognise a JSX `{/* ... *\/}` opener, and it saw only the first
 * line of a block comment, so prose two lines in still counted as code. Both
 * failures pointed the same way — a comment naming a class it deliberately does
 * NOT use read as a use of it, and one of them got rewritten by a regex aimed
 * at class attributes.
 *
 * `//` is only treated as a comment when it does not follow `:` or a quote, so
 * a `https://` inside a string survives.
 */
function withoutComments(source: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:"'`\w])\/\/[^\n]*/gm, (m, lead: string) => lead + blank(m.slice(lead.length)));
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('the brand foreground token clears WCAG AA everywhere it is painted', () => {
  for (const theme of THEMES) {
    it.runIf(CLAIMS_AA)(`${theme}: --primary-strong clears 4.5:1 on every surface`, () => {
      const fg = token(theme, '--primary-strong');
      const failures: string[] = [];

      for (const [name, bg] of Object.entries(surfaces(theme))) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < WCAG_AA_NORMAL) failures.push(`${name} ${ratio.toFixed(2)}:1`);
      }

      expect(failures, `below 4.5:1 in ${theme}`).toEqual([]);
    });

    it(`control: ${theme}: --primary itself still fails somewhere`, () => {
      // Runs the fill token through the same pipeline. Without it, the
      // assertion above would prove only that some number exceeds 4.5 — not
      // that this measurement can tell the new colour from the old one.
      // Counted rather than named, and deliberately not pinned to an exact
      // count: the first draft of this line asserted two dark failures where
      // there is one, which would have made the control a second thing to keep
      // true rather than a check on the first.
      const failures = Object.entries(surfaces(theme))
        .filter(([, bg]) => contrastRatio(token(theme, '--primary'), bg) < WCAG_AA_NORMAL)
        .map(([name]) => name);
      expect(failures.length).toBeGreaterThan(0);
    });
  }

  it('no component paints the fill token as a foreground', () => {
    // A text sweep rather than a render sweep: `text-primary` names one token
    // and one role, so a line either has it or does not. Icons move with the
    // text deliberately — WCAG asks 3:1 of them rather than 4.5:1 and they were
    // already clearing it, but a rule that asks each of 63 sites "is this text
    // or an icon?" is the hand-enumerated gate `.claude/rules/testing.md` bans.
    // One machine-checkable rule beats sixty-three judgements.
    const offenders: string[] = [];
    let painted = 0;
    for (const file of sourceFiles(SRC)) {
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          // Comments are skipped on purpose: two of them exist to say why this
          // token is NOT used at that spot, and a rule that forbade explaining
          // itself would delete its own reasoning. A comment paints nothing.
          // `text-primary-foreground` and `text-primary-strong` are other
          // tokens; `/80` and other opacity suffixes are the same one.
          if (/\btext-primary-strong\b/.test(line)) painted += 1;
          if (!/\btext-primary(?![\w-])/.test(line)) return;
          offenders.push(`${relative(SRC, file)}:${i + 1}`);
        });
    }

    // The comment stripper runs over every file before this sweep sees it. If
    // it ever blanked too much, this assertion would read the same empty list
    // as a clean codebase — so count what the sweep positively recognises.
    expect(painted, 'the sweep sees no text-primary-strong at all').toBeGreaterThan(0);
    expect(offenders, 'use text-primary-strong for a foreground').toEqual([]);
  });

  it.runIf(CLAIMS_AA)('every literal colour on a literal bg-white clears 4.5:1', () => {
    // `bg-white` is a literal, not a token: it stays white in the dark theme
    // while every themed foreground flips. So the pairing has to be measured
    // on white in both themes at once — which is the same as measuring the
    // literal once. Found by moving GH#210's 63 sites onto the new token: the
    // CTA button in HowToSection went from 3.30:1 to 2.73:1 in dark, because
    // the token it moved to is *lighter* there by design.
    //
    // Derived from the source rather than enumerated: any line pairing
    // `bg-white` with an `oklch()` text literal is measured, so a second one
    // added later is caught without editing this file.
    const failures: string[] = [];
    let measured = 0;

    for (const file of sourceFiles(SRC)) {
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          // Exactly the class `bg-white`, never `dark:hover:bg-white/5`: a
          // modifier or an opacity suffix makes it a translucent overlay on
          // whatever is behind it, which is a themed surface again. The first
          // draft matched the substring and reported that overlay as a defect.
          if (!/(?<![\w:-])bg-white(?![\w/-])/.test(line)) return;
          const literal = line.match(/text-\[oklch\(([\d.]+)[\s_]+([\d.]+)[\s_]+([\d.]+)\)\]/);
          if (!literal) return;
          measured += 1;
          const ratio = contrastRatio(
            oklchToRgb(Number(literal[1]), Number(literal[2]), Number(literal[3])),
            [1, 1, 1]
          );
          if (ratio < WCAG_AA_NORMAL) {
            failures.push(`${relative(SRC, file)}:${i + 1} ${ratio.toFixed(2)}:1`);
          }
        });
    }

    // Without this the assertion below would pass over an empty list, which is
    // what a regex that stopped matching looks like from the outside.
    expect(measured, 'no bg-white + oklch() literal pairing found to measure').toBeGreaterThan(0);
    expect(failures, 'literal text on literal white').toEqual([]);
  });

  it('no themed foreground token sits on a literal bg-white', () => {
    // The mirror of the sibling suite's `bg-primary` + `text-white` sweep, and
    // the rule that catches the defect above before it is measured: a themed
    // token on an unthemed surface is wrong in one theme by construction.
    const offenders: string[] = [];
    let surfaces = 0;
    for (const file of sourceFiles(SRC)) {
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          // Exactly the class `bg-white`, never `dark:hover:bg-white/5`: a
          // modifier or an opacity suffix makes it a translucent overlay on
          // whatever is behind it, which is a themed surface again. The first
          // draft matched the substring and reported that overlay as a defect.
          if (!/(?<![\w:-])bg-white(?![\w/-])/.test(line)) return;
          surfaces += 1;
          if (!/(?<!dark:)\btext-primary-strong\b/.test(line)) return;
          offenders.push(`${relative(SRC, file)}:${i + 1}`);
        });
    }

    // The tightened matcher above is the thing most likely to stop seeing its
    // subject, and a sweep that matches nothing reports the same clean list as
    // a codebase with nothing to report.
    expect(surfaces, 'no literal bg-white surface found to check').toBeGreaterThan(0);
    expect(offenders, 'use a literal colour on a literal surface').toEqual([]);
  });

  it('control: the comment stripper keeps code and drops prose, line for line', () => {
    const src = [
      'const a = "text-primary";',
      '/* text-primary in a block',
      '   text-primary two lines in */',
      '{/* text-primary in JSX */}',
      'const url = "https://example.com//x"; // text-primary trailing',
    ].join('\n');
    const out = withoutComments(src).split('\n');

    expect(out).toHaveLength(5);
    expect(out[0]).toContain('text-primary');
    expect(out[1]).not.toContain('text-primary');
    expect(out[2]).not.toContain('text-primary');
    expect(out[3]).not.toContain('text-primary');
    // The `//` inside the URL must survive; only the trailing comment goes.
    expect(out[4]).toContain('example.com//x');
    expect(out[4]).not.toContain('text-primary');
  });

  it('the published AA claim is still there, so the conditionals above ran', () => {
    expect(CLAIMS_AA, `no "WCAG 2.1 AA" found in ${ACCESSIBILITY_MD}`).toBe(true);
  });
});
