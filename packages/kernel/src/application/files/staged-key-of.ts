/** Where a file waits until the transaction that references it has committed: nothing reads there. */
export const STAGING_PREFIX = 'staging/';

/** The staged key of a final key. */
export function stagedKeyOf(key: string): string {
  return `${STAGING_PREFIX}${key}`;
}
