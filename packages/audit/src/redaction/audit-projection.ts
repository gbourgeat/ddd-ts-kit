import type { AuditResource } from '@ddd-ts-kit/kernel';

/**
 * What a projector chooses to keep of its subject: values in the clear, values to mask, and
 * nothing else. A value that is not a string, a number, a boolean, `null`, a bigint or a date
 * is left out: an object is never stored whole.
 */
export interface AuditProjection {
  readonly plain?: Readonly<Record<string, unknown>>;
  readonly masked?: Readonly<Record<string, unknown>>;
  /** The data subject each masked value belongs to, by field: whose key a masker keyed per person uses. */
  readonly subjects?: Readonly<Record<string, string>>;
  readonly resource?: AuditResource;
  readonly context?: string;
}
