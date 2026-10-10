import type { LogFields } from '@ddd-ts-kit/kernel';
import winston from 'winston';

/**
 * A winston format reading the fields of the work in progress at each line that is written,
 * under the fields of the line and of its children. A source that throws (no active span, no
 * execution context) gives no field, never a lost line.
 */
export function correlationFields(fields: () => LogFields): winston.Logform.Format {
  return winston.format((info) => {
    for (const [key, value] of Object.entries(fieldsOrNone(fields))) {
      if (info[key] === undefined) {
        info[key] = value;
      }
    }

    return info;
  })();
}

function fieldsOrNone(fields: () => LogFields): LogFields {
  try {
    return fields();
  } catch {
    return {};
  }
}
