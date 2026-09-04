import { Link, useLocation, type LinkProps } from 'react-router-dom';

import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import type { HeroCta } from '@/lib/stats/cta-capture';

export interface PrefixedLinkProps extends Omit<LinkProps, 'to'> {
  /** Path without the language prefix, always leading-slash — e.g. `/upload`. */
  to: string;
  /**
   * Marks this link as a tracked CTA. Rendered as `data-cta`, which is all the
   * pre-hydration listener in index.html can see. A prop rather than a hand-written
   * attribute so the slug is checked against the four the drain knows.
   */
  cta?: HeroCta;
  /**
   * Router state to attach **only** when the resolved href stays on the path this
   * link is rendered on. What the value means is the caller's business; whether it
   * applies is this component's, because only the half that builds the href knows
   * what the href will be.
   */
  samePathState?: LinkProps['state'];
}

/**
 * An in-app link that carries the current language prefix.
 *
 * Every prerendered page ships HTML that is inert until React hydrates. A control that
 * navigates must therefore be an anchor with a real `href`, so the browser can follow it
 * during that window; a `<button onClick={navigate}>` does nothing at all. The rule was
 * discovered three times independently — NotFoundPage.tsx:11 carries it in a comment,
 * Hero got it in #49 — and hand-applied each time. This is the default that ends that.
 *
 * `useLanguagePrefix()` resolves to `''` for English and `/xx` otherwise, so `to` is
 * written once, unprefixed, at the call site.
 *
 * The home link is the one case plain concatenation gets wrong: `'/ru' + '/'` is `/ru/`,
 * and `vercel.json` sets `trailingSlash: false`, so the browser would be 308-redirected to
 * `/ru` — an extra round trip in exactly the pre-hydration window this component exists to
 * make work, on the slow mobile connections that are 85% of traffic. Client-side
 * navigation normalised that away and hid it; an `href` does not.
 *
 * Analytics does **not** go on `onClick` here, and that is the whole reason `cta` exists:
 * during the dead window the browser follows the href and no React handler runs, so a
 * click on a converted CTA used to lose both its event and — `setEntryCTA` being
 * first-wins — the session's attribution, which then fell to whatever was clicked next.
 * `cta` renders into the prerendered HTML, where a listener that runs at parse time can
 * still see it. See `lib/stats/cta-capture.ts` (GH#99).
 *
 * `samePathState` is answered here rather than at the call site because the answer is a
 * comparison against the href, and the href is built here. A caller doing its own
 * `pathname === ${prefix}${to}` is a second derivation of one fact: dropping the prefix
 * from it left the whole suite green while every prefixed locale silently lost the state.
 */
export function PrefixedLink({ to, cta, samePathState, state, ...props }: PrefixedLinkProps) {
  const prefix = useLanguagePrefix();
  const { pathname } = useLocation();
  const href = to === '/' ? prefix || '/' : `${prefix}${to}`;
  // No new subscription: useLanguagePrefix() reads useLocation() already, and it
  // derives the prefix from this same pathname — so href and pathname cannot
  // disagree about which locale they are in.
  const staysOnThisPage = href.split('?')[0] === pathname;
  // `state` is destructured out of the spread deliberately. Left in, a caller's
  // plain `state` would land after ours and silently win. Passing both is legal
  // and means what it reads like: `samePathState` on the page the link is
  // rendered on, `state` everywhere else.
  return (
    <Link
      to={href}
      data-cta={cta}
      state={staysOnThisPage ? (samePathState ?? state) : state}
      {...props}
    />
  );
}
