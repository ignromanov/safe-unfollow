/**
 * Affiliate Links Configuration
 *
 * Centralized storage for all affiliate URLs.
 * Update this file when registering with new affiliate programs.
 */

export const AFFILIATE_LINKS = {
  /** Publer - Social media scheduling */
  publer: 'https://publer.com/safeunfollow',

  /** Metricool - Analytics and scheduling */
  metricool: 'https://f.mtr.cool/CHZTJD',

  /** VistaCreate - Design tool (ex-Crello) */
  vistacreate: 'https://tracking.crello.com/SH17v',

  /** Predis.ai - AI content generation */
  predis: 'https://predis.ai?ref=safeunfollow',

  /** NordVPN - shown as a loading tip during ZIP parsing (offer 15, aff_id 143131) */
  nordvpn: 'https://go.nordvpn.net/SHAow',
} as const;

export type AffiliateToolId = keyof typeof AFFILIATE_LINKS;
