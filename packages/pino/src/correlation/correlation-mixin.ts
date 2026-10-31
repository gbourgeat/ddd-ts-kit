import type { LogFields } from '@ddd-ts-kit/kernel';
import { withoutCredentialsAtTop } from '../redaction/without-credentials-at-top';

/**
 * A pino `mixin` reading the fields of the work in progress at each line that is written. A
 * source that throws (no active span, no execution context) gives no field, never a lost line.
 */
export function correlationMixin(fields: () => LogFields): () => LogFields {
  return () => {
    try {
      // A copy: pino merges the fields of the line into the object the mixin answers.
      return withoutCredentialsAtTop({ ...fields() });
    } catch {
      return {};
    }
  };
}
