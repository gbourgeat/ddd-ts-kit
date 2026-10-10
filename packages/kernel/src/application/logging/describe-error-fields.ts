import { describeError, type DescribeErrorOptions } from './describe-error.js';
import type { LogFields } from './log-fields.js';
import type { LogValue } from './log-value.js';

/**
 * The fields as a logger writes them: a copy it may change, where every `Error` directly under
 * a key is described. Reads each field once, so it throws what a getter of the fields throws.
 */
export function describeErrorFields(fields: LogFields, options: DescribeErrorOptions = {}): Record<string, LogValue> {
  const written: Record<string, LogValue> = {};

  for (const [key, value] of Object.entries(fields)) {
    written[key] = value instanceof Error ? describeError(value, options) : value;
  }

  return written;
}
