import { ArrowRight, Database } from 'lucide-react';

import { PrefixedLink } from 'safe-unfollow';

// Ported from Hero.tsx's two real usages: the filled primary CTA and the
// bordered secondary CTA. Both compose an icon + label, which is the actual
// call-site shape — `to` alone renders a bare unstyled anchor and would
// misrepresent how this component is used everywhere in the app.
export function PrimaryCTA() {
  return (
    <PrefixedLink
      to="/results"
      className="cursor-pointer w-full sm:w-auto px-10 md:px-12 py-4 md:py-5 rounded-3xl bg-primary text-primary-foreground font-bold text-base md:text-lg shadow-2xl shadow-primary/30 flex items-center justify-center gap-2 group"
    >
      View my results
      <ArrowRight size={20} />
    </PrefixedLink>
  );
}

export function SecondaryCTA() {
  return (
    <PrefixedLink
      to="/sample"
      className="cursor-pointer w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 rounded-3xl border border-border bg-card font-bold text-base md:text-lg flex items-center justify-center gap-2"
    >
      <Database size={20} className="text-accent" />
      Try sample data
    </PrefixedLink>
  );
}

// The tertiary/text-link shape (also from Hero.tsx): no button chrome, an
// underline instead.
export function TextLink() {
  return (
    <PrefixedLink
      to="/upload"
      className="cursor-pointer text-zinc-400 font-bold text-xs uppercase tracking-widest underline underline-offset-4 decoration-zinc-200"
    >
      I already have a file
    </PrefixedLink>
  );
}
