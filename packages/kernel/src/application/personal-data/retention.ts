import type { RetentionPeriod } from './retention-period';

/**
 * How long a row keeps the personal data it holds, counted from a date column of the row: the end
 * of a contract, the last activity, the closing of a file (GDPR article 5(1)(e), storage
 * limitation). One unit, a positive whole number of it. Past that, the purge erases the row as its
 * declaration says, deleted or pseudonymised. A row whose date is empty never expires: the fact
 * the retention runs from has not happened yet.
 */
export interface Retention<Row> extends RetentionPeriod {
  /** The date column the period runs from: a fact of the row, never personal data itself. */
  readonly after: keyof Row & string;
}
