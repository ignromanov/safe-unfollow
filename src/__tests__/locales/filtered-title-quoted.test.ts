import { describe, expect, it } from 'vitest';
import resultsEN from '@/locales/en/results.json';

/**
 * `empty.filteredTitle` interpolates one of the eleven `badges.*` labels. The
 * old English string, "No accounts are {{filterName}}", stated the label as a
 * predicate — grammatical only for adjectival labels, and wrong for the other
 * five ("No accounts are Pending request", "No accounts are Close friend").
 * The nine other locales never had this defect: each already wraps the
 * placeholder in a quote mark, turning it into a reference ("No accounts with
 * the filter '...'") rather than a claim about what the accounts *are* — a
 * form that is grammatical for any label, adjectival or not.
 *
 * The cheap, durable form of that invariant: a quote character sits directly
 * on each side of `{{filterName}}`. This does not parse grammar — it only
 * rules out the bare-predicate shape that broke five of eleven labels.
 */
describe('empty.filteredTitle avoids a copular sentence', () => {
  const PLACEHOLDER = '{{filterName}}';
  const OPENING_QUOTES = new Set(['"', "'", '“', '„', '«']);
  const CLOSING_QUOTES = new Set(['"', "'", '”', '»']);

  function quotesPlaceholder(template: string): boolean {
    const i = template.indexOf(PLACEHOLDER);
    if (i === -1) return false;
    const before = template[i - 1];
    const after = template[i + PLACEHOLDER.length];
    return OPENING_QUOTES.has(before) && CLOSING_QUOTES.has(after);
  }

  it('quotes {{filterName}} rather than stating the label as a predicate', () => {
    expect(quotesPlaceholder(resultsEN.empty.filteredTitle)).toBe(true);
  });

  it('control: the old copular string fails this check', () => {
    expect(quotesPlaceholder('No accounts are {{filterName}}')).toBe(false);
  });
});
