/**
 * The one address the product commits to in shipped copy.
 *
 * It is a real mailbox: the domain runs a catch-all that MX-forwards to the owner, so
 * every address on it exists — this was checked against DNS after a session inferred the
 * opposite from a missing provisioning step (GH#89, closed as not-a-defect).
 *
 * Its own module rather than an export from `PaywallModal`, which is a 460-line lazy
 * chunk: importing a constant from there would pull the whole paywall into the licence
 * chunk for the sake of one string.
 */
export const SUPPORT_EMAIL = 'refunds@safeunfollow.app';
