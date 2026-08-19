import { FAQSection } from 'safe-unfollow';

// No props — content and Schema.org JSON-LD are built entirely from i18n. The
// visible value is the accordion list itself; the JSON-LD is not part of the card.
export function Default() {
  return <FAQSection />;
}
