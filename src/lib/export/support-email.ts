/**
 * Where a refund request lands. A dedicated address rather than the general
 * `hello@` one: an unstated refund policy is a named driver of friendly-fraud
 * chargebacks, because the buyer can honestly say they did not know the terms —
 * and a Dodo dispute costs $30 against a $7 sale, so the refund is the cheap
 * outcome by a factor of four. Mirrored in the Terms of Service (§2.1); the two
 * must not drift apart.
 *
 * It is also a real mailbox: the domain runs a catch-all that MX-forwards to the
 * owner, so every address on it exists — this was checked against DNS after a
 * session inferred the opposite from a missing provisioning step (GH#89, closed
 * as not-a-defect).
 *
 * Its own module rather than an export from `PaywallModal`, which is a 460-line lazy
 * chunk: importing a constant from there would pull the whole paywall into the licence
 * chunk for the sake of one string.
 */
export const SUPPORT_EMAIL = 'refunds@safeunfollow.app';
