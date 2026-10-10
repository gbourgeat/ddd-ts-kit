import { describeErrorFields, type DescribeErrorOptions, type LogFields, type LogValue } from '@ddd-ts-kit/kernel';

/**
 * The fields as pino receives them: errors described, and no key that would forge the header.
 * pino writes `level` and `time` before the fields: a field of that name would be a second key
 * of the line, and the last one is read.
 */
export function lineFields(fields: LogFields, options: DescribeErrorOptions): Record<string, LogValue> {
  const { level: _level, time: _time, ...line } = describeErrorFields(fields, options);

  return line;
}
