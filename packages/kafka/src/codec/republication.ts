import type { IncomingRecord } from './incoming-record';
import type { OutgoingRecord } from './outgoing-record';

/** The same record, key and value untouched, for another topic with `headers` added or replaced. */
export function republication(
  { message }: IncomingRecord,
  topic: string,
  headers: Record<string, string>,
): OutgoingRecord {
  return {
    topic,
    message: { key: message.key, value: message.value, headers: { ...message.headers, ...headers } },
  };
}
