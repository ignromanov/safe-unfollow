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

  /** Buffer - Social media management */
  buffer: 'https://join.buffer.com/safeunfollow',

  /** SocialPilot - Social media scheduling & analytics */
  socialpilot: 'https://www.socialpilot.co?fp_ref=safeunfollow',

  /** Grammarly - Writing assistant (non-SMM, productivity) */
  grammarly: 'https://grammarly.com?ref=safeunfollow',

  /** NordVPN - Privacy & security (non-SMM, privacy) — 40% CPS */
  nordvpn: 'https://go.nordvpn.net/SHAow',

  /** NordProtect - Identity protection (non-SMM, privacy) — 40% CPS */
  nordprotect: 'https://go.nordprotect.net/SHAox',

  /** Headspace - Meditation & wellness (non-SMM, wellness) */
  headspace: 'https://headspace.com?ref=safeunfollow',

  /** NordPass - Password manager (non-SMM, privacy) */
  nordpass: 'https://nordpass.com?ref=safeunfollow',
} as const;

export type AffiliateToolId = keyof typeof AFFILIATE_LINKS;
