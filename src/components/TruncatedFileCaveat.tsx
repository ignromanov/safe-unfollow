import { useTranslation } from 'react-i18next';
import type { TruncatedRelationshipFile } from '@/core/types';
import { CaveatAlert } from './CaveatAlert';

/**
 * Says out loud that four counts on this page are wrong, because one of the two
 * required files arrived short.
 *
 * Meta's export dialog offers a date range, and choosing one filters
 * `followers_*.json` by entry timestamp while leaving `following.json` whole.
 * Measured on a real export: `notFollowingBack` 95 -> 294 and mutuals 298 -> 99,
 * with no warning anywhere.
 *
 * The counts are still shown. They are the best answer available from what
 * Instagram actually handed over, and blanking them would read as "you have no
 * mutuals" — a different wrong answer, delivered with the same confidence.
 *
 * **No dates, deliberately.** The natural phrasing names both files' starting
 * months, and this codebase has no localized date rendering at all — no
 * `Intl.DateTimeFormat`, no formatter, nothing but `{{count, number}}` — so
 * ten locales would each need machinery invented for one banner. The copy
 * carries no interpolation at all as a result, which also keeps it clear of
 * the CLDR plural categories that `mockI18n` cannot reproduce.
 *
 * **No diagnosis either.** A genuinely late-blooming account produces the same
 * shape, so the text states what was observed and names the one action that
 * settles it, rather than telling the reader what Instagram did.
 *
 * Self-guarding on `null` rather than being conditioned by its caller, so that
 * "is there anything to say" and "what to say" stay in one place — `/results`
 * renders it unconditionally and the detector's verdict is the only input.
 */
export function TruncatedFileCaveat({ truncated }: { truncated: TruncatedRelationshipFile }) {
  const { t } = useTranslation('results');

  if (truncated === null) return null;

  return (
    <CaveatAlert
      title={t(`caveat.truncated.${truncated}.title`)}
      body={t(`caveat.truncated.${truncated}.body`)}
    />
  );
}
