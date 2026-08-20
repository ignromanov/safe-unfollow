import { Wizard } from '@/components/Wizard';

/**
 * Wizard page (step-by-step guide)
 * Prerendered for SEO - shows Instagram export instructions
 *
 * Every control inside Wizard computes its own destination via PrefixedLink (GH#50), so
 * this page no longer threads navigate() callbacks down to it.
 */
export function Component() {
  return <Wizard />;
}

export default Component;
