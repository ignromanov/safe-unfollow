import { Link, type LinkProps } from 'react-router-dom';

import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';

export interface PrefixedLinkProps extends Omit<LinkProps, 'to'> {
  /** Path without the language prefix, always leading-slash — e.g. `/upload`. */
  to: string;
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
 * Analytics goes on `onClick` as usual, with one consequence worth knowing: during the
 * dead window the browser follows the href and no handler runs, so click counts for a
 * converted CTA fall while the navigation itself starts working.
 */
export function PrefixedLink({ to, ...props }: PrefixedLinkProps) {
  const prefix = useLanguagePrefix();
  return <Link to={`${prefix}${to}`} {...props} />;
}
