/**
 * Recognising a price written into a translated string.
 *
 * Lived inside `locales/paywall-price.test.ts` until the sweep outgrew that
 * file. It is here because two tests now need the same alphabet, and a second
 * copy of it would drift the way every duplicated fact in this repo has:
 * the paywall file would gain a symbol the tree-wide sweep does not know.
 */

/**
 * Every symbol a price can wear in this product, plus the ones a translator
 * reaches for unprompted.
 *
 * The first three are what `country-price.ts` can actually emit. The rest are
 * there because the failure this guards against is not our code choosing a
 * currency — it is a translator "helpfully" converting an amount into their
 * own, which is how `de` ended up comparing euros to dollars inside one
 * sentence and `pt` reais to dollars.
 */
const CURRENCY = '[$€£¥₹₱₺]|Rp|IDR|USD|EUR|PHP|INR';

/**
 * The first currency amount in `text`, in whichever order the locale writes
 * it — `$7`, `7 $`, `Rp50.000`, `7 €` all count.
 *
 * ⚠️ This is a symbol sweep, not a semantic one. A price spelled out in words
 * passes it untouched, and at least one locale does exactly that: `ar` wrote
 * "7 دولارات" where the others wrote "$7", so it was invisible to this
 * function while being perfectly visible to a reader. Whatever this returns
 * `undefined` for has not been proven free of prices — only free of symbols.
 */
export function currencyAmountIn(text: string): string | undefined {
  return new RegExp(`(?:${CURRENCY})\\s?\\d|\\d\\s?(?:${CURRENCY})`).exec(text)?.[0];
}
