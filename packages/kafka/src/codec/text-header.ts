import type { IncomingRecord } from './incoming-record.js';

/** The first value of a header of a record, as text. */
export function textHeader({ message }: IncomingRecord, name: string): string | undefined {
  const value = message.headers?.[name];
  const first = Array.isArray(value) ? value[0] : value;

  return first === undefined ? undefined : first.toString();
}
