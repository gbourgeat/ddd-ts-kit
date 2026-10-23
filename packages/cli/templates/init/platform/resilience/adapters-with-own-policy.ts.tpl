/**
 * The adapters that state their own policy: filled by `ownPolicy` (`own-policy.ts`, which
 * `generate adapter` writes on tsyringe), read by `defaultPolicy`, which leaves them alone. The
 * default policy wraps outside the own one, so it finds here the very instance `ownPolicy` returned.
 */
export const adaptersWithOwnPolicy = new WeakSet<object>();
