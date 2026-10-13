/** Where a file waits until the transaction that references it commits: nothing reads there, and no final key starts with it. */
export const STAGING_PREFIX = 'staging/';

/** The staged key of a final key. */
export function stagedKeyOf(key: string): string {
  return `${STAGING_PREFIX}${key}`;
}
