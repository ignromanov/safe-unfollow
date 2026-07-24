/**
 * Vercel Edge Middleware — ads geo-gate.
 *
 * Sets the `su_ads` cookie based on the visitor's country (from Vercel's
 * geo header). Visitors in the EEA/UK/CH get `su_ads=0` so no ads load and
 * no cookie-consent banner is ever required; everyone else gets `su_ads=1`.
 *
 * The middleware only tags the request and continues to the static origin via
 * `next()` from @vercel/edge — the officially supported continuation API — then
 * appends the cookie to that response.
 */

import { next } from '@vercel/edge';

export const config = {
  // Run on page requests only; skip API routes and static assets (files with
  // an extension) so we don't waste invocations on images/JS/CSS.
  matcher: '/((?!api/|.*\\.).*)',
};

// EEA (EU 27 + Iceland, Liechtenstein, Norway) + United Kingdom + Switzerland.
const GEO_BLOCKED_COUNTRIES = new Set<string>([
  // EU 27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA non-EU
  'IS',
  'LI',
  'NO',
  // UK + Switzerland
  'GB',
  'CH',
]);

const COOKIE_MAX_AGE_SECONDS = 86400;

export default function middleware(request: Request): Response {
  const country = request.headers.get('x-vercel-ip-country') ?? '';
  const allow = GEO_BLOCKED_COUNTRIES.has(country) ? '0' : '1';

  const response = next();
  response.headers.append(
    'set-cookie',
    `su_ads=${allow}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
  );

  return response;
}
