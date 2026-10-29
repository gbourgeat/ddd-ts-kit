import type { MessageField } from './message-fields-of';

/** A field as a `TODO(domain)` names it: `` `period` (BillingPeriod) ``, `` `note` (string, optional) ``. */
export function describedField({ name, type, optional }: MessageField): string {
  return `\`${name}\` (${type ?? 'untyped'}${optional ? ', optional' : ''})`;
}
